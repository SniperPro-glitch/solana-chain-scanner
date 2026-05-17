// DexScreener REST — resmi API (fiyat, pair, hacim). OHLCV/mum yok → grafik GeckoTerminal.

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

function dexScreenerChartEmbedUrl(poolOrMint) {
  const ref = String(poolOrMint || '').trim();
  if (!ref) return null;
  return `https://dexscreener.com/solana/${ref}?embed=1&theme=dark&trades=0&info=0`;
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
  dexScreenerPageUrl,
};
