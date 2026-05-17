// Solana chain config — TON/BSC import yok.

module.exports = {
  id: 'solana',
  name: 'Solana',
  native: 'SOL',
  emoji: '◎',
  brandColor: '#9945FF',
  explorer: {
    base: 'https://solscan.io',
    token: (addr) => `https://solscan.io/token/${addr}`,
    address: (addr) => `https://solscan.io/account/${addr}`,
    tx: (hash) => `https://solscan.io/tx/${hash}`,
  },
  dex: {
    primary: 'Raydium',
    swap: (tokenAddr) => `https://jup.ag/swap/SOL-${tokenAddr}`,
    jupiter: (tokenAddr) => `https://jup.ag/swap/SOL-${tokenAddr}`,
  },
  data: {
    dexScreener: (poolOrMint) => `https://dexscreener.com/solana/${poolOrMint}`,
    geckoTerminal: (poolAddr) => `https://www.geckoterminal.com/solana/pools/${poolAddr}`,
  },
  // Base58 mint/pool (32–44 karakter)
  addressPattern: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/,
  bannerDir: 'solana',
  enabled: true,
  api: {
    dexScreenerBase: 'https://api.dexscreener.com',
    geckoTerminalBase: 'https://api.geckoterminal.com/api/v2',
    rugcheckBase: 'https://api.rugcheck.xyz',
    goplusBase: 'https://api.gopluslabs.io',
  },
  discoveryPollMs: 60_000,
  wrappedNative: 'So11111111111111111111111111111111111111112',
  pump: {
    bondingProgram: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    swapProgram: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
    tradeUrl: (mint) => `https://pump.fun/coin/${mint}`,
  },
};
