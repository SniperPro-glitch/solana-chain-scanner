// BSC zinciri — Telegram kart HTML (yalnızca BSC; TON `chains/ton/formatter`).
// HTML mode + <tg-emoji emoji-id="..."> for custom emojis.

const { customEmojiHtml } = require('../../emojiPack');

function _getChainLinks(token) {
  const tokenAddr = token?.tokenAddress || '';
  const poolAddr = token?.poolAddress || '';
  return {
    chain: 'bsc',
    chainLabel: 'BSC',
    dsUrl: token?.dexScreener?.url || `https://dexscreener.com/bsc/${poolAddr}`,
    gtUrl: `https://www.geckoterminal.com/bsc/pools/${poolAddr}`,
    explorerUrl: `https://bscscan.com/token/${tokenAddr}`,
    explorerName: 'BscScan',
    explorerEmoji: '🌐',
    swapUrl: `https://pancakeswap.finance/swap?outputCurrency=${tokenAddr}`,
    swapName: 'PancakeSwap',
    chainEmoji: '🟡',
  };
}
const { t, normalizeLang } = require('../../i18n');
const { whitelistTitleSuffix, formatTrustedGreenTitle } = require('../../emojiPack');

function ce(emoji) {
  return customEmojiHtml(emoji, 'bsc');
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
  const d = String(dex || '').toLowerCase();
  const map = {
    pancakeswap: 'PancakeSwap',
    'pancakeswap-v2': 'PancakeSwap v2',
    'pancakeswap-v3': 'PancakeSwap v3',
    pcs: 'PancakeSwap',
    uniswap: 'Uniswap',
    'uniswap-v2': 'Uniswap v2',
    'uniswap-v3': 'Uniswap v3',
    biswap: 'BiSwap',
    sushiswap: 'SushiSwap',
    ape: 'ApeSwap',
    thena: 'Thena',
    pancakeswapinfinity: 'PancakeSwap Infinity',
  };
  return map[d] || dex;
}

// ─── Liquidity level label ───
function liqLabel(code, lang) {
  const map = {
    POOR: 'liq.poor', WEAK: 'liq.weak', OK: 'liq.ok', GOOD: 'liq.good', STRONG: 'liq.strong',
  };
  return t(map[code] || 'liq.ok', lang);
}

// ─── Risk level label ───
function riskLabel(code, lang) {
  const map = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  return t(map[code] || 'risk.medium', lang);
}

// ─── Age label ───
function ageLabel(age, lang) {
  if (!age || age.code === 'unknown') return '?';
  if (age.code === 'minutesNew') return `${age.value} ${t('age.minutesNew', lang)}`;
  if (age.code === 'minutes') return `${age.value} ${t('age.minutes', lang)}`;
  if (age.code === 'hours') return `${age.hours}${t('age.hours', lang)} ${age.minutes}${t('age.minutes', lang)}`;
  if (age.code === 'days') return `${age.value} ${t('age.days', lang)}`;
  return '?';
}

// ─── Vol/Liq ratio label ───
function volRatioLabel(vr, lang) {
  if (!vr || vr.ratio === null) return '?';
  const codeMap = { extreme: 'volratio.extreme', high: 'volratio.high', normal: 'volratio.normal', low: 'volratio.low' };
  const txt = t(codeMap[vr.code] || 'volratio.normal', lang);
  return `${vr.ratio.toFixed(2)}× — ${txt}`;
}

// ─── Buyer/Seller balance label ───
function balanceLabel(b, lang) {
  if (!b) return '';
  if (b.code === 'none') return t('txn.none', lang);
  return `${b.buys} / ${b.sells} ${t('txn.balance', lang)}`;
}

