// Kanal paylaşımı → Mini App feed (manuel /post + otomatik scan ortak).

const botFeedStore = require('./botFeedStore');

function sharePayload(ch, token, audit, lang, level, reportId) {
  return {
    token,
    audit,
    lang,
    level: level || 'green',
    reportId,
    channelId: ch?.id,
    channelTitle: ch?.title,
  };
}

function recordMiniAppShare(ch, token, audit, lang, level, reportId = null) {
  if (!token?.tokenAddress) return null;
  try {
    return botFeedStore.recordShare(sharePayload(ch, token, audit, lang, level, reportId));
  } catch (e) {
    console.warn('[botFeed] record:', e.message);
    return null;
  }
}

async function recordMiniAppShareAsync(ch, token, audit, lang, level, reportId = null) {
  if (!token?.tokenAddress) return null;
  try {
    return await botFeedStore.recordShareAsync(sharePayload(ch, token, audit, lang, level, reportId));
  } catch (e) {
    console.warn('[botFeed] record async:', e.message);
    return null;
  }
}

module.exports = { recordMiniAppShare, recordMiniAppShareAsync };
