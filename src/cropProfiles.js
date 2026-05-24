/**
 * Mini App Dex kırpma — sunucu tarafı profiller (5 cihaz).
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./data-path');

const DATA_FILE = path.join(DATA_DIR, 'dex-crop-profiles.json');
const PUBLIC_FALLBACK = path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.json');

const PROFILE_ORDER = ['web', 'webgecko', 'app11', 'app13', 'app13pm', 'app16'];

/** Railway CROP_SAVE_PIN yoksa — panel açılır, düzenleme/kayıt bu şifreyle */
const DEFAULT_CROP_SAVE_PIN = 'SniperKirpma9';

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadBakedProfiles() {
  const data = readJsonFile(DATA_FILE);
  if (data?.profiles) return data;
  const pub = readJsonFile(PUBLIC_FALLBACK);
  if (pub?.profiles) return pub;
  return null;
}

function profileLooksCustom(block) {
  // chart ve trades objesi varsa custom say — default kontrolü kaldırıldı
  // Çünkü farklı cihazların default değerleri farklı, yanlış sıfırlama yapıyordu
  return !!(block?.chart && block?.trades);
}

function saveBakedProfiles(payload) {
  if (!payload?.profiles || typeof payload.profiles !== 'object') {
    throw new Error('profiles gerekli');
  }
  const existing = loadBakedProfiles();
  const fallback = readJsonFile(PUBLIC_FALLBACK);
  const profiles = {};
  PROFILE_ORDER.forEach((id) => {
    const next = payload.profiles[id];
    const prev = existing?.profiles?.[id] || fallback?.profiles?.[id];
    const nextOk = profileLooksCustom(next);
    const prevOk = profileLooksCustom(prev);
    if (nextOk) profiles[id] = next;
    else if (prevOk) profiles[id] = prev;
    else if (next) profiles[id] = next;
    else if (prev) profiles[id] = prev;
  });
  ensureDataDir();
  const out = {
    version: payload.version || 1,
    updatedAt: new Date().toISOString(),
    note: '5 cihaz — POST birleştirilir (web, 11, 13, 13pm, 16pm)',
    profiles,
  };
  writeJsonFile(DATA_FILE, out);
  writeJsonFile(PUBLIC_FALLBACK, out);
  writeBakedJs(out);
  return out;
}

function writeBakedJs(data) {
  const bakedOut = path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-baked.js');
  const stamp = data.updatedAt || new Date().toISOString();
  const js = `/** Otomatik — crop save · ${stamp} */\nglobalThis.__DEX_CROP_BAKED__=${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(bakedOut, js, 'utf8');
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'sync-dex-crop-css.js')], {
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('[cropProfiles] CSS sync skipped:', e.message);
  }
}

function cropSavePinExpected() {
  const fromEnv = String(
    process.env.CROP_SAVE_PIN || process.env.CROP_PUBLISH_KEY || process.env.MINI_APP_CROP_KEY || '',
  ).trim();
  return fromEnv || DEFAULT_CROP_SAVE_PIN;
}

function cropSavePinRequired() {
  return true;
}

function verifyCropSavePin(pin) {
  const expected = cropSavePinExpected();
  if (!expected) return true;
  return String(pin || '').trim() === expected;
}

function isPublishAuthorized(req) {
  if (String(process.env.CROP_LOCK_PROFILES || '') === '1') return false;
  if (cropSavePinRequired()) {
    const pin = String(
      req.headers['x-crop-save-pin'] || req.headers['x-crop-pin'] || '',
    ).trim();
    if (!verifyCropSavePin(pin)) return false;
  }
  const key = String(process.env.CROP_PUBLISH_KEY || process.env.MINI_APP_CROP_KEY || '').trim();
  if (!key) return true;
  const got = String(req.headers['x-crop-key'] || req.headers['x-crop-publish-key'] || '').trim();
  return got === key;
}

module.exports = {
  PROFILE_ORDER,
  loadBakedProfiles,
  saveBakedProfiles,
  cropSavePinRequired,
  verifyCropSavePin,
  isPublishAuthorized,
  DATA_FILE,
  PUBLIC_FALLBACK,
};
