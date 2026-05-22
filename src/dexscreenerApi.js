// DexScreener REST — 30s in-memory cache; pair, token, OHLCV (Gecko yedek).

const axios = require('axios');
const config = require('./chains/solana/config');

const CACHE_MS = 30_000;
const cache = new Map();

const http = axios.create({
  timeout: 14_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/dexscreener' },
});

function cacheKey(url) {
  return url;
}

async function cachedGet(url) {
  const key = cacheKey(url);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const { data } = await http.get(url);
  cache.set(key, { at: Date.now(), data });
  return data;
}

function pickBestSolanaPair(pairs) {
  const list = (pairs || []).filter((p) => p?.chainId === 'solana' && p?.baseToken?.address);
  list.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  return list[0] || null;
}

async function fetchPairByPool(poolAddr) {
  if (!poolAddr) return null;
  try {
    const data = await cachedGet(
      `${config.api.dexScreenerBase}/latest/dex/pairs/solana/${poolAddr}`,
    );
    return data?.pairs?.[0] || data?.pair || null;
  } catch {
    return null;
  }
}

async function fetchTokenData(mint) {
  if (!mint) return null;
  try {
    const data = await cachedGet(
      `${config.api.dexScreenerBase}/latest/dex/tokens/${mint}`,
    );
    const pairs = data?.pairs || [];
    return { pairs, best: pickBestSolanaPair(pairs) };
  } catch {
    return null;
  }
}

async function fetchPairsByMint(mint) {
  const token = await fetchTokenData(mint);
  if (token?.best) return token.best;
  const urls = [
    `${config.api.dexScreenerBase}/tokens/v1/solana/${mint}`,
    `${config.api.dexScreenerBase}/token-pairs/v1/solana/${mint}`,
  ];
  for (const url of urls) {
    try {
      const data = await cachedGet(url);
      const pairs = Array.isArray(data) ? data : (data?.pairs || []);
      const best = pickBestSolanaPair(pairs);
      if (best) return best;
    } catch {
      /* sonraki endpoint */
    }
  }
  return null;
}

/** Mint veya pool → en likit DexScreener pair. */
async function resolveDexScreenerPair({ mint, poolAddress } = {}) {
  if (poolAddress) {
    const byPool = await fetchPairByPool(poolAddress);
    if (byPool) return byPool;
  }
  if (mint) return fetchPairsByMint(mint);
  return null;
}

function dexScreenerPageUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  return config.data.dexScreener(ref);
}

/** Pool veya mint → pair + OHLCV (Dex pair meta, Gecko mumlar). */
async function getPairChart(poolOrMint, timeframe = '15m') {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return { pair: null, candles: [], poolAddress: null };

  let pair = await fetchPairByPool(ref);
  if (!pair) {
    pair = await resolveDexScreenerPair({ mint: ref, poolAddress: ref });
  }

  let pool = pair?.pairAddress || null;
  if (!pool) {
    const { fetchGeckoPoolAddress } = require('./marketData');
    pool = await fetchGeckoPoolAddress(ref);
  }

  let candles = [];
  if (pool) {
    const { fetchOhlcv, normalizeTimeframe } = require('./marketData');
    candles = await fetchOhlcv(pool, normalizeTimeframe(timeframe));
  }
  return { pair, candles, poolAddress: pool };
}

/** Token mint → canlı işlemler (DS token + pool trades). */
async function getTokenTrades(mint, limit = 28) {
  const token = await fetchTokenData(mint);
  const best = token?.best;
  const { fetchPairTrades } = require('./pairTrades');
  const trades = await fetchPairTrades({
    poolAddress: best?.pairAddress,
    mint,
    limit,
  });
  return { trades, pair: best, pairs: token?.pairs || [] };
}

module.exports = {
  CACHE_MS,
  cachedGet,
  fetchPairByPool,
  fetchTokenData,
  fetchPairsByMint,
  resolveDexScreenerPair,
  pickBestSolanaPair,
  dexScreenerPageUrl,
  getPairChart,
  getTokenTrades,
};
