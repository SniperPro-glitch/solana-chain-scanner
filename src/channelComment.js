// Kanal bot yorumu — yalnızca "Bot analizi" başlığı; diğer bölümler ayırıcı + içerik.

const { t, normalizeLang } = require('./i18n');
const { buildAnalysisCommentBody } = require('./analysis');
const { botLogoHtml } = require('./emojiPack');
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

/** Tam kanal yorum gövdesi (üst başlık: $SYMBOL ayrı eklenir). */
function formatChannelComment(token, audit, lang = 'en') {
  if (!token || !audit) return '';
  const L = normalizeLang(lang);
  const chain = token.chain || 'solana';
  const blocks = [];

  const analysisBody = buildAnalysisCommentBody(token, audit, L, {
    includeAuditWarnings: false,
    chain,
  });
  blocks.push(sectionBlock(
    `${botLogoHtml(chain)} <b>${t('comment.botTitle', L)}</b>`,
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
};
