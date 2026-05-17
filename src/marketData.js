// Canlı piyasa + OHLCV (DexScreener + GeckoTerminal) — Mini App grafik.

const axios = require('axios');
const config = require('./chains/solana/config');
const { resolveTokenLogo, chartStatsFromCandles, buildLogoCandidates } = require('./tokenLogo');

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

function fmtUsd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const x = Number(n);
  if (x === 0) return '$0';
  if (x < 0.0001) return `$${x.toExponential(2)}`;
  if (x < 1) return `$${x.toFixed(6)}`;
  if (x < 1_000) return `$${x.toFixed(4)}`;
  if (x < 1_000_000) return `$${(x / 1_000).toFixed(2)}K`;
  if (x < 1_000_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  return `$${(x / 1_000_000_000).toFixed(2)}B`;
}

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
    priceUsdFmt: fmtUsd(token.priceUsd),
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
  const mint = token?.tokenAddress;
  const pool = token?.dexScreener?.pairAddress;
  if (!mint && !pool) return null;
  try {
    if (pool) {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/latest/dex/pairs/solana/${pool}`,
      );
      return data?.pairs?.[0] || null;
    }
    const { data } = await http.get(
      `${config.api.dexScreenerBase}/tokens/v1/solana/${mint}`,
    );
    const pairs = Array.isArray(data) ? data : (data?.pairs || []);
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    return pairs[0] || null;
  } catch {
    return null;
  }
}

function applyPairToMarket(market, pair) {
  if (!pair || !market) return market;
  return {
    ...market,
    imageUrl: pair.info?.imageUrl || market.imageUrl,
    priceUsd: parseFloat(pair.priceUsd) || market.priceUsd,
    priceUsdFmt: fmtUsd(parseFloat(pair.priceUsd) || market.priceUsd),
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
  '1h': { aggregate: 60, limit: 96, path: 'minute' },
  '4h': { aggregate: 240, limit: 72, path: 'minute' },
  '1d': { aggregate: 1, limit: 90, path: 'day' },
};

function normalizeTimeframe(tf) {
  const key = String(tf || '15m').toLowerCase();
  return TIMEFRAMES[key] ? key : '15m';
}

async function fetchOhlcv(poolAddress, timeframe = '15m', limitOverride) {
  if (!poolAddress) return [];
  const tf = normalizeTimeframe(timeframe);
  const cfg = TIMEFRAMES[tf];
  const limit = limitOverride || cfg.limit;
  try {
    const { data } = await http.get(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${cfg.path}`,
      { params: { aggregate: cfg.aggregate, limit, currency: 'usd' } },
    );
    const list = data?.data?.attributes?.ohlcv_list || [];
    return list
      .map((row) => ({
        time: row[0],
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5],
      }))
      .filter((c) => c.time && c.close > 0)
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
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

  let poolAddress = merged.poolAddress;
  if (!poolAddress && merged.address) {
    poolAddress = await fetchGeckoPoolAddress(merged.address);
  }

  const candles = await fetchOhlcv(poolAddress, timeframe);
  const chartStats = chartStatsFromCandles(candles);
  const buys = merged.buys24h || 0;
  const sells = merged.sells24h || 0;
  const txnTotal = buys + sells;

  return {
    ...merged,
    poolAddress,
    txnRatio: txnTotal > 0 ? { buys, sells, buyPct: Math.round((buys / txnTotal) * 100) } : null,
    chart: {
      timeframe,
      candles,
      stats: chartStats,
      source: candles.length ? 'geckoterminal' : null,
    },
  };
}

module.exports = {
  buildMarketFromToken,
  enrichMarketForMiniApp,
  fetchOhlcv,
  normalizeTimeframe,
  tokenLogoUrl,
  fmtUsd,
};
