// Solana kart + bot yorumu formatı (compact üst kart; detay yorumda).

const { customEmojiHtml, whitelistTitleSuffix, formatTrustedGreenTitle } = require('../../emojiPack');
const { t, normalizeLang } = require('../../i18n');
const { formatRiskLine } = require('../../riskDisplay');

function ce(emoji) {
  return customEmojiHtml(emoji, 'solana');
}

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtUsd(n) {
  if (n === null || n === undefined || isNaN(n)) return '?';
  if (n === 0) return '$0';
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  if (n < 1_000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n < 1_000_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1_000_000_000).toFixed(2)}B`;
}

function liqStrengthEmoji(liq) {
  if (!liq) return '🟢';
  if (liq.code === 'STRONG') return '⚡';
  return liq.emoji || '🟢';
}

function liqLabel(code, lang) {
  const map = {
    POOR: 'liq.poor', WEAK: 'liq.weak', OK: 'liq.ok', GOOD: 'liq.good', STRONG: 'liq.strong',
  };
  return t(map[code] || 'liq.ok', lang);
}

function riskLabel(code, lang) {
  const map = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  return t(map[code] || 'risk.medium', lang);
}

function ageLabel(age, lang) {
  if (!age || age.code === 'unknown') return '?';
  if (age.code === 'minutesNew') return `${age.value} ${t('age.minutesNew', lang)}`;
  if (age.code === 'minutes') return `${age.value} ${t('age.minutes', lang)}`;
  if (age.code === 'hours') return `${age.hours}${t('age.hours', lang)} ${age.minutes}${t('age.minutes', lang)}`;
  if (age.code === 'days') return `${age.value} ${t('age.days', lang)}`;
  return '?';
}

function dexLabel(dex) {
  const d = String(dex || '').toLowerCase();
  const map = {
    raydium: 'Raydium',
    'raydium-clmm': 'Raydium CLMM',
    orca: 'Orca',
    meteora: 'Meteora',
    pumpswap: 'PumpSwap',
    pumpfun: 'Pump.fun',
  };
  return map[d] || dex;
}

/**
 * Üst kart (compact): fiyat, likidite, hacim, yaş, risk, uyarılar (max 3).
 * Kontrat / holder / link / swap / bot analizi kartta yok.
 */
function formatTokenCard(token, audit, lang = 'en', level = 'green', opts = {}) {
  const L = normalizeLang(lang);
  const lines = [];

  let titleEmoji;
  let titleKey;
  if (level === 'yellow') {
    titleEmoji = ce('⚠️');
    titleKey = 'card.title.yellow';
  } else if (level === 'critical' || level === 'red') {
    titleEmoji = ce('🚨');
    titleKey = level === 'red' ? 'card.title.red' : 'card.title.critical';
  } else {
    titleEmoji = ce('🆕');
    titleKey = 'card.newToken';
  }

  const chainFlag = ce('◎');
  const trustedGreenTitle = level === 'green' ? formatTrustedGreenTitle(token, L, 'solana', t, h) : null;
  if (trustedGreenTitle) {
    const titleRows = trustedGreenTitle.split('\n');
    lines.push(`${chainFlag} ${titleRows[0]}`);
    for (let i = 1; i < titleRows.length; i++) lines.push(titleRows[i]);
  } else {
    lines.push(
      `${chainFlag} ${titleEmoji} <b>${t(titleKey, L)}:</b> $${h(token.tokenSymbol)}${whitelistTitleSuffix(token.trustedWhitelist, L, 'solana', t, h)}`,
    );
  }
  lines.push(`${ce('📛')} ${h(token.tokenName)}`);
  lines.push('');

  lines.push(`${ce('💲')} <b>${t('card.price', L)}:</b> ${h(fmtUsd(token.priceUsd))}`);

  const liq = audit.breakdown.liquidity;
  lines.push(`${ce('💧')} <b>${t('card.liquidity', L)}:</b> ${h(fmtUsd(token.liquidityUsd))} ${ce(liqStrengthEmoji(liq))} <b>${liqLabel(liq.code, L)}</b>`);

  lines.push(`${ce('📊')} <b>${t('card.volume24h', L)}:</b> ${h(fmtUsd(token.volume24h))}`);

  lines.push(`${ce('⏱️')} <b>${t('card.age', L)}:</b> ${h(ageLabel(audit.breakdown.age, L))}`);
  lines.push('');

  lines.push(formatRiskLine(audit, L, ce, riskLabel));

  if (audit.warnings && audit.warnings.length > 0) {
    const maxW = 3;
    const warnList = audit.warnings.slice(0, maxW);
    lines.push('');
    lines.push(`⚠️ <b>${t('card.warnings', L)}:</b>`);
    for (const w of warnList) {
      const text = typeof w === 'string' ? w : t(w.key, L, w.vars);
      lines.push(`  • ${h(text)}`);
    }
    if (audit.warnings.length > maxW) {
      const moreLbl = L === 'tr' ? `+${audit.warnings.length - maxW} uyarı daha` : `+${audit.warnings.length - maxW} more`;
      lines.push(`  <i>${h(moreLbl)}</i>`);
    }
  }

  lines.push('');
  lines.push(`${ce('💬')} <i>${t('card.readCommentHint', L)}</i>`);

  return lines.join('\n');
}

function formatAnalysisOnly(token, audit, lang = 'en') {
  try {
    const { formatChannelComment } = require('../../channelComment');
    return formatChannelComment(token, audit, lang);
  } catch (e) {
    console.error('[solana/formatter] channelComment:', e?.message);
    return '';
  }
}

function formatRiskBanner({ tokenSymbol, tokenName, initialLiquidity, lastLiquidity, buys5m }, lang = 'en') {
  const L = normalizeLang(lang);
  const lines = [];
  const dropPct = initialLiquidity > 0
    ? ((initialLiquidity - lastLiquidity) / initialLiquidity * 100).toFixed(1)
    : '?';
  lines.push(`⚠️ <b>${t('risk.bannerTitle', L)}</b> ⚠️`);
  if (tokenSymbol || tokenName) {
    const sym = tokenSymbol ? `$${h(tokenSymbol)}` : '';
    const name = tokenName ? ` (${h(tokenName)})` : '';
    lines.push(`🟡 <b>${sym}${name}</b>`);
  }
  const drop = L === 'tr' ? `%${dropPct}` : `${dropPct}%`;
  lines.push(`📉 ${t('risk.liqDrop', L, { pct: drop })}`);
  lines.push(`   ${h(fmtUsd(initialLiquidity))} → ${h(fmtUsd(lastLiquidity))}`);
  if (buys5m === 0) lines.push(`🔇 ${t('risk.noActivity', L)}`);
  lines.push(`👀 <b>${t('risk.advice', L)}</b>`);
  return lines.join('\n');
}

module.exports = {
  formatTokenCard,
  formatAnalysisOnly,
  formatRiskBanner,
  fmtUsd,
  dexLabel,
};
