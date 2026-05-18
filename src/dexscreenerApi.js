// DexScreener REST — fiyat/pair/hacim + canlı grafik embed URL.

const axios = require('axios');
const config = require('./chains/solana/config');

const http = axios.create({
  timeout: 14_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/dexscreener' },
});

function pickBestSolanaPair(pairs) {
  const list = (pairs || []).filter((p) => p?.chainId === 'solana' && p?.baseToken?.address);
  list.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  return list[0] || null;
}

async function fetchPairByPool(poolAddr) {
  if (!poolAddr) return null;
  try {
    const { data } = await http.get(
      `${config.api.dexScreenerBase}/latest/dex/pairs/solana/${poolAddr}`,
    );
    return data?.pairs?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchPairsByMint(mint) {
  if (!mint) return null;
  const urls = [
    `${config.api.dexScreenerBase}/latest/dex/tokens/${mint}`,
    `${config.api.dexScreenerBase}/tokens/v1/solana/${mint}`,
    `${config.api.dexScreenerBase}/token-pairs/v1/solana/${mint}`,
  ];
  for (const url of urls) {
    try {
      const { data } = await http.get(url);
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

const CHART_INTERVAL = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
};

/** Canlı grafik — DexScreener embed (TradingView motoru DexScreener sunucusunda). */
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

/** Canlı işlem listesi — DexScreener embed (trades paneli). */
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
    chartType: 'candle',
    interval: '15',
  });
  return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q.toString()}`;
}

function dexScreenerPageUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  return config.data.dexScreener(ref);
}

module.exports = {
  resolveDexScreenerPair,
  pickBestSolanaPair,
  dexScreenerChartEmbedUrl,
  dexScreenerTradesEmbedUrl,
  dexScreenerPageUrl,
};
