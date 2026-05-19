/**
 * Mini App üst reklam banner — yükleme + yatay hizalama (object-position).
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'promo-banner.json');
const PUBLIC_CONFIG = path.join(__dirname, '..', 'public', 'miniapp', 'promo-banner.json');
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'miniapp', 'assets');
const UPLOAD_NAME = 'promo-banner-upload';

const MAX_BYTES = 2.5 * 1024 * 1024;

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

function loadConfig() {
  return readJsonFile(DATA_FILE) || readJsonFile(PUBLIC_CONFIG);
}

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('gif')) return '.gif';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('webp')) return '.webp';
  return '.png';
}

function parseImagePayload(imageBase64) {
  const raw = String(imageBase64 || '').trim();
  if (!raw) return null;
  const m = raw.match(/^data:([^;]+);base64,(.+)$/i);
  const b64 = m ? m[2] : raw;
  const mime = m ? m[1] : 'image/png';
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) {
    throw new Error(`Görsel çok büyük (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
  }
  return { buf, mime };
}

function saveConfig(payload) {
  const prev = loadConfig() || {};
  const posX = Math.min(100, Math.max(0, Number(payload.posX ?? prev.posX ?? 50) || 50));
  const link = String(payload.link ?? prev.link ?? '').trim();
  const enabled = payload.enabled !== false && payload.enabled !== 0;

  let imageUrl = prev.imageUrl || null;
  if (payload.imageBase64) {
    const parsed = parseImagePayload(payload.imageBase64);
    const ext = extFromMime(parsed.mime);
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    const fileName = `${UPLOAD_NAME}${ext}`;
    const filePath = path.join(ASSETS_DIR, fileName);
    fs.writeFileSync(filePath, parsed.buf);
    imageUrl = `/assets/${fileName}`;
  }

  const out = {
    version: 1,
    enabled: enabled && !!imageUrl,
    imageUrl,
    posX: Math.round(posX),
    link: link || null,
    updatedAt: new Date().toISOString(),
  };

  writeJsonFile(DATA_FILE, out);
  writeJsonFile(PUBLIC_CONFIG, out);
  return out;
}

function isPublishAuthorized(req) {
  const key = String(
    process.env.CROP_PUBLISH_KEY || process.env.MINI_APP_CROP_KEY || process.env.BANNER_PUBLISH_KEY || '',
  ).trim();
  if (!key) return true;
  const got = String(
    req.headers['x-crop-key'] || req.headers['x-crop-publish-key'] || req.headers['x-banner-key'] || '',
  ).trim();
  return got === key;
}

module.exports = {
  loadConfig,
  saveConfig,
  isPublishAuthorized,
  DATA_FILE,
  PUBLIC_CONFIG,
};
