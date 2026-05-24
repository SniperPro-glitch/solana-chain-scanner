// Bot ↔ DEX: filtre geçen token → önce Mini App, sonra kanal.

const reportStore = require('./reportStore');
const { buildWebAppUrl, getWebAppBaseUrl } = require('./miniAppServer');
const { recordMiniAppShare } = require('./recordMiniAppShare');
const { isOfficialFeedChannel } = require('./channelFeedPolicy');

/**
 * Tokeni DEX / Mini App'e kaydet, paylaşım URL'si üret.
 */
async function publishToDexFirst(token, audit, lang = 'tr', level = 'green') {
  const reportId = await reportStore.saveReportAsync({
    token,
    audit,
    lang,
    level: level || 'green',
  });
  const dexAppUrl = buildWebAppUrl(reportId);
  const sym = token?.tokenSymbol || token?.tokenAddress?.slice(0, 8) || '?';
  if (dexAppUrl && /^https:\/\//i.test(dexAppUrl)) {
    console.log(`[dex] ${sym} listed → ${dexAppUrl}`);
  } else {
    console.warn(
      `[dex] ${sym} kayıt (${reportId}) — WEB_APP_URL HTTPS değil: ${getWebAppBaseUrl()}`,
    );
  }
  return { reportId, dexAppUrl: dexAppUrl || null };
}

/**
 * Filtre geçti → DEX listesi + (isteğe bağlı) tek kanala kart.
 * Kanal hata verse bile DEX kaydı kalır.
 */
async function publishToDexAndChannel({
  ch,
  token,
  audit,
  chLang,
  cardLevel,
  message,
  banner,
  silent,
  chain,
  sendCardToChannel,
  sendBotAnalysisFollowup,
}) {
  const official = isOfficialFeedChannel(ch?.id);
  const listing = official
    ? await publishToDexFirst(token, audit, chLang, cardLevel)
    : { reportId: null, dexAppUrl: null };
  if (official) {
    recordMiniAppShare(ch, token, audit, chLang, cardLevel, listing.reportId);
  }

  const r = await sendCardToChannel(ch, {
    text: message,
    ...banner,
    silent,
    chain,
  });

  if (!r.ok) {
    console.warn(
      `[publish] ${token?.tokenSymbol || '?'} DEX'e yazıldı ama kanal kartı başarısız: ${r.error}`,
    );
    return { ok: false, dexOk: true, listing, error: r.error };
  }

  const cmEntry = r.messageId ? {
    chatId: ch.id,
    messageId: r.messageId,
    hasPhoto: !!(banner.photoFileId || banner.photoLocalPath),
    originalText: message,
    lang: chLang,
    via: r.via,
  } : null;

  if (cmEntry && sendBotAnalysisFollowup) {
    await sendBotAnalysisFollowup(ch, cmEntry, token, audit, chLang, cardLevel, {
      reportId: listing.reportId,
      dexAppUrl: listing.dexAppUrl,
      includeMiniApp: official,
    });
  }

  return { ok: true, dexOk: true, listing, cmEntry };
}

module.exports = {
  publishToDexFirst,
  publishToDexAndChannel,
};
