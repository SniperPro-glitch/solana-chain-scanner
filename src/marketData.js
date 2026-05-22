// Canlı piyasa + OHLCV (DexScreener + GeckoTerminal) — Mini App grafik.

const axios = require('axios');
const config = require('./chains/solana/config');
const { resolveTokenLogo, chartStatsFromCandles, buildLogoCandidates } = require('./tokenLogo');
const { resolveDexScreenerPair } = require('./dexscreenerApi');

const http = axios.create({
  timeout: 12_000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'solana-chain-scanner/miniapp',
  },
});

function tokenLogoUrl(token) {
  const candidates = buildLogoCandidates(token, null);
  return candidates[0] || null;
}

const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

function buildMarketFromToken(token) {
  if (!token) return null;
  return {
    name: token.tokenName || token.tokenSymbol || '?',
    symbol: token.tokenSymbol || '?',
    address: token.tokenAddress || '',
    imageUrl: tokenLogoUrl(token),
    dex: token.dex || null,
    dexScreenerUrl: token.dexScreener?.url
      || (token.tokenAddress ? config.data.dexScreener(token.tokenAddress) : null),
    poolAddress: token.dexScreener?.pairAddress || null,
    priceUsd: token.priceUsd,
    priceUsdFmt: fmtPriceUsd(token.priceUsd),
    priceChange5m: token.priceChange5m,
    priceChange1h: token.priceChange1h,
    priceChange6h: token.priceChange6h,
    priceChange24h: token.priceChange24h,
    liquidityUsd: token.liquidityUsd,
    liquidityUsdFmt: fmtUsd(token.liquidityUsd),
    volume24h: token.volume24h,
    volume24hFmt: fmtUsd(token.volume24h),
    marketCapUsd: token.marketCapUsd,
    marketCapUsdFmt: fmtUsd(token.marketCapUsd),
    fdvUsd: token.fdvUsd,
    fdvUsdFmt: fmtUsd(token.fdvUsd),
    buys24h: token.buys24h,
    sells24h: token.sells24h,
  };
}

async function fetchDexScreenerPair(token) {
  return resolveDexScreenerPair({
    mint: token?.tokenAddress,
    poolAddress: token?.dexScreener?.pairAddress || token?.poolAddress,
  });
}

function applyPairToMarket(market, pair) {
  if (!pair || !market) return market;
  return {
    ...market,
    imageUrl: pair.info?.imageUrl || market.imageUrl,
    priceUsd: parseFloat(pair.priceUsd) || market.priceUsd,
    priceUsdFmt: fmtPriceUsd(parseFloat(pair.priceUsd) || market.priceUsd),
    pairLabel: pair.baseToken?.symbol && pair.quoteToken?.symbol
      ? `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`
      : market.pairLabel,
    dex: pair.dexId || market.dex,
    priceChange5m: parseFloat(pair.priceChange?.m5) ?? market.priceChange5m,
    priceChange1h: parseFloat(pair.priceChange?.h1) ?? market.priceChange1h,
    priceChange6h: parseFloat(pair.priceChange?.h6) ?? market.priceChange6h,
    priceChange24h: parseFloat(pair.priceChange?.h24) ?? market.priceChange24h,
    volume1h: parseFloat(pair.volume?.h1) || market.volume1h,
    buys24h: pair.txns?.h24?.buys ?? market.buys24h,
    sells24h: pair.txns?.h24?.sells ?? market.sells24h,
    liquidityUsd: parseFloat(pair.liquidity?.usd) || market.liquidityUsd,
    liquidityUsdFmt: fmtUsd(parseFloat(pair.liquidity?.usd) || market.liquidityUsd),
    volume24h: parseFloat(pair.volume?.h24) || market.volume24h,
    volume24hFmt: fmtUsd(parseFloat(pair.volume?.h24) || market.volume24h),
    marketCapUsd: parseFloat(pair.marketCap) || market.marketCapUsd,
    marketCapUsdFmt: fmtUsd(parseFloat(pair.marketCap) || market.marketCapUsd),
    fdvUsd: parseFloat(pair.fdv) || market.fdvUsd,
    fdvUsdFmt: fmtUsd(parseFloat(pair.fdv) || market.fdvUsd),
    poolAddress: pair.pairAddress || market.poolAddress,
    dexScreenerUrl: pair.url || market.dexScreenerUrl,
  };
}

