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

function save(state) {
  try {
    ensureDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('users.json write error:', err.message);
  }
}

let cache = load();

function getLang(userId) {
  const u = cache.users[String(userId)];
  return u?.lang || 'en';
}

function setLang(userId, lang) {
  const id = String(userId);
  cache.users[id] = { ...(cache.users[id] || {}), lang };
  save(cache);
}

module.exports = { getLang, setLang };
