// Solana SPL risk — RugCheck + GoPlus + Helius RPC + RPC mint/freeze yedek.

const axios = require('axios');
const config = require('./config');
const { scanTokenSecurity } = require('./securityScan');

const http = axios.create({
  timeout: 12_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/risk' },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function is429(e) {
  return e?.response?.status === 429 || /429/i.test(String(e?.message || ''));
}

let rpcWarned401 = false;

async function rpcCall(method, params) {
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();
  if (!rpc || !/^https?:\/\//i.test(rpc)) return null;
  try {
    const { data } = await http.post(rpc, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });
    return data?.result ?? null;
  } catch (e) {
    const st = e.response?.status;
    if (st === 401 && !rpcWarned401) {
      rpcWarned401 = true;
      console.warn('[solana/risk] RPC 401 — HELIUS_API_KEY Railway\'de düzeltin');
    }
    return null;
  }
}

async function fetchMintParsed(mint) {
  try {
    const result = await rpcCall('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    return result?.value?.data?.parsed?.info || null;
  } catch {
    return null;
  }
}

async function fetchHoldersFromDex(token) {
  const mint = token?.tokenAddress;
  if (!mint) return null;
  for (let att = 0; att < 2; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/tokens/v1/solana/${mint}`,
      );
      const pairs = Array.isArray(data) ? data : (data?.pairs || []);
      const p = pairs.find((x) => x.chainId === 'solana') || pairs[0];
      const holders = p?.holders ?? p?.info?.holders;
      if (holders != null) return { holdersCount: Number(holders) || null };
      return null;
    } catch (e) {
      if (is429(e)) {
        await sleep(800 * (att + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

function applySecurityScan(contract, scan) {
  if (!scan) return contract;

  if (scan.mintable != null) contract.mintable = scan.mintable;
  if (scan.freezeAuthority) {
    contract.adminAddress = typeof scan.freezeAuthority === 'string'
      ? scan.freezeAuthority
      : 'freeze_authority';
    contract.verification = 'freeze_authority';
  }
  if (scan.topHolderPct != null) contract.topHolderPct = scan.topHolderPct;
  if (scan.top10Pct != null) contract.top10Pct = scan.top10Pct;
  if (scan.holdersCount != null) {
    contract.holdersCount = scan.holdersCount;
  }
  if (scan.rugged) {
    contract.is_scam = true;
    contract.verification = 'rugcheck_rugged';
  }

  contract.solana_extra = {
    rugcheck: scan.rugcheck,
    goplus: scan.goplus,
    goplus_error: scan.goplus_error,
    helius_holders: scan.helius_holders,
    helius_error: scan.helius_error,
    riskScore: scan.riskScore,
    fetchedAt: scan.fetchedAt,
  };
  return contract;
}

async function enrichToken(token, opts = {}) {
  if (!token?.tokenAddress) return token;

  const contract = {
    mintable: null,
    adminAddress: null,
    topHolderPct: null,
    top10Pct: null,
    holdersCount: token.holdersCount ?? null,
    verification: null,
    is_scam: false,
  };

  const scan = await scanTokenSecurity(token.tokenAddress, { deep: opts.deep === true }).catch((e) => {
    console.warn('[solana/security]', e.message);
    return null;
  });
  applySecurityScan(contract, scan);

  const parsed = await fetchMintParsed(token.tokenAddress);
  if (parsed) {
    if (contract.mintable == null) contract.mintable = parsed.mintAuthority != null;
    if (!contract.adminAddress) {
      const freeze = parsed.freezeAuthority;
      const mintAuth = parsed.mintAuthority;
      contract.adminAddress = freeze || mintAuth || null;
      if (freeze && !contract.verification) contract.verification = 'freeze_authority';
    }
  }

  const dsH = await fetchHoldersFromDex(token);
  if (dsH?.holdersCount != null && contract.holdersCount == null) {
    contract.holdersCount = dsH.holdersCount;
    token.holdersCount = dsH.holdersCount;
  } else if (contract.holdersCount != null) {
    token.holdersCount = contract.holdersCount;
  }

  token.contract = contract;
  token.chain = config.id;
  return token;
}

module.exports = { enrichToken, scanTokenSecurity };
