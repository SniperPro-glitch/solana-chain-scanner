// Bot kanalına paylaşılan tokenler → Mini App listesi (tek akış).

const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./data-path');

const FEED_FILE = path.join(DATA_DIR, 'bot_feed.json');
const MAX_ITEMS = 400;
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

function load() {
  try {
    ensureDataDir();
    if (!fs.existsSync(FEED_FILE)) return { items: [] };
    return JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  } catch (e) {
    console.warn('[botFeed] load:', e.message);
    return { items: [] };
  }
}

function save(data) {
  ensureDataDir();
  fs.writeFileSync(FEED_FILE, JSON.stringify(data, null, 0));
}

function prune(data) {
  const now = Date.now();
  data.items = (data.items || [])
    .filter((it) => now - (it.postedAt || 0) < TTL_MS)
    .slice(0, MAX_ITEMS);
}

/**
 * Kanala paylaşılan token (sendBotAnalysisFollowup sonrası).
 */
function recordShare({ token, audit, lang, level, reportId, channelId, channelTitle }) {
  if (!token?.tokenAddress) return null;
  const data = load();
  prune(data);

  const mint = token.tokenAddress;
  data.items = (data.items || []).filter((it) => it.mint !== mint);

  const entry = {
    id: `${mint}-${Date.now()}`,
    mint,
    poolId: token.poolId,
    reportId: reportId || null,
    postedAt: Date.now(),
    lang: lang || 'tr',
    level: level || 'green',
    channelId: channelId || null,
    channelTitle: channelTitle || null,
    token: JSON.parse(JSON.stringify(token)),
    riskCode: audit?.risk?.code || null,
    riskPercent: audit?.riskPercent ?? null,
    isCritical: !!audit?.isCritical,
  };

  data.items.unshift(entry);
  prune(data);
  save(data);
  console.log(`[botFeed] +1 ${token.tokenSymbol || token.tokenAddress?.slice(0, 8)} → Mini App listesi`);
  return entry.id;
}

function listRecent(limit = 48, tab = 'trending') {
  const data = load();
  prune(data);
  let items = [...(data.items || [])];

  if (tab === 'new') {
    items.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  } else {
    items.sort((a, b) => {
      const va = a.token?.volume24h || 0;
      const vb = b.token?.volume24h || 0;
      if (vb !== va) return vb - va;
      return (b.postedAt || 0) - (a.postedAt || 0);
    });
  }

  return items.slice(0, limit);
}

function feedCount() {
  const data = load();
  return (data.items || []).length;
}

module.exports = {
  recordShare,
  listRecent,
  feedCount,
  FEED_FILE,
};
