// BSC (Binance Smart Chain) config

module.exports = {
  id: 'bsc',
  name: 'BSC',
  native: 'BNB',
  emoji: '🟡',
  emojiFallback: '🟡',
  brandColor: '#F0B90B', // Binance sarısı
  explorer: {
    base: 'https://bscscan.com',
    token: (addr) => `https://bscscan.com/token/${addr}`,
    address: (addr) => `https://bscscan.com/address/${addr}`,
    tx: (hash) => `https://bscscan.com/tx/${hash}`,
  },
  dex: {
    primary: 'PancakeSwap',
    // PancakeSwap V2 swap URL (token adresine göre)
    swap: (tokenAddr) =>
      `https://pancakeswap.finance/swap?outputCurrency=${tokenAddr}`,
    // PancakeSwap V2 router (referans)
    router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  },
  data: {
    dexScreener: (poolAddr) => `https://dexscreener.com/bsc/${poolAddr}`,
    geckoTerminal: (poolAddr) => `https://www.geckoterminal.com/bsc/pools/${poolAddr}`,
  },
  // BSC adresleri: 0x ile başlayan 40 hex karakter
  addressPattern: /\b0x[a-fA-F0-9]{40}\b/,
  bannerDir: 'bsc',
  enabled: true,
  // API endpoints
  api: {
    dexScreenerBase: 'https://api.dexscreener.com',
    geckoTerminalBase: 'https://api.geckoterminal.com/api/v2',
    bscScanBase: 'https://api.bscscan.com/api',
    honeypotBase: 'https://api.honeypot.is/v2',
    // GoPlus Token Security — ücretsiz katman, API key gerekmez (rate limit var)
    goplusBase: 'https://api.gopluslabs.io',
  },
  // Discovery polling aralığı (ms) - ECO mod
  discoveryPollMs: 60_000,
  // Native token wrapped adresi (WBNB)
  wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};
