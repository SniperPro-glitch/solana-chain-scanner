// DM /start ve Mini App — duyuru listesi (kanal takibi şart değil).

const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./data-path');

const STORE_FILE = path.join(DATA_DIR, 'bot_subscribers.json');
const PG_KEY = 'bot_subscribers';

function emptyState() {
  return { subscribers: {}, updatedAt: null };
}

function loadFile() {
  try {
    ensureDataDir();
    if (!fs.existsSync(STORE_FILE)) return emptyState();
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!raw.subscribers || typeof raw.subscribers !== 'object') return emptyState();
    return raw;
  } catch (e) {
    console.warn('[subscribers] dosya okuma:', e.message);
    return emptyState();
  }
}

let cache = loadFile();

function save(state, opts = {}) {
  cache = state;
  cache.updatedAt = new Date().toISOString();
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.warn('[subscribers] dosya yazma:', e.message);
  }
  if (!opts.skipPg) {
    try {
      const pg = require('./pgClient');
      if (pg.enabled()) {
        require('./pgStateStore').save(PG_KEY, cache).catch((err) => {
          console.warn('[subscribers] pg save:', err.message);
        });
      }
    } catch (e) {
      console.warn('[subscribers] pg:', e.message);
    }
  }
}

async function reloadFromPostgres() {
  try {
    const pg = require('./pgClient');
    if (!pg.enabled()) return false;
    const row = await require('./pgStateStore').load(PG_KEY);
    const n = Object.keys(row?.subscribers || {}).length;
    if (!n) return false;
    cache = row;
    save(cache, { skipPg: true });
    console.log(`[subscribers] PostgreSQL'den yüklendi: ${n} kullanıcı`);
    return true;
  } catch (e) {
    console.warn('[subscribers] pg reload:', e.message);
    return false;
  }
}

async function migrateFileToPostgres() {
  try {
    const pgState = require('./pgStateStore');
    const pg = require('./pgClient');
    if (!pg.enabled()) return 0;
    if (await pgState.has(PG_KEY)) return 0;
    const n = Object.keys(cache.subscribers || {}).length;
    if (!n && fs.existsSync(STORE_FILE)) {
      cache = loadFile();
    }
    const count = Object.keys(cache.subscribers || {}).length;
    if (!count) return 0;
    await pgState.save(PG_KEY, cache);
    console.log(`[pg] bot_subscribers.json → PostgreSQL (${count} kullanıcı)`);
    return count;
  } catch (e) {
    console.warn('[subscribers] migrate:', e.message);
    return 0;
  }
}

/** @param {import('node-telegram-bot-api').User} from */
function touch(from, opts = {}) {
  if (!from?.id) return null;
  const id = String(from.id);
  const now = new Date().toISOString();
  const prev = cache.subscribers[id];
  let lang = opts.lang;
  if (!lang) {
    try {
      lang = require('./users').getLang(from.id);
    } catch {
      lang = prev?.lang || 'en';
    }
  }
  const rec = {
    id: Number(from.id),
    username: from.username ?? prev?.username ?? null,
    firstName: from.first_name ?? prev?.firstName ?? null,
    lastName: from.last_name ?? prev?.lastName ?? null,
    lang,
    startedAt: prev?.startedAt || now,
    lastSeenAt: now,
    source: opts.source || prev?.source || 'dm',
    active: true,
    blockedAt: null,
    blockReason: null,
  };
  cache.subscribers[id] = rec;
  save(cache);
  return rec;
}

function markInactive(userId, reason = 'blocked') {
  const id = String(userId);
  const rec = cache.subscribers[id];
  if (!rec) return false;
  rec.active = false;
  rec.blockedAt = new Date().toISOString();
  rec.blockReason = reason;
  save(cache);
  return true;
}

function listActive() {
  return Object.values(cache.subscribers || {}).filter((s) => s.active !== false);
}

function countStats() {
  const all = Object.values(cache.subscribers || {});
  const active = all.filter((s) => s.active !== false);
  const blocked = all.length - active.length;
  return { total: all.length, active: active.length, blocked };
}

function get(userId) {
  return cache.subscribers[String(userId)] || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBlockedError(err) {
  const m = String(err?.message || err?.response?.body?.description || err || '');
  return /blocked by the user|bot was blocked|user is deactivated|chat not found|peer_id_invalid|forbidden/i.test(m);
}

/** @param {import('node-telegram-bot-api')} bot */
async function broadcastToAll(bot, text, sendOpts = {}) {
  const subs = listActive();
  const delayMs = Math.max(35, parseInt(process.env.BROADCAST_DELAY_MS || '55', 10));
  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const sub of subs) {
    try {
      await bot.sendMessage(sub.id, text, sendOpts);
      sent += 1;
      const id = String(sub.id);
      if (cache.subscribers[id] && !cache.subscribers[id].active) {
        cache.subscribers[id].active = true;
        cache.subscribers[id].blockedAt = null;
        save(cache);
      }
    } catch (e) {
      if (isBlockedError(e)) {
        markInactive(sub.id, 'send_failed');
        blocked += 1;
      } else {
        failed += 1;
        console.warn(`[broadcast] ${sub.id}:`, e?.message || e);
      }
    }
    await sleep(delayMs);
  }

  return { sent, failed, blocked, total: subs.length };
}

module.exports = {
  touch,
  markInactive,
  listActive,
  countStats,
  get,
  broadcastToAll,
  reloadFromPostgres,
  migrateFileToPostgres,
};
