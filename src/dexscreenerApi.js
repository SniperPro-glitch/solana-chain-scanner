// DexScreener REST — pair çözümleme + embed URL (grafik/işlemler iframe).

const axios = require('axios');
const config = require('./chains/solana/config');

const CACHE_MS = 30_000;
const LIVE_CACHE_MS = 4_000;
const cache = new Map();

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

/** Mint → havuz adresi (sadece DexScreener). */
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

/** Tarayıcıda Dex embed sık boş kalır — GeckoTerminal aynı havuzda çalışır. */
function geckoTerminalChartEmbedUrl(poolAddress, timeframe = '15m') {
  const pool = String(poolAddress || '').trim();
  if (!pool) return null;
  void timeframe;
  const q = new URLSearchParams({
    embed: '1',
    info: '0',
    swaps: '0',
    light_chart: '1',
    chart_type: 'price',
    resolution: '15m',
  });
  return `https://www.geckoterminal.com/solana/pools/${encodeURIComponent(pool)}?${q.toString()}`;
}

function geckoTerminalTradesEmbedUrl(poolAddress) {
  const pool = String(poolAddress || '').trim();
  if (!pool) return null;
  const q = new URLSearchParams({
    embed: '1',
    info: '0',
    swaps: '1',
    light_chart: '1',
  });
  return `https://www.geckoterminal.com/solana/pools/${encodeURIComponent(pool)}?${q.toString()}`;
}

function dexScreenerPageUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  return config.data.dexScreener(ref);
}

/** Canlı fiyat — DexScreener pair (mum verisi yok, grafik embed). */
async function getPairChart(poolOrMint, timeframe = '15m', opts = {}) {
  void timeframe;
  const ref = String(poolOrMint || '').trim();
  if (!ref) {
    return { pair: null, candles: [], poolAddress: null, priceUsd: null, source: null, mint: null };
  }

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
  if (!pool && ref.length >= 32 && ref.length <= 48) pool = ref;

  const priceUsd = parseFloat(pair?.priceUsd);

  return {
    pair,
    candles: [],
    poolAddress: pool,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    source: 'dexscreener',
    mint,
  };
}

/** İşlemler DexScreener embed — REST liste kullanılmıyor. */
async function getTokenTrades(mint, limit = 50, opts = {}) {
  void mint;
  void limit;
  void opts;
  return {
    trades: [],
    pair: null,
    poolAddress: opts.poolAddress || null,
    pairs: [],
    fetchMs: 0,
    pollMs: 0,
    source: 'dexscreener_embed',
    incremental: false,
    latestUpdatedAt: null,
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
  geckoTerminalChartEmbedUrl,
  geckoTerminalTradesEmbedUrl,
  dexScreenerPageUrl,
  getPairChart,
  getTokenTrades,
};
