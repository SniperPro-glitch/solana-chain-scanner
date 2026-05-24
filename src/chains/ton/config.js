// TON chain config — chain-spesifik sabitler

module.exports = {
  id: 'ton',
  name: 'TON',
  native: 'TON',
  // Premium animasyonlu TON logosu emojiPack'ten (custom_emoji_id ile)
  emoji: '💎',
  emojiFallback: '💎',
  // Marka rengi (banner üretim referansı için)
  brandColor: '#0098EA',
  // Explorer base URL'leri
  explorer: {
    base: 'https://tonviewer.com',
    token: (addr) => `https://tonviewer.com/${addr}`,
    address: (addr) => `https://tonviewer.com/${addr}`,
    tx: (hash) => `https://tonviewer.com/transaction/${hash}`,
  },
  // DEX bilgileri
  dex: {
    primary: 'STON.fi',
    swap: (tokenAddr) =>
      `https://app.ston.fi/swap?ft=${tokenAddr}&tt=EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez`,
  },
  // Veri kaynakları
  data: {
    dexScreener: (poolAddr) => `https://dexscreener.com/ton/${poolAddr}`,
    geckoTerminal: (poolAddr) => `https://www.geckoterminal.com/ton/pools/${poolAddr}`,
  },
  // Adres pattern (resolve/extract için)
  addressPattern: /\b(EQ[A-Za-z0-9_-]{46}|UQ[A-Za-z0-9_-]{46})\b/,
  // Banner klasörü
  bannerDir: 'ton',
  // Aktif mi?
  enabled: true,
};
