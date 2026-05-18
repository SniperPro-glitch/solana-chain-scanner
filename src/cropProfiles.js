/**
 * Mini App Dex kırpma — sunucu tarafı varsayılan profiller (5 cihaz).
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'dex-crop-profiles.json');
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

function saveBakedProfiles(payload) {
  if (!payload?.profiles || typeof payload.profiles !== 'object') {
    throw new Error('profiles gerekli');
  }
  const out = {
    version: payload.version || 1,
    updatedAt: new Date().toISOString(),
    profiles: payload.profiles,
  };
  writeJsonFile(DATA_FILE, out);
  writeJsonFile(PUBLIC_FALLBACK, out);
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
  isPublishAuthorized,
  DATA_FILE,
  PUBLIC_FALLBACK,
};
