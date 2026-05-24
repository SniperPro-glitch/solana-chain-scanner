// BSC cüzdan kümesi — pool erken işlemleri + ilk BNB fonlayıcı (BscScan API).
// Dönüş şeması TON sybilDetector ile aynı (channelComment / filtre uyumu).

const axios = require('axios');
const config = require('./config');

const http = axios.create({
  timeout: 12_000,
  headers: { Accept: 'application/json', 'User-Agent': 'multi-chain-scanner/bsc-sybil' },
});

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || '';
const ENABLED = process.env.BSC_SYBIL_ENABLED !== '0';
const TTL_MS = 30 * 60 * 1000;
const RATE_MS = parseInt(process.env.BSC_SYBIL_RATE_MS || '220', 10);

const poolCache = new Map();
const funderCache = new Map();

const INFRA = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x10ed43c718714eb63d5a57b68ab6c83b173e29', // PancakeSwap Router v2
  '0x13f4ceba99f9a31cba9590a9e2e68fe967501ce5', // PancakeSwap Smart Router v3
  '0x111111125421ca6dc452d289c28014ad96299a88', // 1inch v6
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x exchange proxy
].map((a) => a.toLowerCase()));

function normAddr(a) {
  if (!a) return null;
  const s = String(a).trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(s) ? s : null;
}

function fromCache(map, key) {
  const k = normAddr(key);
  if (!k) return null;
  const e = map.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) {
    map.delete(k);
    return null;
  }
  return e;
}

function toCache(map, key, value) {
  const k = normAddr(key);
  if (k) map.set(k, { ...value, ts: Date.now() });
}

function unknownResult(buyersAnalyzed = 0) {
  return {
    buyersAnalyzed,
    largestClusterSize: 0,
    clusterRatio: 0,
    sharedFunder: null,
    sybilDetected: false,
    source: 'unknown',
  };
}

async function bscScanGet(params) {
  if (!BSCSCAN_API_KEY) return null;
  const { data } = await http.get(config.api.bscScanBase, {
    params: { ...params, apikey: BSCSCAN_API_KEY },
  });
  if (!data || data.status !== '1' || !Array.isArray(data.result)) {
    if (data?.message && process.env.BSC_DEBUG === '1') {
      console.warn('[bsc/sybil] BscScan:', data.message);
    }
    return null;
  }
  return data.result;
}

async function fetchPoolEarlyBuyers(poolAddress, limit = 10) {
  const pool = normAddr(poolAddress);
  if (!pool) return [];

  const rows = await bscScanGet({
    module: 'account',
    action: 'txlist',
    address: pool,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: 80,
    sort: 'asc',
  });
  if (!rows) return [];

  const buyers = [];
  const seen = new Set();
  for (const tx of rows) {
    if (tx.isError === '1') continue;
    if (normAddr(tx.to) !== pool) continue;
    const from = normAddr(tx.from);
    if (!from || from === pool || INFRA.has(from)) continue;
    if (seen.has(from)) continue;
    seen.add(from);
    buyers.push(from);
    if (buyers.length >= limit) break;
  }
  return buyers;
}

async function findInitialFunder(walletAddress) {
  const wallet = normAddr(walletAddress);
  if (!wallet) return null;

  const cached = fromCache(funderCache, wallet);
  if (cached) return cached.funder;

  const rows = await bscScanGet({
    module: 'account',
    action: 'txlist',
    address: wallet,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: 40,
    sort: 'asc',
  });

  let funder = null;
  if (rows) {
    for (const tx of rows) {
      if (tx.isError === '1') continue;
      if (normAddr(tx.to) !== wallet) continue;
      const value = BigInt(tx.value || '0');
      if (value <= 0n) continue;
      const from = normAddr(tx.from);
      if (!from || INFRA.has(from)) continue;
      funder = from;
      break;
    }
  }

  if (!funder) {
    const internal = await bscScanGet({
      module: 'account',
      action: 'txlistinternal',
      address: wallet,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 30,
      sort: 'asc',
    });
    if (internal) {
      for (const tx of internal) {
        if (tx.isError === '1') continue;
        if (normAddr(tx.to) !== wallet) continue;
        const value = BigInt(tx.value || '0');
        if (value <= 0n) continue;
        const from = normAddr(tx.from);
        if (!from || INFRA.has(from)) continue;
        funder = from;
        break;
      }
    }
  }

  toCache(funderCache, wallet, { funder });
  return funder;
}

async function analyzePool(poolAddress, sampleSize = 8) {
  if (!poolAddress) return unknownResult(0);
  if (!ENABLED || !BSCSCAN_API_KEY) return unknownResult(0);

  const cached = fromCache(poolCache, poolAddress);
  if (cached) return { ...cached.result, source: 'cache' };

  try {
    const buyers = await fetchPoolEarlyBuyers(poolAddress, sampleSize);
    if (buyers.length < 3) {
      const u = unknownResult(buyers.length);
      toCache(poolCache, poolAddress, { result: u });
      return u;
    }

    const funders = [];
    for (const w of buyers) {
      funders.push(await findInitialFunder(w));
      await new Promise((r) => setTimeout(r, RATE_MS));
    }

    const counts = new Map();
    for (const f of funders) {
      if (!f) continue;
      counts.set(f, (counts.get(f) || 0) + 1);
    }

    let largestClusterSize = 0;
    let sharedFunder = null;
    for (const [f, c] of counts.entries()) {
      if (c > largestClusterSize) {
        largestClusterSize = c;
        sharedFunder = f;
      }
    }

    if (largestClusterSize < 2) {
      largestClusterSize = 0;
      sharedFunder = null;
    }

    const clusterRatio = buyers.length > 0 ? largestClusterSize / buyers.length : 0;
    const result = {
      buyersAnalyzed: buyers.length,
      largestClusterSize,
      clusterRatio,
      sharedFunder,
      sybilDetected: clusterRatio >= 0.5,
    };
    toCache(poolCache, poolAddress, { result });
    return { ...result, source: 'fresh' };
  } catch (e) {
    console.warn(`[bsc/sybil] analyzePool fail (${poolAddress?.slice(0, 12)}…):`, e.message);
    return unknownResult(0);
  }
}

function clearCache() {
  poolCache.clear();
  funderCache.clear();
}

module.exports = {
  analyzePool,
  findInitialFunder,
  fetchPoolEarlyBuyers,
  clearCache,
};
