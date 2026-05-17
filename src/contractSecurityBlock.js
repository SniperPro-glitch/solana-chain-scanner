// Kontrat güvenliği + holder — kart veya bot yorumu (ortak blok).

const { t, normalizeLang } = require('./i18n');
const { customEmojiHtml } = require('./emojiPack');

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtNum(n, lang) {
  const locale = { en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' }[normalizeLang(lang)] || 'en-US';
  try { return n.toLocaleString(locale); } catch { return String(n); }
}

function statusIcon(p, thresholds, ce, chain = 'ton') {
  if (p > thresholds.red) return chain === 'solana' ? ce('❤️') : '🔴';
  if (p > thresholds.orange) return chain === 'solana' ? ce('❤️') : '🟠';
  if (p > thresholds.yellow) return ce('🟡');
  return ce('🟢');
}

/** Kontrat güvenliği satırları (HTML). Veri yoksa ''. */
function formatContractSecurityBlock(token, lang = 'en', chain = 'ton', opts = {}) {
  const c = token?.contract;
  if (!c) return '';
  const L = normalizeLang(lang);
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const lines = [];

  if (!opts.skipTitle) {
    lines.push(`${ce(chain === 'solana' ? '🪙' : '🔐')} <b>${t('card.contractSecurity', L)}</b>`);
  }

  if (c.mintable === false) {
    lines.push(`${ce(chain === 'solana' ? '🤔' : '✅')} ${t('card.mintLocked', L)}`);
  } else if (c.mintable === true) {
    lines.push(`${ce(chain === 'solana' ? '❤️' : '⚠️')} ${t('card.mintOpen', L)}`);
  }

  if (c.adminAddress === null) {
    lines.push(`${ce(chain === 'solana' ? '🤔' : '✅')} ${t('card.ownerRenounced', L)}`);
  } else if (c.adminAddress) {
    const short = c.adminAddress.slice(0, 6) + '...' + c.adminAddress.slice(-4);
    lines.push(`${ce(chain === 'solana' ? '❤️' : '⚠️')} ${t('card.ownerActive', L)}: <code>${h(short)}</code>`);
  }

  if (c.topHolderPct !== null && c.topHolderPct !== undefined) {
    const p = c.topHolderPct;
    lines.push(`${statusIcon(p, { red: 50, orange: 20, yellow: 10 }, ce, chain)} ${t('card.topHolder', L)}: <b>${p.toFixed(1)}%</b>`);
  }

  if (c.top10Pct !== null && c.top10Pct !== undefined) {
    const p = c.top10Pct;
    lines.push(`${statusIcon(p, { red: 80, orange: 60, yellow: 40 }, ce, chain)} ${t('card.top10', L)}: <b>${p.toFixed(1)}%</b>`);
  }

  // Holder sayısı yalnızca bot yorumunda (showHolders: true); üst kartta gösterilmez.
  if (opts.showHolders === true) {
    const holders = c.holdersCount ?? token.holdersCount;
    if (holders) {
      lines.push(`${ce('👥')} ${t('card.holdersCount', L)}: <b>${fmtNum(holders, L)}</b>`);
    }
  }

  if (c.verification === 'whitelist') {
    lines.push(`${ce(chain === 'solana' ? '🤔' : '✅')} ${t('card.verified', L)}`);
  } else if (c.verification === 'blacklist') {
    lines.push(`${ce(chain === 'solana' ? '❤️' : '🚫')} Blacklisted`);
  }

  return lines.join('\n');
}

module.exports = { formatContractSecurityBlock };
