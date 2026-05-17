// Kanal yorumu — tek güven kartı; detay Mini App’te.

const { t, normalizeLang } = require('./i18n');
const { safetyPercent, safetyTierLabel, fmtPct, safetyEmoji } = require('./riskDisplay');
const { customEmojiHtml, botLogoHtml } = require('./emojiPack');
const { formatRatingBlock } = require('./channelComment');
const { buildReportPayload } = require('./reportPayload');

const CARD_LINE = '━━━━━━━━━━━━━━━━';

function h(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Tartışma yorumu — rating + güven kartı + uygulama ipucu (buton ayrı). */
function formatTrustTeaserComment(token, audit, lang = 'tr', level = 'green') {
  const L = normalizeLang(lang);
  const chain = token?.chain || 'solana';
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const payload = buildReportPayload(token, audit, L, level);
  const safe = payload.trust.score;
  const em = safetyEmoji(safe, ce);

  const blocks = [];
  const rating = formatRatingBlock(token, L, level);
  if (rating) blocks.push(rating);

  blocks.push(`${botLogoHtml(chain)} <b>${t('comment.botTitle', L)}</b>`);
  blocks.push(CARD_LINE);
  blocks.push(`${ce('🔎')} <b>${t('comment.trustCardTitle', L)}</b>`);
  blocks.push(`${em} <b>${h(payload.trust.scoreLabel)}</b> — <b>${h(payload.trust.tier)}</b>`);
  blocks.push(
    `${ce('🪙')} ${h(payload.summary.liquidityUsd)} · ${h(payload.summary.liquidityWord)}`
    + (payload.summary.age ? ` · ${h(payload.summary.age)}` : ''),
  );
  if (payload.trust.verdict) {
    blocks.push(`<i>${h(payload.trust.verdict)}</i>`);
  }
  blocks.push(CARD_LINE);
  blocks.push(`${ce('👉')} <i>${t('comment.openAppHint', L)}</i>`);

  return blocks.join('\n');
}

module.exports = { formatTrustTeaserComment, CARD_LINE };
