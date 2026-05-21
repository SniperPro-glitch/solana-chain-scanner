/**
 * Mini App Dex kırpma — sunucu tarafı varsayılan profiller (5 cihaz).
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./data-path');

const DATA_FILE = path.join(DATA_DIR, 'dex-crop-profiles.json');
const PUBLIC_FALLBACK = path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.json');

const PROFILE_ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];

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
  if (!block?.chart) return false;
  const c = block.chart;
  const t = block.trades || {};
  return (
    c.top !== -8
    || c.stageH !== 340
    || t.iframeTop !== -820
    || t.viewH !== 268
    || (block.tape?.shiftDown || 0) !== 0
  );
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
}

/** Her deploy: git’teki public/miniapp/dex-crop-profiles.json → volume + baked.js (kalibrasyon volume’u ezmesin). */
function seedCropFromPublicOnBoot() {
  const pub = readJsonFile(PUBLIC_FALLBACK);
  if (!pub?.profiles) return null;
  ensureDataDir();
  const out = {
    version: pub.version || 1,
    updatedAt: pub.updatedAt || new Date().toISOString(),
    note: 'seed from public/miniapp/dex-crop-profiles.json on boot',
    profiles: pub.profiles,
  };
  writeJsonFile(DATA_FILE, out);
  writeJsonFile(PUBLIC_FALLBACK, out);
  writeBakedJs(out);
  return out;
}

function isPublishAuthorized(req) {
  const key = String(process.env.CROP_PUBLISH_KEY || process.env.MINI_APP_CROP_KEY || '').trim();
  if (!key) return true;
  const got = String(req.headers['x-crop-key'] || req.headers['x-crop-publish-key'] || '').trim();
  return got === key;
}

module.exports = {
  PROFILE_ORDER,
  loadBakedProfiles,
  saveBakedProfiles,
  seedCropFromPublicOnBoot,
  isPublishAuthorized,
  DATA_FILE,
  PUBLIC_FALLBACK,
};
