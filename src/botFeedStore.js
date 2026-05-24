// Bot kanalına paylaşılan tokenler → Mini App listesi (dosya veya PostgreSQL).

const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./data-path');
const pg = require('./pgClient');
const { filterFeedEntries } = require('./channelFeedPolicy');

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

function buildEntry({ token, audit, lang, level, reportId, channelId, channelTitle }) {
  const mint = token.tokenAddress;
  return {
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
}

async function recordSharePg(entry) {
  await pg.query('DELETE FROM sc_feed WHERE mint = $1', [entry.mint]);
  await pg.query(
    `INSERT INTO sc_feed (id, mint, posted_at, body) VALUES ($1, $2, $3, $4::jsonb)`,
    [entry.id, entry.mint, entry.postedAt, JSON.stringify(entry)],
  );
  const cutoff = Date.now() - TTL_MS;
  await pg.query('DELETE FROM sc_feed WHERE posted_at < $1', [Date.now() - TTL_MS]).catch(() => {});
  await pg.query(
    `DELETE FROM sc_feed WHERE id NOT IN (
       SELECT id FROM sc_feed ORDER BY posted_at DESC LIMIT $1
     )`,
    [MAX_ITEMS],
  ).catch(() => {});
}

function recordShareFile(entry) {
  const data = load();
  prune(data);
  data.items = (data.items || []).filter((it) => it.mint !== entry.mint);
  data.items.unshift(entry);
  prune(data);
  save(data);
}

function recordShare(opts) {
  if (!opts.token?.tokenAddress) return null;
  const entry = buildEntry(opts);

  if (pg.enabled()) {
    recordSharePg(entry).catch((e) => console.warn('[botFeed] pg record:', e.message));
    console.log(`[botFeed] +1 ${opts.token.tokenSymbol || entry.mint.slice(0, 8)} → PostgreSQL`);
    return entry.id;
  }

  recordShareFile(entry);
  console.log(`[botFeed] +1 ${opts.token.tokenSymbol || entry.mint.slice(0, 8)} → Mini App listesi`);
  return entry.id;
}

/** Admin ekleme — kayıt bitmeden API dönmesin (PostgreSQL). */
async function recordShareAsync(opts) {
  if (!opts.token?.tokenAddress) return null;
  const entry = buildEntry(opts);

  if (pg.enabled()) {
    await recordSharePg(entry);
    console.log(`[botFeed] +1 ${opts.token.tokenSymbol || entry.mint.slice(0, 8)} → PostgreSQL (await)`);
    return entry.id;
  }

  recordShareFile(entry);
  console.log(`[botFeed] +1 ${opts.token.tokenSymbol || entry.mint.slice(0, 8)} → Mini App listesi`);
  return entry.id;
}

async function listRecentPg(limit, tab) {
  const r = await pg.query(
    `SELECT body FROM sc_feed WHERE posted_at > $1 ORDER BY posted_at DESC LIMIT $2`,
    [Date.now() - TTL_MS, Math.min(limit * 2, MAX_ITEMS)],
  );
  let items = r.rows.map((row) => {
    const b = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
    return b;
  });

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
  return filterFeedEntries(items).slice(0, limit);
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

  return filterFeedEntries(items).slice(0, limit);
}

async function listRecentAsync(limit = 48, tab = 'trending') {
  if (pg.enabled()) {
    try {
      return await listRecentPg(limit, tab);
    } catch (e) {
      console.warn('[botFeed] pg list:', e.message);
    }
  }
  return listRecent(limit, tab);
}

/** Tüm kanal listesi (arama için, en fazla MAX_ITEMS). */
async function listAllAsync() {
  return listRecentAsync(MAX_ITEMS, 'trending');
}

/** Feed'de mint zaten var mı (TTL içinde). */
async function findByMintAsync(mint) {
  const key = String(mint || '').trim();
  if (!key) return null;

  if (pg.enabled()) {
    try {
      const r = await pg.query(
        'SELECT body FROM sc_feed WHERE mint = $1 AND posted_at > $2 ORDER BY posted_at DESC LIMIT 1',
        [key, Date.now() - TTL_MS],
      );
      if (r.rows[0]) {
        const b = r.rows[0].body;
        return typeof b === 'string' ? JSON.parse(b) : b;
      }
      return null;
    } catch (e) {
      console.warn('[botFeed] findByMint pg:', e.message);
    }
  }

  const data = load();
  prune(data);
  return (data.items || []).find((it) => it.mint === key) || null;
}

async function feedCountAsync() {
  if (!pg.enabled()) return feedCount();
  try {
    const r = await pg.query(
      'SELECT COUNT(*)::int AS c FROM sc_feed WHERE posted_at > $1',
      [Date.now() - TTL_MS],
    );
    return r.rows[0]?.c || 0;
  } catch {
    return 0;
  }
}

function feedCount() {
  const data = load();
  return (data.items || []).length;
}

async function migrateFileToPg() {
  if (!pg.enabled() || !fs.existsSync(FEED_FILE)) return 0;
  const data = load();
  let n = 0;
  for (const entry of data.items || []) {
    try {
      await recordSharePg(entry);
      n += 1;
    } catch {
      /* skip */
    }
  }
  return n;
}

module.exports = {
  recordShare,
  recordShareAsync,
  listRecent,
  listRecentAsync,
  listAllAsync,
  findByMintAsync,
  feedCount,
  feedCountAsync,
  migrateFileToPg,
  FEED_FILE,
};
