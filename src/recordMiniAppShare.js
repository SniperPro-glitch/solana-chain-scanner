// Kanal paylaşımı → Mini App feed (manuel /post + otomatik scan ortak).

const botFeedStore = require('./botFeedStore');

function recordMiniAppShare(ch, token, audit, lang, level, reportId = null) {
  if (!token?.tokenAddress) return null;
  try {
    return botFeedStore.recordShare({
      token,
      audit,
      lang,
      level: level || 'green',
      reportId,
      channelId: ch?.id,
      channelTitle: ch?.title,
    });
  } catch (e) {
    console.warn('[botFeed] record:', e.message);
    return null;
  }
}

module.exports = { recordMiniAppShare };
