// TON zinciri — Telegram kart HTML (yalnızca TON; BSC `chains/bsc/formatter`).
// HTML mode + <tg-emoji emoji-id="..."> for custom emojis.

const { customEmojiHtml, tonLogoHtml } = require('../../emojiPack');

function _getChainLinks(token) {
  const tokenAddr = token?.tokenAddress || '';
  const poolAddr = token?.poolAddress || '';
  return {
    chain: 'ton',
    chainLabel: 'TON',
    dsUrl: token?.dexScreener?.url || `https://dexscreener.com/ton/${poolAddr}`,
    gtUrl: `https://www.geckoterminal.com/ton/pools/${poolAddr}`,
    explorerUrl: `https://tonviewer.com/${tokenAddr}`,
    explorerName: 'TonViewer',
    explorerEmoji: '💎',
    swapUrl: `https://app.ston.fi/swap?ft=${tokenAddr}&tt=EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez`,
    swapName: 'STON.fi',
    chainEmoji: '💎',
  };
}
const { t, normalizeLang } = require('../../i18n');
const { whitelistTitleSuffix, formatTrustedGreenTitle } = require('../../emojiPack');

function ce(emoji) {
  return customEmojiHtml(emoji, 'ton');
}

function liqStrengthEmoji(liq) {
  if (!liq) return '🟢';
  if (liq.code === 'STRONG') return '⚡';
  return liq.emoji || '🟢';
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

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dexLabel(dex) {
  const map = {
    'dedust': 'DeDust', 'dedust-v2': 'DeDust v2',
    'stonfi': 'STON.fi', 'ston-fi': 'STON.fi', 'stonfi-v2': 'STON.fi v2',
  };
  return map[dex] || dex;
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

function volRatioLabel(vr, lang) {
  if (!vr || vr.ratio === null) return '?';
  const codeMap = { extreme: 'volratio.extreme', high: 'volratio.high', normal: 'volratio.normal', low: 'volratio.low' };
  const txt = t(codeMap[vr.code] || 'volratio.normal', lang);
  return `${vr.ratio.toFixed(2)}× — ${txt}`;
}

function balanceLabel(b, lang) {
  if (!b) return '';
  if (b.code === 'none') return t('txn.none', lang);
  return `${b.buys} / ${b.sells} ${t('txn.balance', lang)}`;
}

function fmtNum(n, lang) {
  const locale = { en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' }[normalizeLang(lang)] || 'en-US';
  try { return n.toLocaleString(locale); } catch { return String(n); }
}

function formatTokenCard(token, audit, lang = 'en', level = 'green', opts = {}) {
  const L = normalizeLang(lang);
  const compact = opts.compact === true;
  const contractInComment = opts.contractInComment === true || compact;
  const lines = [];

  let titleEmoji, titleKey, tokenEmoji;
  if (level === 'yellow') {
    titleEmoji = ce('⚠️');
    titleKey = 'card.title.yellow';
    tokenEmoji = `${ce('🟡')}${ce('⚠️')}`;
  } else if (level === 'critical') {
    titleEmoji = ce('🚨');
    titleKey = 'card.title.critical';
    tokenEmoji = `${ce('🔴')}${ce('🚨')}`;
  } else if (level === 'red') {
    titleEmoji = ce('🚨');
    titleKey = 'card.title.red';
    tokenEmoji = `${ce('⭕')}${ce('🚨')}`;
  } else {
    titleEmoji = ce('🆕');
    titleKey = 'card.newToken';
    tokenEmoji = ce('💎');
  }

  lines.push(`${tokenEmoji} ${tonLogoHtml()}`);
  lines.push('');
  const trustedGreenTitle = level === 'green' ? formatTrustedGreenTitle(token, L, 'ton', t, h) : null;
  if (trustedGreenTitle) {
    for (const row of trustedGreenTitle.split('\n')) lines.push(row);
  } else {
    lines.push(
      `${titleEmoji} <b>${t(titleKey, L)}:</b> $${h(token.tokenSymbol)}${whitelistTitleSuffix(token.trustedWhitelist, L, 'ton', t, h)}`,
    );
  }
  {
    let suffix = '';
    if (level === 'yellow') suffix = ` ${ce('❗')} ${ce('🛰')}`;
    else if (level === 'critical') suffix = ` ${ce('🚨')}`;
    else if (level === 'red') suffix = ` ${ce('🚨')}`;
    lines.push(`${ce('📛')} ${h(token.tokenName)}${suffix}`);
  }
  lines.push(`${ce('🔐')} <b>${t('card.contract', L)}:</b>`);
  lines.push(`<code>${h(token.tokenAddress)}</code>`);
  lines.push('');

  lines.push(`${ce('💲')} <b>${t('card.price', L)}:</b> ${h(fmtUsd(token.priceUsd))}`);
  if (token.fdvUsd) lines.push(`${ce('💰')} <b>${t('card.fdv', L)}:</b> ${h(fmtUsd(token.fdvUsd))}`);
  if (token.marketCapUsd) lines.push(`${ce('📦')} <b>${t('card.mcap', L)}:</b> ${h(fmtUsd(token.marketCapUsd))}`);
  lines.push('');

  const liq = audit.breakdown.liquidity;
  lines.push(`${ce('💧')} <b>${t('card.liquidity', L)}:</b> ${h(fmtUsd(token.liquidityUsd))} ${ce(liqStrengthEmoji(liq))} <b>${liqLabel(liq.code, L)}</b>`);

  if (token.lpBurnAnalysis && token.lpBurnAnalysis.source !== 'unknown') {
    const lp = token.lpBurnAnalysis;
    const totalLocked = lp.burnedPct + lp.lockedPct;
    const lpEmoji = lp.lpLocked ? '🔒' : (totalLocked >= 50 ? '🔓' : '⚠️');
    const lpLbl = L === 'tr' ? 'LP Kilit' : L === 'ru' ? 'LP блок' : 'LP Lock';
    const lpStatus = lp.lpLocked
      ? (L === 'tr' ? 'Kilitli' : L === 'ru' ? 'Заблокирован' : 'Locked')
      : (L === 'tr' ? 'Açık' : L === 'ru' ? 'Открыт' : 'Unlocked');
    lines.push(`${ce(lpEmoji)} <b>${lpLbl}:</b> ${h(lpStatus)} (${totalLocked.toFixed(1)}%)`);
  }

  lines.push(`${ce('📊')} <b>${t('card.volume24h', L)}:</b> ${h(fmtUsd(token.volume24h))}`);
  if (audit.breakdown.volumeLiquidityRatio.ratio !== null) {
    lines.push(`   <i>${t('card.volLiqRatio', L)}:</i> ${h(volRatioLabel(audit.breakdown.volumeLiquidityRatio, L))}`);
  }

  lines.push(`<b>${t('card.price1h', L)}:</b> ${fmtPercent(token.priceChange1h)}`);
  lines.push(`<b>${t('card.price24h', L)}:</b> ${fmtPercent(token.priceChange24h)}`);
  lines.push('');

  lines.push(`${ce('➡️')} <b>${t('card.txns24h', L)}:</b> ${h(balanceLabel(audit.breakdown.buyerSellerBalance, L))}`);

  lines.push(`${ce('⏱️')} <b>${t('card.age', L)}:</b> ${h(ageLabel(audit.breakdown.age, L))}`);

  if (token.contract && !contractInComment) {
    const { formatContractSecurityBlock } = require('../../contractSecurityBlock');
    const block = formatContractSecurityBlock(token, L, 'ton');
    if (block) {
      lines.push(block);
      lines.push('');
    }
  }

  const { formatRiskLine } = require('../../riskDisplay');
  lines.push(formatRiskLine(audit, L, ce, riskLabel));

  if (audit.warnings && audit.warnings.length > 0) {
    const maxW = compact ? 3 : 6;
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

  if (!compact) {
    try {
      const { buildAnalysisOneLine } = require('../../analysis');
      const analysisBlock = buildAnalysisOneLine(token, audit, L, { includeAuditWarnings: false });
      lines.push('');
      lines.push(analysisBlock);
    } catch (e) {
      console.error('analysis err:', e && e.message);
    }
  }

  if (level === 'yellow') {
    lines.push('');
    lines.push(`${ce('⚠️')} <i>${t('card.advice.yellow', L)}</i>`);
  } else if (level === 'critical') {
    lines.push('');
    lines.push(`${ce('🚨')} <i>${t('card.advice.critical', L)}</i>`);
  } else if (level === 'red') {
    lines.push('');
    lines.push(`${ce('🚨')} <i>${t('card.advice.red', L)}</i>`);
    lines.push(`${ce('🕒')} <i>${t('card.autoDeleteNote', L)}</i>`);
  }

  let discKey = 'card.disclaimer';
  if (level === 'yellow') discKey = 'card.disclaimer.yellow';
  else if (level === 'critical') discKey = 'card.disclaimer.critical';
  else if (level === 'red') discKey = 'card.disclaimer.red';
  lines.push('');
  lines.push(`${ce('🔥')} <i>${t(discKey, L)}</i>`);

  lines.push('');
  lines.push(`${ce('💬')} <i>${t('card.readCommentHint', L)}</i>`);

  return lines.join('\n');
}

function formatScamAlert({ tokenSymbol, tokenName, tokenAddress, poolAddress, initialLiquidity, lastLiquidity, removed }, lang = 'en') {
  const L = normalizeLang(lang);
  const lines = [];
  const dropPct = initialLiquidity > 0
    ? ((initialLiquidity - lastLiquidity) / initialLiquidity * 100).toFixed(1)
    : '?';

  const _cl = _getChainLinks({ tokenAddress, poolAddress });
  const explorerUrl = _cl.explorerUrl;
  const dsUrl = _cl.dsUrl;
  const geckoUrl = _cl.gtUrl;
  const swapUrl = _cl.swapUrl;

  lines.push(`${ce('⭕')} <b>${t('scam.title', L)}</b> ${ce('⭕')}`);
  if (tokenName) {
    lines.push(`${ce('⚠️')} <b>$${h(tokenSymbol)}</b> (${h(tokenName)}) — ${t('scam.stayAway', L)}`);
  } else {
    lines.push(`${ce('⚠️')} <b>$${h(tokenSymbol)}</b> — ${t('scam.stayAway', L)}`);
  }
  if (removed) {
    lines.push(`${ce('🚨')} ${t('scam.poolRemoved', L)}`);
  } else {
    const drop = L === 'tr' ? `%${dropPct}` : `${dropPct}%`;
    lines.push(`💧 ${t('scam.liqDrained', L)}: <b>${drop}</b>`);
    if (initialLiquidity > 0 || lastLiquidity > 0) {
      lines.push(`   ${h(fmtUsd(initialLiquidity))} → ${h(fmtUsd(lastLiquidity))}`);
    }
  }
  lines.push('');
  const contractLbl = L === 'tr' ? 'Kontrat' : L === 'ru' ? 'Контракт' : 'Contract';
  lines.push(`${ce('🔐')} <b>${contractLbl}:</b>`);
  lines.push(`<code>${h(tokenAddress)}</code>`);
  lines.push('');
  const sellLbl = L === 'tr' ? 'Acil Sat' : L === 'ru' ? 'Срочно продать' : 'Emergency Sell';
  const verifyLbl = L === 'tr' ? 'Doğrula' : L === 'ru' ? 'Проверить' : 'Verify';
  lines.push(`${ce('💱')} <b>${sellLbl}:</b> <a href="${swapUrl}">${_cl.swapName}</a>`);
  lines.push(`${ce('🔍')} <b>${verifyLbl}:</b> <a href="${dsUrl}">DexScreener</a> • <a href="${geckoUrl}">GeckoTerminal</a> • <a href="${explorerUrl}">${_cl.explorerName}</a>`);

  return lines.join('\n');
}

function formatScamBanner({ tokenSymbol, tokenName, initialLiquidity, lastLiquidity, removed }, lang = 'en') {
  const L = normalizeLang(lang);
  const lines = [];
  const dropPct = initialLiquidity > 0
    ? ((initialLiquidity - lastLiquidity) / initialLiquidity * 100).toFixed(1)
    : '?';

  lines.push(`${ce('⭕')} <b>${t('scam.bannerTitle', L)} — RUG PULL</b> ${ce('⭕')}`);
  if (tokenSymbol || tokenName) {
    const sym = tokenSymbol ? `$${h(tokenSymbol)}` : '';
    const name = tokenName ? ` (${h(tokenName)})` : '';
    lines.push(`${ce('⚠️')} <b>${sym}${name}</b>`);
  }
  if (removed) {
    lines.push(`${ce('🚨')} ${t('scam.poolRemoved', L)}`);
  } else {
    const drop = L === 'tr' ? `%${dropPct}` : `${dropPct}%`;
    lines.push(`💧 ${t('scam.liqDrained', L)}: <b>${drop}</b>`);
    lines.push(`   ${h(fmtUsd(initialLiquidity))} → ${h(fmtUsd(lastLiquidity))}`);
  }
  lines.push(`${ce('🚨')} <b>${t('scam.stayAway', L)}</b>`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  return lines.join('\n');
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
  if (buys5m === 0) {
    lines.push(`🔇 ${t('risk.noActivity', L)}`);
  }
  lines.push(`👀 <b>${t('risk.advice', L)}</b>`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  return lines.join('\n');
}

function formatAnalysisOnly(token, audit, lang = 'en') {
  try {
    const { formatChannelComment } = require('../../channelComment');
    return formatChannelComment(token, audit, lang);
  } catch (e) {
    console.error('channelComment err:', e && e.message);
    return '';
  }
}

module.exports = { formatTokenCard, formatScamAlert, formatScamBanner, formatRiskBanner, formatAnalysisOnly, fmtUsd, fmtPercent };
