// Kullanıcı bazlı tercih (DM /scan için dil seçimi)

const fs = require('fs');
const path = require('path');

const { DATA_DIR, ensureDataDir } = require('./data-path');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDir() {
  ensureDataDir();
}

function load() {
  try {
    ensureDir();
    if (!fs.existsSync(USERS_FILE)) return { users: {} };
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    console.error('users.json read error:', err.message);
    return { users: {} };
  }
}

function save(state, opts = {}) {
  cache = state;
  try {
    ensureDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('users.json write error:', err.message);
  }
  if (!opts.skipPg) {
    try {
      const pgState = require('./pgStateStore');
      if (require('./pgClient').enabled()) {
        pgState.save('users', state).catch((e) => {
          console.warn('[users] PostgreSQL kayıt:', e.message);
        });
      }
    } catch (e) {
      console.warn('[users] pg save:', e.message);
    }
  }
}

async function reloadFromPostgres() {
  try {
    const pgState = require('./pgStateStore');
    if (!require('./pgClient').enabled()) return false;
    const row = await pgState.load('users');
    const n = Object.keys(row?.users || {}).length;
    if (!n) return false;
    cache = row;
    save(cache, { skipPg: true });
    console.log(`[users] PostgreSQL'den yüklendi: ${n} kullanıcı`);
    return true;
  } catch (e) {
    console.warn('[users] pg reload:', e.message);
    return false;
  }
}

async function migrateFileToPostgres() {
  try {
    const pgState = require('./pgStateStore');
    if (!require('./pgClient').enabled()) return 0;
    if (await pgState.has('users')) return 0;
    if (!fs.existsSync(USERS_FILE)) return 0;
    const state = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const n = Object.keys(state.users || {}).length;
    if (!n) return 0;
    await pgState.save('users', state);
    console.log(`[pg] users.json → PostgreSQL (${n} kullanıcı)`);
    return n;
  } catch (e) {
    console.warn('[users] migrate pg:', e.message);
    return 0;
  }
}

let cache = load();

function hasChosenLang(userId) {
  const u = cache.users[String(userId)];
  return Boolean(u?.lang);
}

/** Ayarlardan seçilmediyse İngilizce; seçildiyse kayıtlı dil. */
function getLang(userId) {
  const u = cache.users[String(userId)];
  return u?.lang || 'en';
}

function setLang(userId, lang) {
  const id = String(userId);
  cache.users[id] = { ...(cache.users[id] || {}), lang };
  save(cache);
}

module.exports = { getLang, setLang, hasChosenLang, reloadFromPostgres, migrateFileToPostgres };
