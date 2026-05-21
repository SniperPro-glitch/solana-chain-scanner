/**
 * Mini App üst reklam banner — masaüstü / tablet / telefon görselleri + hizalama.
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'promo-banner.json');
const PUBLIC_CONFIG = path.join(__dirname, '..', 'public', 'miniapp', 'promo-banner.json');
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'miniapp', 'assets');
const LEGACY_UPLOAD_NAME = 'promo-banner-upload';

const VARIANTS = ['desktop', 'tablet', 'mobile'];
const UPLOAD_NAMES = {
  desktop: 'promo-banner-desktop',
  tablet: 'promo-banner-tablet',
  mobile: 'promo-banner-mobile',
};

const MAX_BYTES = 5 * 1024 * 1024;

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

function normalizeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;

  if (cfg.version >= 2 && cfg.variants && typeof cfg.variants === 'object') {
    const variants = {};
    for (const key of VARIANTS) {
      const v = cfg.variants[key];
      if (v?.imageUrl) {
        variants[key] = {
          imageUrl: v.imageUrl,
          posX: Math.min(100, Math.max(0, Number(v.posX) || 50)),
        };
      }
    }
    return {
      version: 2,
      enabled: cfg.enabled !== false && Object.keys(variants).length > 0,
      link: cfg.link || null,
      variants,
      updatedAt: cfg.updatedAt || null,
    };
  }

  const legacyUrl = cfg.imageUrl || null;
  if (!legacyUrl) return null;

  const posX = Math.min(100, Math.max(0, Number(cfg.posX) || 50));
  const variants = {};
  for (const key of VARIANTS) {
    variants[key] = { imageUrl: legacyUrl, posX };
  }
  return {
    version: 2,
    enabled: cfg.enabled !== false,
    link: cfg.link || null,
    variants,
    updatedAt: cfg.updatedAt || null,
  };
}

function loadConfig() {
  return normalizeConfig(readJsonFile(DATA_FILE) || readJsonFile(PUBLIC_CONFIG));
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

function writeVariantFile(variant, buf, mime) {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const ext = extFromMime(mime);
  const base = UPLOAD_NAMES[variant] || `${LEGACY_UPLOAD_NAME}-${variant}`;
  const fileName = `${base}${ext}`;
  fs.writeFileSync(path.join(ASSETS_DIR, fileName), buf);
  return `/assets/${fileName}`;
}

function saveConfig(payload) {
  const prev = loadConfig() || { variants: {} };
  const link = String(payload.link ?? prev.link ?? '').trim();
  const enabled = payload.enabled !== false && payload.enabled !== 0;

  const variants = { ...prev.variants };

  if (payload.imageBase64 && !payload.variants) {
    const parsed = parseImagePayload(payload.imageBase64);
    const url = writeVariantFile('desktop', parsed.buf, parsed.mime);
    const posX = Math.min(100, Math.max(0, Number(payload.posX ?? 50) || 50));
    for (const key of VARIANTS) {
      variants[key] = { imageUrl: url, posX };
    }
  }

  const incoming = payload.variants && typeof payload.variants === 'object'
    ? payload.variants
    : null;

  if (incoming) {
    for (const key of VARIANTS) {
      const slot = incoming[key];
      if (!slot || typeof slot !== 'object') continue;
      const prevSlot = variants[key] || {};
      let imageUrl = prevSlot.imageUrl || null;
      if (slot.imageBase64) {
        const parsed = parseImagePayload(slot.imageBase64);
        imageUrl = writeVariantFile(key, parsed.buf, parsed.mime);
      }
      const posX = Math.min(
        100,
        Math.max(0, Number(slot.posX ?? prevSlot.posX ?? payload.posX ?? 50) || 50),
      );
      if (imageUrl) variants[key] = { imageUrl, posX: Math.round(posX) };
    }
    const desktopUrl = variants.desktop?.imageUrl;
    if (desktopUrl) {
      for (const key of VARIANTS) {
        if (key === 'desktop') continue;
        if (incoming[key]?.imageBase64) continue;
        if (!variants[key]?.imageUrl || variants[key].imageUrl.includes(LEGACY_UPLOAD_NAME)) {
          variants[key] = {
            imageUrl: desktopUrl,
            posX: variants[key]?.posX ?? variants.desktop.posX,
          };
        }
      }
    }
  } else if (payload.posX != null && Object.keys(variants).length) {
    const posX = Math.min(100, Math.max(0, Number(payload.posX) || 50));
    for (const key of VARIANTS) {
      if (variants[key]) variants[key] = { ...variants[key], posX: Math.round(posX) };
    }
  }

  const hasImage = VARIANTS.some((k) => variants[k]?.imageUrl);
  const out = {
    version: 2,
    enabled: enabled && hasImage,
    variants,
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
  normalizeConfig,
  isPublishAuthorized,
  VARIANTS,
  DATA_FILE,
  PUBLIC_CONFIG,
};
