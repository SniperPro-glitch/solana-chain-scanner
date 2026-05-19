// Mini App — üst reklam banner (yükleme + yatay hizalama veya env).

const fs = require('fs');
const path = require('path');
const promoBannerStore = require('./promoBannerStore');

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

function cacheBust(url, updatedAt) {
  if (!url || !updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

function getPromoBanner() {
  if (!envOn('MINI_APP_BANNER_ENABLED', '1')) {
    return { enabled: false };
  }

  const stored = promoBannerStore.loadConfig();
  if (stored?.enabled && stored.imageUrl) {
    return {
      enabled: true,
      imageUrl: cacheBust(stored.imageUrl, stored.updatedAt),
      link: stored.link || null,
      posX: stored.posX ?? 50,
      alt: String(process.env.MINI_APP_BANNER_ALT || 'Reklam').trim(),
      isGif: /\.gif(\?|$)/i.test(stored.imageUrl),
      source: 'upload',
    };
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
    posX: 50,
    alt,
    isGif: /\.gif(\?|$)/i.test(imageUrl),
    source: 'env',
  };
}

module.exports = { getPromoBanner };