// ─── Number locale ───
function fmtNum(n, lang) {
  const locale = { en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' }[normalizeLang(lang)] || 'en-US';
  try { return n.toLocaleString(locale); } catch { return String(n); }
}

// ─────────────────────────────────────────────────────────────
// Main token card
// level: 'green' | 'yellow' | 'critical' | 'red'  — sadece görsel/başlık/tavsiye değişir,
//        veri (fiyat, likidite, risk skoru vs.) hep aynı şekilde basılır.
//   green    : yeni token, düşük risk
//   yellow   : MEDIUM risk (uyarı)
//   critical : KRİTİK risk (kırmızı kart, paylaşılırken — rug riski yüksek)
//   red      : SCAM tespit edildi (rug oldu, sonradan + auto-delete)
// ─────────────────────────────────────────────────────────────
function formatTokenCard(token, audit, lang = 'en', level = 'green', opts = {}) {
  const L = normalizeLang(lang);
  const compact = opts.compact === true;
  const noAnalysis = opts.noAnalysis === true; // Caption'a sığmazsa analizi atla, ayrı reply gönderilir
  // detailsToReply=true: rating block, kontrat güvenliği, uyarılar, advice, disclaimer
  //   ana karttan çıkartılır (yorum mesajına taşınır). Caption 1024 sınırına sığsın diye.
  const detailsToReply = opts.detailsToReply === true;
  // slim=true: rating block + Bot Analizi + advice + disclaimer kartın dışında kalır.
  //   Kontrat güvenliği + uyarılar + linkler KALır. Tek kart, 1024 caption'a sığar.
  const slim = opts.slim === true;
  const contractInComment = opts.contractInComment === true || slim;
  const lines = [];

  // Başlık emoji + key (level'a göre)
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

  // ─── Kart başı — risk derecelendirme açıklaması (BSC SCANNER BOT MESAJI) ───
  // Her seviyede kısa bir blok: yuvarlak emoji + başlık + açıklama + imza
  // detailsToReply=true VEYA slim=true ise bu blok atlanır.
  if (!detailsToReply && !slim) {
    const ratingKey = (level === 'yellow' || level === 'critical' || level === 'red') ? level : 'green';
    const ratingDot = ratingKey === 'green' ? ce('🟢')
                    : ratingKey === 'yellow' ? ce('🟡')
                    : ratingKey === 'critical' ? ce('🟠')
                    : ce('🔴');
    lines.push(`${ratingDot} ${t(`bsc.rating.${ratingKey}.header`, L)}`);
    lines.push(t(`bsc.rating.${ratingKey}.body`, L));
    lines.push(t('bsc.rating.signature', L));
    lines.push('');
  }

  // BSC layout: üst banner satırı yok, BINANCE yazısı yok. Sade satır: BSC flama + titleEmoji + symbol
  const bscFlag = ce('🛒'); // BSC flama (5 BSC custom emoji #1)
  const trustedGreenTitle = level === 'green' ? formatTrustedGreenTitle(token, L, 'bsc', t, h) : null;
  if (trustedGreenTitle) {
    const titleRows = trustedGreenTitle.split('\n');
    lines.push(`${bscFlag} ${titleRows[0]}`);
    for (let i = 1; i < titleRows.length; i++) lines.push(titleRows[i]);
  } else {
    lines.push(
      `${bscFlag} ${titleEmoji} <b>${t(titleKey, L)}:</b> $${h(token.tokenSymbol)}${whitelistTitleSuffix(token.trustedWhitelist, L, 'bsc', t, h)}`,
    );
  }
  {
    let suffix = '';
    if (level === 'yellow') suffix = ` ${ce('❗')} ${ce('🛰')}`;
    else if (level === 'critical') suffix = ` ${ce('🚨')}`;
    else if (level === 'red') suffix = ` ${ce('🚨')}`;
    // PancakeSwap Token satırı — 📛 sarı ok yerine 🥞 PancakeSwap logosu
    lines.push(`${ce('🥞')} ${h(token.tokenName)}${suffix}`);
  }
  // Contract (BSC → 🔐 geri — etiket kaldırıldı)
  lines.push(`${ce('🔐')} <b>${t('card.contract', L)}:</b>`);
  lines.push(`<code>${h(token.tokenAddress)}</code>`);
  lines.push('');

  // Price & market
  lines.push(`${ce('💲')} <b>${t('card.price', L)}:</b> ${h(fmtUsd(token.priceUsd))}`);
  if (token.fdvUsd) lines.push(`${ce('💰')} <b>${t('card.fdv', L)}:</b> ${h(fmtUsd(token.fdvUsd))}`);
  if (token.marketCapUsd) lines.push(`${ce('📦')} <b>${t('card.mcap', L)}:</b> ${h(fmtUsd(token.marketCapUsd))}`);
  lines.push('');

  // Likidite (💧 BSC paketinde BNB logosu ile eşlenir)
  const liq = audit.breakdown.liquidity;
  lines.push(`${ce('💧')} <b>${t('card.liquidity', L)}:</b> ${h(fmtUsd(token.liquidityUsd))} ${ce(liqStrengthEmoji(liq))} <b>${liqLabel(liq.code, L)}</b>`);

  // LP Burn / Lock durumu (on-chain gerçek veri)
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

  // Volume
  lines.push(`${ce('📊')} <b>${t('card.volume24h', L)}:</b> ${h(fmtUsd(token.volume24h))}`);
  if (audit.breakdown.volumeLiquidityRatio.ratio !== null) {
    lines.push(`   <i>${t('card.volLiqRatio', L)}:</i> ${h(volRatioLabel(audit.breakdown.volumeLiquidityRatio, L))}`);
  }

  // Price change
  lines.push(`<b>${t('card.price1h', L)}:</b> ${fmtPercent(token.priceChange1h)}`);
  lines.push(`<b>${t('card.price24h', L)}:</b> ${fmtPercent(token.priceChange24h)}`);
  lines.push('');

  // Txn balance
  lines.push(`${ce('➡️')} <b>${t('card.txns24h', L)}:</b> ${h(balanceLabel(audit.breakdown.buyerSellerBalance, L))}`);

  // Age
  lines.push(`${ce('⏱️')} <b>${t('card.age', L)}:</b> ${h(ageLabel(audit.breakdown.age, L))}`);

  // DEX (BSC → 🥞 pancake logo) + 🛒 Satın Al linki (PancakeSwap swap)
  // NOT: <a> içine <tg-emoji> koyma — Telegram bazı client'larda link açılmıyor.
  //       Emoji link DIŞINDA, sadece "Satın Al" tıklanabilir link olarak kalır.
  // Kontrat güvenliği → bot yorumu (slim / contractInComment)
  if (token.contract && !detailsToReply && !contractInComment) {
    const { formatContractSecurityBlock } = require('../../contractSecurityBlock');
    const block = formatContractSecurityBlock(token, L, 'bsc');
    if (block) {
      lines.push(block);
      lines.push('');
    }
  }

  // Risk
  const { formatRiskLine } = require('../../riskDisplay');
  lines.push(formatRiskLine(audit, L, ce, riskLabel));

  // Warnings — detailsToReply=true ise atlanır (yoruma taşınır)
  if (audit.warnings && audit.warnings.length > 0 && !detailsToReply) {
    const maxW = (slim || compact) ? 3 : 6;
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

  // detailsToReply=true ise: ana kartın sonuna yönlendirici — "$X token bot yorumu, ek bilgiler altta"
  // slim=true ise: yönlendirici de gerekmez (tek kart).
  if (detailsToReply && !slim) {
    lines.push('');
    lines.push(`${ce('💬')} <i>$${h(token.tokenSymbol)} token bot yorumu — ek bilgiler altta ⬇️</i>`);
  }

  // Bot Analizi (kural-bazlı yorum bloğu) — BSC kartlarında her zaman görünür.
  // Caption limiti 1024 — noAnalysis=true VEYA detailsToReply=true VEYA slim=true ise atla.
  if (!noAnalysis && !detailsToReply && !slim) {
    try {
      const { buildAnalysisOneLine } = require('../../analysis');
      const analysisBlock = buildAnalysisOneLine(token, audit, L, { includeAuditWarnings: false });
      lines.push('');
      lines.push(analysisBlock);
    } catch (e) {
      console.error('analysis err:', e && e.message);
    }
  }

  // ─── Level'a göre tavsiye satırı + disclaimer ───
  // detailsToReply=true VEYA slim=true ise advice + disclaimer atlanır.
  if (!detailsToReply && !slim) {
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

    // Disclaimer (level'a göre)
    let discKey = 'card.disclaimer';
    if (level === 'yellow') discKey = 'card.disclaimer.yellow';
    else if (level === 'critical') discKey = 'card.disclaimer.critical';
    else if (level === 'red') discKey = 'card.disclaimer.red';
    lines.push('');
    lines.push(`${ce('🔥')} <i>${t(discKey, L)}</i>`);
  }

  lines.push('');
  lines.push(`${ce('💬')} <i>${t('card.readCommentHint', L)}</i>`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// DETAILS REPLY — yorum mesajı için
// Ana karttan çıkartılan blokları tek mesajda toplar:
//   - Rating block (YEŞİL/SARI/KIRMIZI kart açıklaması)
//   - Kontrat Güvenliği
//   - Uyarılar
//   - Bot Analizi
//   - Advice (varsa)
//   - Disclaimer
// ─────────────────────────────────────────────────────────────
function formatDetailsReply(token, audit, lang = 'en', level = 'green') {
  const L = normalizeLang(lang);
  const lines = [];

  // Yorum başlığı — "$X token yorumu"
  lines.push(`${ce('💬')} <b>$${h(token.tokenSymbol)} token yorumu</b>`);
  lines.push('────────────────────');
  lines.push('');

  // Rating block
  const ratingKey = (level === 'yellow' || level === 'critical' || level === 'red') ? level : 'green';
  const ratingDot = ratingKey === 'green' ? ce('🟢')
                  : ratingKey === 'yellow' ? ce('🟡')
                  : ratingKey === 'critical' ? ce('🟠')
                  : ce('🔴');
  lines.push(`${ratingDot} ${t(`bsc.rating.${ratingKey}.header`, L)}`);
  lines.push(t(`bsc.rating.${ratingKey}.body`, L));
  lines.push(t('bsc.rating.signature', L));
  lines.push('');

  // Kontrat Güvenliği
  if (token.contract) {
    const c = token.contract;
    lines.push(`${ce('🔐')} <b>${t('card.contractSecurity', L)}</b>`);
    if (c.mintable === false) lines.push(`✅ ${t('card.mintLocked', L)}`);
    else if (c.mintable === true) lines.push(`⚠️ ${t('card.mintOpen', L)}`);
    if (c.adminAddress === null) lines.push(`✅ ${t('card.ownerRenounced', L)}`);
    else if (c.adminAddress) {
      const short = c.adminAddress.slice(0, 6) + '...' + c.adminAddress.slice(-4);
      lines.push(`⚠️ ${t('card.ownerActive', L)}: <code>${h(short)}</code>`);
    }
    if (c.topHolderPct !== null && c.topHolderPct !== undefined) {
      const p = c.topHolderPct;
      const ic = p > 50 ? '🔴' : p > 20 ? '🟠' : p > 10 ? ce('🟡') : ce('🟢');
      lines.push(`${ic} ${t('card.topHolder', L)}: <b>${p.toFixed(1)}%</b>`);
    }
    if (c.top10Pct !== null && c.top10Pct !== undefined) {
      const p = c.top10Pct;
      const ic = p > 80 ? '🔴' : p > 60 ? '🟠' : p > 40 ? ce('🟡') : ce('🟢');
      lines.push(`${ic} ${t('card.top10', L)}: <b>${p.toFixed(1)}%</b>`);
    }
    if (c.verification === 'whitelist') lines.push(`✅ ${t('card.verified', L)}`);
    else if (c.verification === 'blacklist') lines.push(`🚫 Blacklisted`);
    lines.push('');
  }

  // Uyarılar
  if (audit.warnings && audit.warnings.length > 0) {
    lines.push(`⚠️ <b>${t('card.warnings', L)}:</b>`);
    for (const w of audit.warnings) {
      const text = typeof w === 'string' ? w : t(w.key, L, w.vars);
      lines.push(`  • ${h(text)}`);
    }
    lines.push('');
  }

  // Bot Analizi
  try {
    const { buildAnalysisOneLine } = require('../../analysis');
    const analysisBlock = buildAnalysisOneLine(token, audit, L, { includeAuditWarnings: false });
    lines.push(analysisBlock);
  } catch (e) {
    console.error('analysis err:', e && e.message);
  }

  // Advice (level'a göre)
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

  // Disclaimer
  let discKey = 'card.disclaimer';
  if (level === 'yellow') discKey = 'card.disclaimer.yellow';
  else if (level === 'critical') discKey = 'card.disclaimer.critical';
  else if (level === 'red') discKey = 'card.disclaimer.red';
  lines.push('');
  lines.push(`${ce('🔥')} <i>${t(discKey, L)}</i>`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// SCAM ALERT — full message (fallback when original post not editable)
// ─────────────────────────────────────────────────────────────
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
  // Contract address — kullanıcı cebinden satmak isteyebilir
  const contractLbl = L === 'tr' ? 'Kontrat' : L === 'ru' ? 'Контракт' : 'Contract';
  lines.push(`${ce('🔐')} <b>${contractLbl}:</b>`);
  lines.push(`<code>${h(tokenAddress)}</code>`);
  lines.push('');
  // Sat / kontrol linkleri — kullanıcı acilen kontrol etmek/satmak isteyebilir
  const sellLbl = L === 'tr' ? 'Acil Sat' : L === 'ru' ? 'Срочно продать' : 'Emergency Sell';
  const verifyLbl = L === 'tr' ? 'Doğrula' : L === 'ru' ? 'Проверить' : 'Verify';
  lines.push(`${ce('💱')} <b>${sellLbl}:</b> <a href="${swapUrl}">${_cl.swapName}</a>`);
  lines.push(`${ce('🔍')} <b>${verifyLbl}:</b> <a href="${dsUrl}">DexScreener</a> • <a href="${geckoUrl}">GeckoTerminal</a> • <a href="${explorerUrl}">${_cl.explorerName}</a>`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// SCAM banner — short header prepended to original post
// ─────────────────────────────────────────────────────────────
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

// Bot Analysis bloğu — ana kart caption'a sığmazsa ayrı reply olarak göndermek için
function formatAnalysisOnly(token, audit, lang = 'en') {
  try {
    const { formatChannelComment } = require('../../channelComment');
    return formatChannelComment(token, audit, lang);
  } catch (e) {
    console.error('channelComment err:', e && e.message);
    return '';
  }
}

module.exports = { formatTokenCard, formatScamAlert, formatScamBanner, formatRiskBanner, formatAnalysisOnly, formatDetailsReply, fmtUsd, fmtPercent };
