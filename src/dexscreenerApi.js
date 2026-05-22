// DexScreener REST — 30s in-memory cache; pair, token, OHLCV (Gecko yedek).

const axios = require('axios');
const config = require('./chains/solana/config');

const CACHE_MS = 30_000;
const LIVE_CACHE_MS = 4_000;
const cache = new Map();
const ohlcvLiveFetchAt = new Map();
const OHLCV_LIVE_FULL_MS = 25_000;

const http = axios.create({
  timeout: 14_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/dexscreener' },
});

function cacheKey(url) {
  return url;
}

async function cachedGet(url, opts = {}) {
  const maxAge = opts.maxAge ?? (opts.fresh ? LIVE_CACHE_MS : CACHE_MS);
  const key = cacheKey(url);
  const hit = cache.get(key);
  if (!opts.bypassCache && hit && Date.now() - hit.at < maxAge) return hit.data;
  const { data } = await http.get(url);
  cache.set(key, { at: Date.now(), data });
  return data;
}

function pickBestSolanaPair(pairs) {
  const list = (pairs || []).filter((p) => p?.chainId === 'solana' && p?.baseToken?.address);
  list.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  return list[0] || null;
}

async function fetchPairByPool(poolAddr, opts = {}) {
  if (!poolAddr) return null;
  try {
    const data = await cachedGet(
      `${config.api.dexScreenerBase}/latest/dex/pairs/solana/${poolAddr}`,
      opts,
    );
    return data?.pairs?.[0] || data?.pair || null;
  } catch {
    return null;
  }
}

async function fetchTokenData(mint, opts = {}) {
  if (!mint) return null;
  try {
    const data = await cachedGet(
      `${config.api.dexScreenerBase}/latest/dex/tokens/${mint}`,
      opts,
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
async function getPairChart(poolOrMint, timeframe = '15m', opts = {}) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return { pair: null, candles: [], poolAddress: null, priceUsd: null };

  const live = !!opts.fresh;
  const pairOpts = live ? { fresh: true, maxAge: LIVE_CACHE_MS } : {};

  let pair = await fetchPairByPool(ref, pairOpts);
  if (!pair) {
    pair = await resolveDexScreenerPair({ mint: ref, poolAddress: ref });
    if (live && pair?.pairAddress) {
      const freshPair = await fetchPairByPool(pair.pairAddress, pairOpts);
      if (freshPair) pair = freshPair;
    }
  }

  let pool = pair?.pairAddress || null;
  if (!pool && ref.length >= 32 && ref.length <= 48) {
    pool = ref;
  }
  if (!pool) {
    const { fetchGeckoPoolAddress } = require('./marketData');
    pool = await fetchGeckoPoolAddress(ref);
  }

  const { fetchOhlcv, normalizeTimeframe, patchLastCandle } = require('./marketData');
  const tf = normalizeTimeframe(timeframe);
  let candles = [];
  if (pool) {
    const ohlcvKey = `${pool}:${tf}`;
    const needFull = !live
      || !ohlcvLiveFetchAt.has(ohlcvKey)
      || Date.now() - ohlcvLiveFetchAt.get(ohlcvKey) >= OHLCV_LIVE_FULL_MS;
    if (needFull) {
      candles = await fetchOhlcv(pool, tf, { fresh: live });
      if (candles.length) ohlcvLiveFetchAt.set(ohlcvKey, Date.now());
    } else {
      candles = await fetchOhlcv(pool, tf, { allowStale: true });
    }
  }

  const priceUsd = parseFloat(pair?.priceUsd);
  if (Number.isFinite(priceUsd) && candles.length) {
    candles = patchLastCandle(candles, priceUsd);
  }

  return { pair, candles, poolAddress: pool, priceUsd: Number.isFinite(priceUsd) ? priceUsd : null };
}

/** Token mint → canlı işlemler (Gecko pool trades; pool varsa DS token atlanır). */
async function getTokenTrades(mint, limit = 50, opts = {}) {
  const t0 = Date.now();
  const poolQ = String(opts.poolAddress || '').trim() || null;
  let best = null;
  let pairs = [];
  if (!poolQ) {
    const pairOpts = opts.fresh ? { fresh: true, maxAge: LIVE_CACHE_MS } : {};
    const token = await fetchTokenData(mint, pairOpts);
    best = token?.best;
    pairs = token?.pairs || [];
  }
  const pool = poolQ || best?.pairAddress || null;
  const { fetchPairTrades } = require('./pairTrades');
  const trades = await fetchPairTrades({
    poolAddress: pool,
    mint,
    limit,
    fresh: !!opts.fresh,
    skipDexOrders: !!poolQ,
  });
  const fetchMs = Date.now() - t0;
  if (fetchMs > 2000) {
    console.warn('[dex/trades] slow', fetchMs, 'ms', String(mint || '').slice(0, 8), String(pool || '').slice(0, 8));
  }
  return { trades, pair: best, poolAddress: pool, pairs, fetchMs, pollMs: 800 };
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
