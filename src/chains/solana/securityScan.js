// Solana güvenlik taraması — RugCheck + GoPlus (Solana) + Helius RPC (holder %).
// Ücretsiz katmanlar; anahtar çoğu uç nokta için gerekmez (Helius = mevcut HELIUS_API_KEY).

const axios = require('axios');
const config = require('./config');

const http = axios.create({
  timeout: 20_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/security' },
});

const CACHE_TTL_MS = Math.max(60_000, parseInt(process.env.SOLANA_SECURITY_CACHE_MS || '300000', 10));
const _cache = new Map();

function envOn(name, defaultVal = '1') {
  return ['1', 'true', 'on', 'yes'].includes(String(process.env[name] ?? defaultVal).trim().toLowerCase());
}

function pctFromGoPlus(raw) {
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function sumTopHolderPct(holders, n = 10) {
  if (!Array.isArray(holders) || !holders.length) return { top1: null, top10: null };
  let top10 = 0;
  for (let i = 0; i < Math.min(n, holders.length); i++) {
    const p = pctFromGoPlus(holders[i]?.percent ?? holders[i]?.pct);
    if (p != null) top10 += p;
  }
  const top1 = pctFromGoPlus(holders[0]?.percent ?? holders[0]?.pct);
  return { top1, top10: top10 || null };
}

async function rpcCall(method, params) {
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();
  if (!rpc || !/^https?:\/\//i.test(rpc)) return { error: 'no_rpc' };
  try {
    const { data } = await http.post(rpc, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 12_000 });
    if (data?.error) return { error: data.error.message || 'rpc_error' };
    return { result: data.result };
  } catch (e) {
    return { error: e.message };
  }
}

/** Helius / Solana RPC — top1 & top10 holder % (getTokenLargestAccounts). */
async function fetchHeliusHolderPct(mint) {
  if (!envOn('HELIUS_HOLDERS_ENABLED', '1')) return { error: 'disabled' };
  const supplyRes = await rpcCall('getTokenSupply', [mint]);
  if (supplyRes.error) return { error: supplyRes.error };
  const largestRes = await rpcCall('getTokenLargestAccounts', [mint]);
  if (largestRes.error) return { error: largestRes.error };

  const totalUi = supplyRes.result?.value?.uiAmount
    ?? (supplyRes.result?.value?.amount && supplyRes.result?.value?.decimals != null
      ? Number(supplyRes.result.value.amount) / (10 ** supplyRes.result.value.decimals)
      : null);
  if (!totalUi || totalUi <= 0) return { error: 'no_supply' };

  const accounts = largestRes.result?.value || [];
  let top10 = 0;
  let top1 = null;
  for (let i = 0; i < accounts.length && i < 10; i++) {
    const ui = Number(accounts[i]?.uiAmount) || 0;
    const pct = (ui / totalUi) * 100;
    if (i === 0) top1 = pct;
    top10 += pct;
  }
  return { topHolderPct: top1, top10Pct: top10, source: 'helius_rpc' };
}

/** RugCheck — özet + tam rapor (mint/freeze, top holders, risks). */
async function fetchRugCheck(mint) {
  if (!envOn('RUGCHECK_ENABLED', '1')) return { error: 'disabled' };
  const base = (process.env.RUGCHECK_API_BASE || 'https://api.rugcheck.xyz').replace(/\/$/, '');
  const headers = {};
  const jwt = (process.env.RUGCHECK_JWT || '').trim();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const out = { summary: null, report: null, error: null };
  try {
    const summary = await http.get(`${base}/v1/tokens/${mint}/report/summary`, { headers, timeout: 12_000 });
    out.summary = summary.data;
  } catch (e) {
    out.error = e.message;
  }

  if (envOn('RUGCHECK_FULL_REPORT', '1')) {
    try {
      const report = await http.get(`${base}/v1/tokens/${mint}/report`, { headers, timeout: 22_000 });
      out.report = report.data;
    } catch (e) {
      if (!out.error) out.error = e.message;
    }
  }
  return out;
}

/** GoPlus Solana — ücretsiz, API key gerekmez. */
async function fetchGoPlusSolana(mint) {
  if (!envOn('GOPLUS_SOLANA_ENABLED', '1')) return { error: 'disabled' };
  const base = (process.env.GOPLUS_API_BASE || 'https://api.gopluslabs.io').replace(/\/$/, '');
  try {
    const { data } = await http.get(`${base}/api/v1/solana/token_security`, {
      params: { contract_addresses: mint },
      timeout: 15_000,
    });
    if (data?.code !== 1 || !data?.result) return { error: data?.message || 'bad_response' };
    const row = data.result[mint] || data.result[Object.keys(data.result)[0]];
    if (!row) return { error: 'no_row' };
    const holders = row.holders || [];
    const { top1, top10 } = sumTopHolderPct(holders, 10);
    return {
      mintable_status: row.mintable?.status ?? null,
      freezable_status: row.freezable?.status ?? null,
      closable_status: row.closable?.status ?? null,
      metadata_mutable_status: row.metadata_mutable?.status ?? null,
      balance_mutable_status: row.balance_mutable_authority?.status ?? null,
      trusted_token: row.trusted_token ?? null,
      holder_count: row.holder_count != null ? Number(row.holder_count) : null,
      total_supply: row.total_supply ?? null,
      holders,
      top_holder_pct: top1,
      top10_pct: top10,
      non_transferable: row.non_transferable ?? null,
    };
  } catch (e) {
    return { error: e.message };
  }
}

function normalizeRugCheck(rc) {
  if (!rc || rc.error === 'disabled') return null;
  const summary = rc.summary || {};
  const report = rc.report || {};
  const risks = (report.risks?.length ? report.risks : summary.risks) || [];
  const topHolders = report.topHolders || [];
  const { top1, top10 } = sumTopHolderPct(
    topHolders.map((h) => ({ pct: h.pct })),
    10,
  );
  return {
    error: rc.error && !report.mint && !summary.score ? rc.error : null,
    score: report.score ?? summary.score ?? null,
    score_normalised: report.score_normalised ?? summary.score_normalised ?? null,
    lpLockedPct: summary.lpLockedPct ?? report.lpLockedPct ?? null,
    rugged: report.rugged === true,
    risks,
    mintAuthority: report.mintAuthority ?? null,
    freezeAuthority: report.freezeAuthority ?? null,
    totalHolders: report.totalHolders ?? null,
    top_holder_pct: top1,
    top10_pct: top10,
  };
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

/** Paralel tarama — sonuç enrichToken için. */
async function scanTokenSecurity(mint, opts = {}) {
  if (!mint) return null;
  const deep = opts.deep === true;
  const cacheKey = `${mint}::${deep ? 'd' : 's'}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [rugcheck, goplus, helius] = await Promise.all([
    fetchRugCheck(mint),
    fetchGoPlusSolana(mint),
    fetchHeliusHolderPct(mint),
  ]);

  const rc = normalizeRugCheck(rugcheck);
  const gp = goplus?.error ? null : goplus;
  const hl = helius?.error ? null : helius;

  const mintable = (() => {
    if (rc?.mintAuthority) return true;
    if (gp && String(gp.mintable_status) === '1') return true;
    return null;
  })();

  const freezeAuth = rc?.freezeAuthority
    || (gp && String(gp.freezable_status) === '1' ? 'freezable' : null);

  const data = {
    rugcheck: rc,
    goplus: gp,
    goplus_error: goplus?.error || null,
    helius_holders: hl,
    helius_error: helius?.error || null,
    topHolderPct: pickFirst(rc?.top_holder_pct, gp?.top_holder_pct, hl?.topHolderPct),
    top10Pct: pickFirst(rc?.top10_pct, gp?.top10_pct, hl?.top10Pct),
    holdersCount: pickFirst(
      rc?.totalHolders,
      gp?.holder_count,
    ),
    mintable,
    freezeAuthority: freezeAuth,
    rugged: rc?.rugged === true,
    riskScore: rc?.score_normalised ?? rc?.score ?? null,
    fetchedAt: Date.now(),
  };

  _cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

module.exports = {
  scanTokenSecurity,
  fetchRugCheck,
  fetchGoPlusSolana,
  fetchHeliusHolderPct,
};
