// Al/sat — token hangi DEX’teyse o platformun swap sayfası (cüzdan orada bağlanır).
// TRADE_LINK_PROVIDER=auto (varsayılan) | phantom | jupiter | pump

const solanaConfig = require('./chains/solana/config');
const { t, normalizeLang } = require('./i18n');
const { customEmojiHtml, solscanEmojiHtml, dexEmojiCharFor } = require('./emojiPack');

const DIVIDER = '────────────────';
const WSOL = solanaConfig.wrappedSol;

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dividerBlock(body) {
  const bodyStr = String(body || '').trim();
  if (!bodyStr) return '';
  return `${DIVIDER}\n${bodyStr}`;
}

function tradeProviderMode() {
  const p = String(process.env.TRADE_LINK_PROVIDER || 'auto').trim().toLowerCase();
  if (['auto', 'phantom', 'jupiter', 'pump'].includes(p)) return p;
  return 'auto';
}

/** Token’ın likidite kaynağı / DEX’i. */
function resolveTradeVenue(token) {
  const mint = token?.tokenAddress || '';
  let dex = String(token?.dex || '').toLowerCase().replace(/-v\d+$/, '');
  const graduated = token?.pumpGraduated === true;

  if (dex === 'pumpfun' || dex === 'pump') {
    return graduated ? 'pumpswap' : 'pumpfun';
  }
  if (dex === 'pumpswap') return 'pumpswap';

  if (!graduated && (token?.isPumpFun || (mint && mint.endsWith('pump')))) {
    return 'pumpfun';
  }
  if (graduated && mint.endsWith('pump')) return 'pumpswap';

  if (['raydium', 'orca', 'meteora'].includes(dex)) return dex;
  return dex || 'phantom';
}

function urlsForVenue(venue, mint) {
  const { dex, pump } = solanaConfig;
  const pumpUrl = pump.tradeUrl(mint);

  switch (venue) {
    case 'pumpfun':
    case 'pumpswap':
      return {
        buyUrl: pumpUrl,
        sellUrl: pumpUrl,
        provider: venue === 'pumpswap' ? 'PumpSwap' : 'Pump.fun',
      };
    case 'raydium':
      return {
        buyUrl: dex.raydiumBuy(mint, WSOL),
        sellUrl: dex.raydiumSell(mint, WSOL),
        provider: 'Raydium',
      };
    case 'orca':
      return {
        buyUrl: dex.orcaBuy(mint, WSOL),
        sellUrl: dex.orcaSell(mint, WSOL),
        provider: 'Orca',
      };
    case 'meteora':
      return {
        buyUrl: dex.meteoraBuy(mint, WSOL),
        sellUrl: dex.meteoraSell(mint, WSOL),
        provider: 'Meteora',
      };
    default:
      return {
        buyUrl: dex.phantomBuy(mint),
        sellUrl: dex.phantomSell(mint),
        provider: 'Phantom',
      };
  }
}

/** Alım / satım URL — venue veya env zorlaması. */
function getTradeUrls(token) {
  const mint = token?.tokenAddress || '';
  if (!mint) return { buyUrl: null, sellUrl: null, provider: 'none', venue: 'none' };

  const mode = tradeProviderMode();
  const venue = resolveTradeVenue(token);

  if (mode === 'jupiter') {
    const jup = solanaConfig.dex.jupiter(mint);
    return { buyUrl: jup, sellUrl: jup, provider: 'Jupiter', venue: 'jupiter' };
  }
  if (mode === 'pump') {
    const url = solanaConfig.pump.tradeUrl(mint);
    return { buyUrl: url, sellUrl: url, provider: 'Pump.fun', venue: 'pumpfun' };
  }
  if (mode === 'phantom') {
    return {
      buyUrl: solanaConfig.dex.phantomBuy(mint),
      sellUrl: solanaConfig.dex.phantomSell(mint),
      provider: 'Phantom',
      venue: 'phantom',
    };
  }

  // auto — token nerede işlem görüyorsa o platform
  const routed = urlsForVenue(venue, mint);
  return { ...routed, venue };
}

function getChainLinks(token) {
  const tokenAddr = token?.tokenAddress || '';
  const poolAddr = token?.poolAddress || '';
  const ref = poolAddr || tokenAddr;
  const venue = resolveTradeVenue(token);
  const onPump = venue === 'pumpfun' || venue === 'pumpswap';
  const pumpUrl = onPump ? solanaConfig.pump.tradeUrl(tokenAddr) : null;
  const trade = getTradeUrls(token);

  return {
    chain: 'solana',
    dsUrl: token?.dexScreener?.url || `https://dexscreener.com/solana/${ref}`,
    gtUrl: poolAddr
      ? `https://www.geckoterminal.com/solana/pools/${poolAddr}`
      : `https://www.geckoterminal.com/solana/tokens/${tokenAddr}`,
    explorerUrl: `https://solscan.io/token/${tokenAddr}`,
    explorerName: 'Solscan',
    explorerEmoji: '🪙',
    buyUrl: trade.buyUrl,
    sellUrl: trade.sellUrl,
    tradeProvider: trade.provider,
    tradeVenue: trade.venue,
    pumpUrl,
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

function dexEmojiFor(token) {
  return dexEmojiCharFor(token);
}

function formatTradeSection(token, lang = 'en') {
  if (!token) return '';
  const chain = 'solana';
  const L = normalizeLang(lang);
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const cl = getChainLinks(token);
  if (!cl.buyUrl && !cl.sellUrl) return '';

  const buyLbl = L === 'tr' ? 'Satın Al' : L === 'ru' ? 'Купить' : 'Buy';
  const sellLbl = L === 'tr' ? 'Sat' : L === 'ru' ? 'Продать' : 'Sell';
  const via = cl.tradeProvider || 'Swap';
  const isPhantom = via === 'Phantom' || cl.tradeVenue === 'phantom';
  const buyIco = isPhantom ? ce('👻') : ce('🛒');
  const sellIco = isPhantom ? ce('👻') : ce('💱');
  const viaLine = L === 'tr'
    ? `<i>(${isPhantom ? 'Phantom' : via} — cüzdanı orada bağla)</i>`
    : L === 'ru'
      ? `<i>(${isPhantom ? 'Phantom' : via})</i>`
      : `<i>(connect wallet on ${isPhantom ? 'Phantom' : via})</i>`;

  const body = [
    `${ce(dexEmojiFor(token))} <b>${t('card.dex', L)}:</b> ${h(dexLabel(token.dex, chain))}`,
    `${buyIco} <a href="${cl.buyUrl}"><b>${buyLbl}</b></a> · ${sellIco} <a href="${cl.sellUrl}"><b>${sellLbl}</b></a> ${viaLine}`,
  ].join('\n');
  return dividerBlock(body);
}

function formatLinksSection(token, lang = 'en') {
  if (!token) return '';
  const chain = 'solana';
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const cl = getChainLinks(token);
  const linkLines = [
    `${ce('🦅')} <a href="${cl.dsUrl}">DexScreener</a>`,
    `${ce('🦎')} <a href="${cl.gtUrl}">GeckoTerminal</a>`,
    `${solscanEmojiHtml(chain)} <a href="${cl.explorerUrl}">${cl.explorerName}</a>`,
  ];
  if (cl.pumpUrl) linkLines.push(`${ce('💊')} <a href="${cl.pumpUrl}">Pump.fun</a>`);
  return dividerBlock(linkLines.join('\n'));
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
  getTradeUrls,
  resolveTradeVenue,
  DIVIDER,
};
