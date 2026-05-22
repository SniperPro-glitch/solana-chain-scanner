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

/** Mint → havuz adresi (sadece DexScreener, OHLCV yok). */
async function resolvePoolAddressForMint(mint) {
  const pair = await resolveDexScreenerPair({ mint });
  return pair?.pairAddress || null;
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

const CHART_INTERVAL = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
};

function dexScreenerChartEmbedUrl(poolOrMint, timeframe = '15m') {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  const tf = String(timeframe || '15m').toLowerCase();
  const interval = CHART_INTERVAL[tf] || '15';
  const q = new URLSearchParams({
    embed: '1',
    theme: 'dark',
    trades: '0',
    info: '0',
    tabs: '0',
    chartLeftToolbar: '1',
    chartTheme: 'dark',
    chartType: 'candle',
    interval,
  });
  return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q.toString()}`;
}

function dexScreenerTradesEmbedUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  const q = new URLSearchParams({
    embed: '1',
    theme: 'dark',
    trades: '1',
    info: '0',
    tabs: '0',
    chartLeftToolbar: '0',
    chartTheme: 'dark',
    interval: '15',
  });
  return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q.toString()}`;
}

function dexScreenerPageUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  return config.data.dexScreener(ref);
}

/** Pool veya mint → pair + OHLCV (Birdeye; yedek Gecko). */
async function getPairChart(poolOrMint, timeframe = '15m', opts = {}) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return { pair: null, candles: [], poolAddress: null, priceUsd: null, source: null };

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
  const mint = pair?.baseToken?.address || (ref.length >= 32 && ref.length <= 48 ? ref : null);
  if (!pool && ref.length >= 32 && ref.length <= 48) {
    pool = ref;
  }
  if (!pool && mint) {
    const { fetchGeckoPoolAddress } = require('./marketData');
    pool = await fetchGeckoPoolAddress(mint);
  }

  const { fetchOhlcv, normalizeTimeframe, patchLastCandle } = require('./marketData');
  const tf = normalizeTimeframe(timeframe);
  let candles = [];
  let source = null;

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
    if (candles.length) source = 'geckoterminal';
  }

  const priceUsd = parseFloat(pair?.priceUsd);
  if (Number.isFinite(priceUsd) && candles.length) {
    candles = patchLastCandle(candles, priceUsd);
  }

  return {
    pair,
    candles,
    poolAddress: pool,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    source,
    mint,
  };
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
  const { isBirdeyeEnabled, fetchTokenTrades: fetchBirdeyeTrades } = require('./birdeyeApi');
  const { parseSinceMs, filterTradesAfterSince } = require('./pairTrades');
  const sinceMs = opts.sinceMs != null ? parseSinceMs(opts.sinceMs) : 0;
  let trades = [];
  let source = 'birdeye';

  if (isBirdeyeEnabled()) {
    trades = await fetchBirdeyeTrades(mint, limit);
    if (sinceMs > 0) trades = filterTradesAfterSince(trades, sinceMs);
  } else {
    const { fetchPairTrades } = require('./pairTrades');
    trades = await fetchPairTrades({
      poolAddress: pool,
      mint,
      limit,
      fresh: !!opts.fresh,
      skipDexOrders: !!poolQ,
      sinceMs,
    });
    source = 'geckoterminal';
  }
  const fetchMs = Date.now() - t0;
  if (fetchMs > 2000) {
    console.warn('[dex/trades] slow', fetchMs, 'ms', String(mint || '').slice(0, 8), String(pool || '').slice(0, 8));
  }
  let latestUpdatedAt = sinceMs || null;
  for (const tr of trades) {
    const ms = new Date(tr?.updatedAt || tr?.at || 0).getTime();
    if (Number.isFinite(ms) && ms > (latestUpdatedAt || 0)) latestUpdatedAt = ms;
  }
  return {
    trades,
    pair: best,
    poolAddress: pool,
    pairs,
    fetchMs,
    pollMs: 0,
    source,
    incremental: sinceMs > 0,
    latestUpdatedAt: latestUpdatedAt ? new Date(latestUpdatedAt).toISOString() : null,
  };
}

module.exports = {
  CACHE_MS,
  cachedGet,
  fetchPairByPool,
  fetchTokenData,
  fetchPairsByMint,
  resolveDexScreenerPair,
  resolvePoolAddressForMint,
  pickBestSolanaPair,
  dexScreenerChartEmbedUrl,
  dexScreenerTradesEmbedUrl,
  dexScreenerPageUrl,
  getPairChart,
  getTokenTrades,
};
