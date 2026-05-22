// Canlı piyasa — DexScreener (Mini App grafik/işlemler embed).

const axios = require('axios');
const config = require('./chains/solana/config');
const { resolveTokenLogo, buildLogoCandidates } = require('./tokenLogo');
const {
  resolveDexScreenerPair,
  resolvePoolAddressForMint,
  dexScreenerChartEmbedUrl,
  dexScreenerTradesEmbedUrl,
} = require('./dexscreenerApi');

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

function normalizeTimeframe(tf) {
  const key = String(tf || '15m').toLowerCase();
  const ok = ['1m', '5m', '15m', '1h', '4h', '1d'];
  return ok.includes(key) ? key : '15m';
}

/** Canlı fiyat + DexScreener embed URL (mum API yok). */
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
    poolAddress = await resolvePoolAddressForMint(merged.address);
  }

  const chartRef = poolAddress || merged.address;
  const chartEmbedUrl = dexScreenerChartEmbedUrl(chartRef, timeframe);
  const tradesEmbedUrl = dexScreenerTradesEmbedUrl(chartRef);
  const buys = merged.buys24h || 0;
  const sells = merged.sells24h || 0;
  const txnTotal = buys + sells;

  return {
    ...merged,
    poolAddress,
    dexTradesEmbedUrl: tradesEmbedUrl,
    txnRatio: txnTotal > 0 ? { buys, sells, buyPct: Math.round((buys / txnTotal) * 100) } : null,
    chart: {
      timeframe,
      mode: 'dexscreener_embed',
      candles: [],
      stats: null,
      priceSource: 'dexscreener',
      source: 'dexscreener_embed',
      empty: !chartEmbedUrl,
      pairRef: chartRef,
      dexScreenerEmbedUrl: chartEmbedUrl,
      dexScreenerPageUrl: merged.dexScreenerUrl,
      dexTradesEmbedUrl: tradesEmbedUrl,
    },
  };
}

module.exports = {
  buildMarketFromToken,
  enrichMarketForMiniApp,
  normalizeTimeframe,
  tokenLogoUrl,
  fmtUsd,
  fmtPriceUsd,
};