async function fetchGeckoPoolAddress(mint) {
  if (!mint) return null;
  try {
    const { data } = await http.get(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools`,
      { params: { page: 1 } },
    );
    const pools = data?.data || [];
    if (!pools.length) return null;
    pools.sort((a, b) => {
      const ra = parseFloat(a.attributes?.reserve_in_usd) || 0;
      const rb = parseFloat(b.attributes?.reserve_in_usd) || 0;
      return rb - ra;
    });
    return pools[0]?.attributes?.address || null;
  } catch {
    return null;
  }
}

const TIMEFRAMES = {
  '1m': { aggregate: 1, limit: 120, path: 'minute' },
  '5m': { aggregate: 5, limit: 96, path: 'minute' },
  '15m': { aggregate: 15, limit: 96, path: 'minute' },
  '1h': { aggregate: 1, limit: 96, path: 'hour' },
  '4h': { aggregate: 4, limit: 72, path: 'hour' },
  '1d': { aggregate: 1, limit: 90, path: 'day' },
};

/** OHLCV cache TTL per timeframe (key: ${pool}:${tf}). */
const OHLCV_CACHE_MS_BY_TF = {
  '1m': 10_000,
  '5m': 30_000,
  '15m': 60_000,
  '1h': 60_000,
  '4h': 120_000,
  '1d': 120_000,
};
const ohlcvCache = new Map();
const ohlcvLastGood = new Map();

function ohlcvCacheMs(tf) {
  return OHLCV_CACHE_MS_BY_TF[normalizeTimeframe(tf)] || 60_000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeTimeframe(tf) {
  const key = String(tf || '15m').toLowerCase();
  return TIMEFRAMES[key] ? key : '15m';
}

/** Lightweight Charts: günlük mumlar için YYYY-MM-DD, diğerleri unix saniye. */
function chartTimeFromUnix(unixSec, path) {
  const sec = Number(unixSec);
  if (!Number.isFinite(sec)) return null;
  if (path === 'day') {
    const d = new Date(sec * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  return sec;
}

function parseOhlcvRows(list, path) {
  return (list || [])
    .map((row) => {
      let unix = Number(row[0]);
      const close = Number(row[4]);
      if (!unix || !close) return null;
      if (unix > 1e12) unix = Math.floor(unix / 1000);
      return {
        unix,
        time: chartTimeFromUnix(unix, path),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close,
        volume: Number(row[5]) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.unix - b.unix)
    .map(({ unix, ...c }) => c);
}

/** 15m veriden 1H / 4H / 1D üret (Gecko boş dönerse). */
function resampleCandles(candles, bucketSec, path) {
  const buckets = new Map();
  for (const c of candles) {
    const unix = typeof c.time === 'number' ? c.time : Number(c.unix);
    if (!unix) continue;
    const key = Math.floor(unix / bucketSec) * bucketSec;
    let b = buckets.get(key);
    if (!b) {
      b = {
        unix: key,
        time: chartTimeFromUnix(key, path),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: 0,
      };
      buckets.set(key, b);
    } else {
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += c.volume || 0;
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.unix - b.unix)
    .map(({ unix, ...rest }) => rest);
}

async function requestGeckoOhlcv(poolAddress, cfg, limit) {
  const { data, status } = await http.get(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${cfg.path}`,
    {
      params: { aggregate: cfg.aggregate, limit, currency: 'usd' },
      validateStatus: () => true,
    },
  );
  if (status === 429) {
    const err = new Error('GeckoTerminal rate limit');
    err.code = 'rate_limit';
    throw err;
  }
  if (status >= 400) return [];
  return parseOhlcvRows(data?.data?.attributes?.ohlcv_list, cfg.path);
}

async function fetchOhlcvOnce(poolAddress, tf, limitOverride) {
  const cfg = TIMEFRAMES[tf];
  const limit = limitOverride || cfg.limit;
  let candles = [];
  try {
    candles = await requestGeckoOhlcv(poolAddress, cfg, limit);
  } catch (e) {
    if (e.code === 'rate_limit') throw e;
    return [];
  }
  if (!candles.length && (tf === '1h' || tf === '4h' || tf === '1d')) {
    try {
      const base = await requestGeckoOhlcv(poolAddress, TIMEFRAMES['15m'], 200);
      const bucket = tf === '1h' ? 3600 : tf === '4h' ? 14_400 : 86_400;
      candles = resampleCandles(
        base.map((c) => ({ ...c, unix: typeof c.time === 'number' ? c.time : null })),
        bucket,
        cfg.path,
      );
    } catch (e) {
      if (e.code === 'rate_limit') throw e;
    }
  }
  return candles;
}

function patchLastCandle(candles, priceUsd) {
  if (!candles?.length || !Number.isFinite(priceUsd)) return candles || [];
  const out = candles.map((c) => ({ ...c }));
  const last = out[out.length - 1];
  last.close = priceUsd;
  last.high = Math.max(Number(last.high) || priceUsd, priceUsd);
  last.low = Math.min(Number(last.low) || priceUsd, priceUsd);
  return out;
}

async function fetchOhlcv(poolAddress, timeframe = '15m', third, fourth) {
  let limitOverride;
  let opts = {};
  if (third && typeof third === 'object') {
    opts = third;
  } else {
    limitOverride = third;
    opts = fourth || {};
  }
  if (!poolAddress) return [];
  const tf = normalizeTimeframe(timeframe);
  const cacheKey = `${poolAddress}:${tf}`;
  const hit = ohlcvCache.get(cacheKey);
  const cacheMs = ohlcvCacheMs(tf);
  if (!opts.fresh && hit?.candles?.length && Date.now() - hit.at < cacheMs) return hit.candles;
  if (opts.allowStale && hit?.candles?.length) return hit.candles;
  const staleOnly = ohlcvLastGood.get(cacheKey);
  if (opts.allowStale && staleOnly?.length) return staleOnly;

  const stale = ohlcvLastGood.get(cacheKey);
  let candles = [];
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      candles = await fetchOhlcvOnce(poolAddress, tf, limitOverride);
      if (candles.length) break;
      if (i < attempts - 1) await sleep(600 * (i + 1));
    } catch (e) {
      if (e.code === 'rate_limit') {
        console.warn('[market] Gecko OHLCV rate limit:', tf, `attempt ${i + 1}/${attempts}`);
        if (i < attempts - 1) await sleep(900 * (i + 1));
        continue;
      }
      candles = [];
      break;
    }
  }

  if (candles.length) {
    ohlcvCache.set(cacheKey, { at: Date.now(), candles });
    ohlcvLastGood.set(cacheKey, candles);
    return candles;
  }

  if (stale?.length) {
    console.warn('[market] OHLCV boş — son iyi veri kullanılıyor:', cacheKey);
    return stale;
  }
  return [];
}

