// Kanal bot yorumu — yalnızca "Bot analizi" başlığı; diğer bölümler ayırıcı + içerik.

const { t, normalizeLang } = require('./i18n');
const { buildAnalysisCommentBody } = require('./analysis');
const { solanaLogoHtml, customEmojiHtml, formatWhitelistKnownProjectBlock } = require('./emojiPack');
const { formatContractSecurityBlock } = require('./contractSecurityBlock');
const { formatLinksTradeBlock, DIVIDER } = require('./commentLinksTrade');

function sectionBlock(titleLine, body) {
  const bodyStr = String(body || '').trim();
  if (!bodyStr) return titleLine;
  return `${titleLine}\n${DIVIDER}\n${bodyStr}`;
}

function dividerBlock(body) {
  const bodyStr = String(body || '').trim();
  if (!bodyStr) return '';
  return `${DIVIDER}\n${bodyStr}`;
}

/** YEŞİL/SARI/KIRMIZI kart açıklaması (slim kartta üstte yok; bot yorumunda). */
function formatRatingBlock(token, lang = 'en', level = 'green') {
  const L = normalizeLang(lang);
  const chain = token?.chain || 'solana';
  const ce = (emoji) => customEmojiHtml(emoji, chain);
  const ratingKey = (level === 'yellow' || level === 'critical' || level === 'red') ? level : 'green';
  const prefix = chain === 'solana' ? 'sol' : (chain === 'bsc' ? 'bsc' : 'ton');

  const wlBlock = formatWhitelistKnownProjectBlock(token, L, chain, t, (s) => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });

  const ratingDot = ratingKey === 'green' ? ce('🟢')
    : ratingKey === 'yellow' || ratingKey === 'critical' ? ce('❤️')
      : ce('🔴');
  const ratingHeader = `${ratingDot} ${t(`${prefix}.rating.${ratingKey}.header`, L)}`;

  if (wlBlock) {
    return [wlBlock, ratingHeader].join('\n');
  }
  return ratingHeader;
}

/** Tam kanal yorum gövdesi (üst başlık: $SYMBOL ayrı eklenir). */
function formatChannelComment(token, audit, lang = 'en', level = 'green') {
  if (!token || !audit) return '';
  const L = normalizeLang(lang);
  const chain = token.chain || 'solana';
  const blocks = [];

  const rating = formatRatingBlock(token, L, level);
  if (rating) blocks.push(rating);

  const analysisBody = buildAnalysisCommentBody(token, audit, L, {
    includeAuditWarnings: false,
    chain,
  });
  blocks.push(sectionBlock(
    `${solanaLogoHtml()} <b>${t('comment.botTitle', L)}</b>`,
    analysisBody || '—',
  ));

  const securityBody = formatContractSecurityBlock(token, L, chain, { skipTitle: true, showHolders: true });
  if (securityBody) blocks.push(dividerBlock(securityBody));

  const linksTrade = formatLinksTradeBlock(token, L);
  if (linksTrade) blocks.push(linksTrade);

  return blocks.join('\n');
}

module.exports = {
  formatChannelComment,
  formatRatingBlock,
};
