/**
 * Mini App feed / DEX kaydı — yalnızca resmi kanallar.
 * Diğer kanallar: scanner (kart post), app listesine ve Web App butonuna girmez.
 */

function parseChannelIdList(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let warnedNoOfficialIds = false;

/** @returns {Set<string>} */
function getOfficialFeedChannelIdSet() {
  const explicit = parseChannelIdList(process.env.MINI_APP_FEED_CHANNEL_IDS);
  if (explicit.length) return new Set(explicit);
  const fromEnv = [
    ...parseChannelIdList(process.env.TELEGRAM_CHANNEL_IDS),
    ...parseChannelIdList(process.env.CHANNEL_IDS),
    ...parseChannelIdList(process.env.TELEGRAM_CHANNEL_ID),
  ];
  return new Set(fromEnv);
}

function isFeedPolicyConfigured() {
  return getOfficialFeedChannelIdSet().size > 0
    || String(process.env.MINI_APP_FEED_CHANNEL_IDS || '').trim() !== '';
}

/**
 * Resmi kanal veya admin panel kaynağı → Mini App feed + DEX raporu.
 * MINI_APP_FEED_CHANNEL_IDS yoksa TELEGRAM_CHANNEL_IDS kullanılır.
 * Hiçbiri yoksa uyumluluk: tüm kanallar resmi sayılır (geliştirme).
 */
function isOfficialFeedChannel(channelId) {
  const id = String(channelId || '').trim();
  if (!id) return false;
  if (id === 'admin-panel') return true;

  const official = getOfficialFeedChannelIdSet();
  if (official.size === 0) {
    if (!warnedNoOfficialIds) {
      warnedNoOfficialIds = true;
      console.warn(
        '[feed-policy] MINI_APP_FEED_CHANNEL_IDS / TELEGRAM_CHANNEL_IDS tanımlı değil — '
        + 'tüm kanal paylaşımları Mini App feed\'e yazılabilir (üretimde resmi kanal ID ekleyin).',
      );
    }
    return true;
  }
  return official.has(id);
}

function filterFeedEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!isFeedPolicyConfigured() && getOfficialFeedChannelIdSet().size === 0) {
    return list;
  }
  return list.filter((e) => isOfficialFeedChannel(e?.channelId));
}

function getOfficialFeedChannelIds() {
  return [...getOfficialFeedChannelIdSet()];
}

module.exports = {
  parseChannelIdList,
  getOfficialFeedChannelIdSet,
  getOfficialFeedChannelIds,
  isOfficialFeedChannel,
  isFeedPolicyConfigured,
  filterFeedEntries,
};
