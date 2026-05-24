// Kanal paylaşımı → Mini App feed (yalnızca resmi kanallar).

const botFeedStore = require('./botFeedStore');
const { isOfficialFeedChannel } = require('./channelFeedPolicy');

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
  if (!isOfficialFeedChannel(ch?.id)) return null;
  try {
    return botFeedStore.recordShare(sharePayload(ch, token, audit, lang, level, reportId));
  } catch (e) {
    console.warn('[botFeed] record:', e.message);
    return null;
  }
}

async function recordMiniAppShareAsync(ch, token, audit, lang, level, reportId = null) {
  if (!token?.tokenAddress) return null;
  if (!isOfficialFeedChannel(ch?.id)) return null;
  try {
    return await botFeedStore.recordShareAsync(sharePayload(ch, token, audit, lang, level, reportId));
  } catch (e) {
    console.warn('[botFeed] record async:', e.message);
    return null;
  }
}

module.exports = { recordMiniAppShare, recordMiniAppShareAsync };
