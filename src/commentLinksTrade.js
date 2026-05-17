// Linkler + al/sat — Solana dalı (DexScreener / Gecko / Solscan / Jupiter).

const { t, normalizeLang } = require('./i18n');
const { customEmojiHtml } = require('./emojiPack');

const DIVIDER = '────────────────';

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dividerBlock(body) {
  const bodyStr = String(body || '').trim();
  if (!bodyStr) return '';
  return `${DIVIDER}\n${bodyStr}`;
}

function getChainLinks(token) {
  const tokenAddr = token?.tokenAddress || '';
  const poolAddr = token?.poolAddress || '';
  const ref = poolAddr || tokenAddr;
  return {
    chain: 'solana',
    dsUrl: token?.dexScreener?.url || `https://dexscreener.com/solana/${ref}`,
    gtUrl: poolAddr
      ? `https://www.geckoterminal.com/solana/pools/${poolAddr}`
      : `https://www.geckoterminal.com/solana/tokens/${tokenAddr}`,
    explorerUrl: `https://solscan.io/token/${tokenAddr}`,
    explorerName: 'Solscan',
    explorerEmoji: '🔍',
    swapUrl: `https://jup.ag/swap/SOL-${tokenAddr}`,
    swapName: 'Jupiter',
  };
}

function dexLabel(dex) {
  const d = String(dex || '').toLowerCase();
  const map = {
    raydium: 'Raydium',
    orca: 'Orca',
    meteora: 'Meteora',
    pumpswap: 'PumpSwap',
    pumpfun: 'Pump.fun',
  };
  return map[d] || dex;
}

function formatTradeSection(token, lang = 'en') {
  if (!token) return '';
  const chain = 'solana';
  const L = normalizeLang(lang);
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const cl = getChainLinks(token);
  const buyLbl = L === 'tr' ? 'Satın Al' : L === 'ru' ? 'Купить' : 'Buy';
  const sellLbl = L === 'tr' ? 'Sat' : L === 'ru' ? 'Продать' : 'Sell';
  const body = [
    `${ce('🪐')} <b>${t('card.dex', L)}:</b> ${h(dexLabel(token.dex, chain))}`,
    `${ce('🛒')} <a href="${cl.swapUrl}"><b>${buyLbl}</b></a> · ${ce('💱')} <a href="${cl.swapUrl}"><b>${sellLbl}</b></a>`,
  ].join('\n');
  return dividerBlock(body);
}

function formatLinksSection(token, lang = 'en') {
  if (!token) return '';
  const chain = 'solana';
  const L = normalizeLang(lang);
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const cl = getChainLinks(token);
  const body = [
    `${ce('🦅')} <a href="${cl.dsUrl}">DexScreener</a>`,
    `${ce('🦎')} <a href="${cl.gtUrl}">GeckoTerminal</a>`,
    `${ce(cl.explorerEmoji)} <a href="${cl.explorerUrl}">${cl.explorerName}</a>`,
  ].join('\n');
  return dividerBlock(body);
}

function formatLinksTradeBlock(token, lang = 'en') {
  const trade = formatTradeSection(token, lang);
  const links = formatLinksSection(token, lang);
  return [trade, links].filter(Boolean).join('\n');
}

module.exports = {
  formatLinksTradeBlock,
  formatTradeSection,
  formatLinksSection,
  getChainLinks,
  DIVIDER,
};
