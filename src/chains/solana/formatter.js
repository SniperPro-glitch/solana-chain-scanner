// Solana zinciri — Telegram kart (BSC slim ile aynı yapı; metin/emoji Solana).

const {
  customEmojiHtml,
  dexEmojiCharFor,
  whitelistTitleSuffix,
  formatTrustedGreenTitle,
  solanaNewTokenFlagHtml,
} = require('../../emojiPack');
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

function fmtPercent(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  const emoji = n > 0 ? ce('📊') : n < 0 ? ce('🌡') : '➖';
  return `${emoji} ${sign}${n.toFixed(2)}%`;
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

function volRatioLabel(vr, lang) {
  if (!vr || vr.ratio === null) return '?';
  const codeMap = { extreme: 'volratio.extreme', high: 'volratio.high', normal: 'volratio.normal', low: 'volratio.low' };
  return `${vr.ratio.toFixed(2)}× — ${t(codeMap[vr.code] || 'volratio.normal', lang)}`;
}

function balanceLabel(b, lang) {
  if (!b) return '';
  if (b.code === 'none') return t('txn.none', lang);
  return `${b.buys} / ${b.sells} ${t('txn.balance', lang)}`;
}

function dexLabel(dex) {
  const d = String(dex || '').toLowerCase();
  const map = {
    raydium: 'Raydium',
    'raydium-clmm': 'Raydium CLMM',
    orca: 'Orca',
    meteora: 'Meteora',
    meteora_dlmm: 'Meteora DLMM',
    pumpswap: 'PumpSwap',
    pumpfun: 'Pump.fun',
    jupiter: 'Jupiter',
  };
  return map[d] || dex;
}

/**
 * Üst kart — BSC slim ile aynı alanlar; analiz/kontrat güvenliği yorumda.
 * opts.slim / opts.compact → aynı layout.
 */
function formatTokenCard(token, audit, lang = 'en', level = 'green', opts = {}) {
  const L = normalizeLang(lang);
  const slim = opts.slim === true || opts.compact === true;
  const contractInComment = true;
  const lines = [];

  let titleEmoji;
  let titleKey;
  let tokenEmoji;
  if (level === 'yellow') {
    titleEmoji = ce('❤️');
    titleKey = 'card.title.yellow';
    tokenEmoji = `${ce('🟡')}${ce('❤️')}`;
  } else if (level === 'critical') {
    titleEmoji = ce('🚨');
    titleKey = 'card.title.critical';
    tokenEmoji = `${ce('🔴')}${ce('🚨')}`;
  } else if (level === 'red') {
    titleEmoji = ce('⭕');
    titleKey = 'card.title.red';
    tokenEmoji = `${ce('⭕')}${ce('🚨')}`;
  } else {
    titleEmoji = ce('🆕');
    titleKey = 'card.newToken';
    tokenEmoji = ce('◎');
  }

  const trustedGreenTitle = level === 'green' ? formatTrustedGreenTitle(token, L, 'solana', t, h) : null;
  if (trustedGreenTitle) {
    for (const row of trustedGreenTitle.split('\n')) lines.push(row);
  } else {
    const titleFlag = level === 'green' ? solanaNewTokenFlagHtml('solana') : ce('🪙');
    lines.push(
      `${titleFlag} ${titleEmoji} <b>${t(titleKey, L)}:</b> $${h(token.tokenSymbol)}${whitelistTitleSuffix(token.trustedWhitelist, L, 'solana', t, h)}`,
    );
  }
  if (token.dex) {
    lines.push(`${ce(dexEmojiCharFor(token))} <b>${t('card.dex', L)}:</b> ${h(dexLabel(token.dex))}`);
  }

  lines.push(`${ce('🪙')} <b>${t('card.contract', L)}:</b>`);
  lines.push(`<code>${h(token.tokenAddress)}</code>`);
  lines.push('');

  lines.push(`${ce('💲')} <b>${t('card.price', L)}:</b> ${h(fmtUsd(token.priceUsd))}`);
  if (token.fdvUsd) lines.push(`${ce('💲')} <b>${t('card.fdv', L)}:</b> ${h(fmtUsd(token.fdvUsd))}`);
  if (token.marketCapUsd) lines.push(`${ce('📦')} <b>${t('card.mcap', L)}:</b> ${h(fmtUsd(token.marketCapUsd))}`);
  lines.push('');

  lines.push(`${ce('📊')} <b>${t('card.volume24h', L)}:</b> ${h(fmtUsd(token.volume24h))}`);
  if (audit.breakdown.volumeLiquidityRatio.ratio !== null) {
    lines.push(`   <i>${t('card.volLiqRatio', L)}:</i> ${h(volRatioLabel(audit.breakdown.volumeLiquidityRatio, L))}`);
  }

  lines.push(`<b>${t('card.price1h', L)}:</b> ${fmtPercent(token.priceChange1h)}`);
  lines.push(`<b>${t('card.price24h', L)}:</b> ${fmtPercent(token.priceChange24h)}`);
  lines.push('');

  lines.push(`${ce('➡️')} <b>${t('card.txns24h', L)}:</b> ${h(balanceLabel(audit.breakdown.buyerSellerBalance, L))}`);
  lines.push(`${ce('⏱️')} <b>${t('card.age', L)}:</b> ${h(ageLabel(audit.breakdown.age, L))}`);
  lines.push(formatRiskLine(audit, L, ce, riskLabel));

  if (audit.warnings && audit.warnings.length > 0) {
    const maxW = slim ? 3 : 6;
    const warnList = audit.warnings.slice(0, maxW);
    lines.push('');
    lines.push(`${ce('❤️')} <b>${t('card.warnings', L)}:</b>`);
    for (const w of warnList) {
      const key = typeof w === 'string' ? null : w?.key;
      if (key === 'warn.veryNew') continue;
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

function formatAnalysisOnly(token, audit, lang = 'en', level = 'green') {
  try {
    const { formatChannelComment } = require('../../channelComment');
    return formatChannelComment(token, audit, lang, level);
  } catch (e) {
    console.error('[solana/formatter] channelComment:', e?.message);
    return '';
  }
}

function formatRiskBanner({ tokenSymbol, tokenName, initialLiquidity, lastLiquidity, buys5m }, lang = 'en') {
  const L = normalizeLang(lang);
  const att = ce('❤️');
  const lines = [];
  const dropPct = initialLiquidity > 0
    ? ((initialLiquidity - lastLiquidity) / initialLiquidity * 100).toFixed(1)
    : '?';
  lines.push(`${att} <b>${t('risk.bannerTitle', L)}</b> ${att}`);
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
