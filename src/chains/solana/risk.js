// Solana SPL risk — mint/freeze (RPC/Helius), holder özeti (DexScreener / Helius).

const axios = require('axios');
const config = require('./config');

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
      console.warn('[solana/risk] RPC 401 — HELIUS_API_KEY Railway\'de düzeltin (her token için tekrarlanmaz)');
    } else if (!rpcWarned401 || st !== 401) {
      console.warn(`[solana/risk] ${method}:`, e.message);
    }
    return null;
  }
}

async function fetchMintParsed(mint) {
  try {
    const result = await rpcCall('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    return result?.value?.data?.parsed?.info || null;
  } catch (e) {
    console.warn('[solana/risk] getAccountInfo:', e.message);
    return null;
  }
}

async function fetchHoldersFromHelius(_mint) {
  // v0 token-metadata deprecated; holder özeti DexScreener + getAccountInfo (RPC) yeterli.
  return null;
}

/** DexScreener pair üzerinden holder sayısı (varsa). */
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

async function enrichToken(token, _opts = {}) {
  if (!token?.tokenAddress) return token;

  const contract = {
    mintable: null,
    adminAddress: null,
    topHolderPct: null,
    top10Pct: null,
    holdersCount: token.holdersCount ?? null,
    verification: null,
  };

  const parsed = await fetchMintParsed(token.tokenAddress);
  if (parsed) {
    contract.mintable = parsed.mintAuthority != null;
    const freeze = parsed.freezeAuthority;
    const mintAuth = parsed.mintAuthority;
    contract.adminAddress = freeze || mintAuth || null;
    if (freeze) contract.verification = 'freeze_authority';
  }

  const dsH = await fetchHoldersFromDex(token);
  if (dsH?.holdersCount != null) {
    contract.holdersCount = dsH.holdersCount;
    token.holdersCount = dsH.holdersCount;
  }

  token.contract = contract;
  token.chain = config.id;
  return token;
}

module.exports = { enrichToken };
