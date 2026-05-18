// Mini App — üst reklam banner (GIF + link).

const fs = require('fs');
const path = require('path');

const PUBLIC_MINIAPP = path.join(__dirname, '..', 'public', 'miniapp');
const DEFAULT_GIF = '/assets/promo-banner.gif';
const DEFAULT_SVG = '/assets/promo-banner.svg';

function envOn(key, fallback = '1') {
  const v = String(process.env[key] ?? fallback).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(v);
}

function localAssetExists(rel) {
  try {
    const p = path.join(PUBLIC_MINIAPP, rel.replace(/^\//, ''));
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function getPromoBanner() {
  if (!envOn('MINI_APP_BANNER_ENABLED', '1')) {
    return { enabled: false };
  }

  const link = String(process.env.MINI_APP_BANNER_LINK || '').trim();
  const gifUrl = String(process.env.MINI_APP_BANNER_GIF_URL || '').trim();
  const alt = String(process.env.MINI_APP_BANNER_ALT || 'Reklam').trim();

  let imageUrl = gifUrl;
  if (!imageUrl) {
    if (localAssetExists(DEFAULT_GIF)) imageUrl = DEFAULT_GIF;
    else if (localAssetExists(DEFAULT_SVG)) imageUrl = DEFAULT_SVG;
    else imageUrl = DEFAULT_SVG;
  }

  return {
    enabled: true,
    imageUrl,
    link: link || null,
    alt,
    isGif: /\.gif(\?|$)/i.test(imageUrl),
  };
}

module.exports = { getPromoBanner };