/**
 * Canlı fiyat + logo + grafik mumları (paylaşım anına göre değil, açılış anı).
 */
async function enrichMarketForMiniApp(token, options = {}) {
  const market = buildMarketFromToken(token);
  if (!market) return null;
  const timeframe = normalizeTimeframe(options.timeframe);

  const pair = await fetchDexScreenerPair(token);
  const merged = applyPairToMarket(market, pair);

  const logo = await resolveTokenLogo(token, pair);
  if (logo.url) {
    merged.imageUrl = logo.url;
    merged.imageSource = logo.source;
    merged.imageFallbacks = logo.fallbacks;
  } else {
    merged.imageFallbacks = buildLogoCandidates(token, pair);
  }

  let poolAddress = merged.poolAddress || pair?.pairAddress || null;
  if (!poolAddress && merged.address) {
    poolAddress = await fetchGeckoPoolAddress(merged.address);
  }

  const chartRef = poolAddress || merged.address;
  let candles = [];
  if (poolAddress) {
    candles = await fetchOhlcv(poolAddress, timeframe);
  }
  const chartStats = chartStatsFromCandles(candles);
  const buys = merged.buys24h || 0;
  const sells = merged.sells24h || 0;
  const txnTotal = buys + sells;

  let recentTrades = [];
  try {
    const { fetchPairTrades } = require('./pairTrades');
    recentTrades = await fetchPairTrades({
      poolAddress,
      mint: merged.address,
      limit: 28,
    });
  } catch (e) {
    console.warn('[market] trades:', e.message);
  }

  return {
    ...merged,
    poolAddress,
    txnRatio: txnTotal > 0 ? { buys, sells, buyPct: Math.round((buys / txnTotal) * 100) } : null,
    recentTrades,
    tradesPollMs: 2000,
    chart: {
      timeframe,
      mode: 'lightweight',
      candles,
      stats: chartStats,
      priceSource: 'dexscreener',
      source: candles.length ? 'geckoterminal' : 'dexscreener',
      empty: !chartRef,
      pairRef: chartRef,
      dexScreenerPageUrl: merged.dexScreenerUrl,
    },
  };
}

module.exports = {
  buildMarketFromToken,
  enrichMarketForMiniApp,
  ohlcvCacheMs,
  OHLCV_CACHE_MS_BY_TF,
  fetchOhlcv,
  patchLastCandle,
  fetchGeckoPoolAddress,
  normalizeTimeframe,
  tokenLogoUrl,
  fmtUsd,
  fmtPriceUsd,
};
