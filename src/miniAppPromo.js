// Mini App — üst reklam banner (masaüstü / tablet / telefon + env).

const fs = require('fs');
const path = require('path');
const promoBannerStore = require('./promoBannerStore');

const PUBLIC_MINIAPP = path.join(__dirname, '..', 'public', 'miniapp');
const DEFAULT_GIF = '/assets/promo-banner.gif';
const DEFAULT_SVG = '/assets/promo-banner.svg';
const { VARIANTS } = promoBannerStore;

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

function pickEnvUrl(desktopKey, tabletKey, mobileKey, fallbackKey) {
  const desktop = String(process.env[desktopKey] || process.env[fallbackKey] || '').trim();
  const tablet = String(process.env[tabletKey] || desktop).trim();
  const mobile = String(process.env[mobileKey] || tablet).trim();
  return { desktop, tablet, mobile };
}

function buildVariantsFromStored(stored) {
  const updatedAt = stored.updatedAt;
  const out = {};
  for (const key of VARIANTS) {
    const slot = stored.variants?.[key];
    if (!slot?.imageUrl) continue;
    out[key] = {
      imageUrl: cacheBust(slot.imageUrl, updatedAt),
      posX: slot.posX ?? 50,
    };
  }
  const desktopUrl = out.desktop?.imageUrl || out.tablet?.imageUrl || out.mobile?.imageUrl;
  if (out.desktop?.imageUrl == null && desktopUrl) {
    out.desktop = { imageUrl: desktopUrl, posX: out.tablet?.posX ?? out.mobile?.posX ?? 50 };
  }
  if (out.tablet?.imageUrl == null && desktopUrl) {
    out.tablet = { imageUrl: out.desktop?.imageUrl || desktopUrl, posX: out.desktop?.posX ?? 50 };
  }
  if (out.mobile?.imageUrl == null && desktopUrl) {
    out.mobile = {
      imageUrl: out.tablet?.imageUrl || out.desktop?.imageUrl || desktopUrl,
      posX: out.tablet?.posX ?? out.desktop?.posX ?? 50,
    };
  }
  return out;
}

function getPromoBanner() {
  if (!envOn('MINI_APP_BANNER_ENABLED', '1')) {
    return { enabled: false };
  }

  const stored = promoBannerStore.loadConfig();
  if (stored?.enabled && stored.variants && Object.keys(stored.variants).length) {
    const variants = buildVariantsFromStored(stored);
    const desktop = variants.desktop?.imageUrl;
    return {
      enabled: true,
      imageUrl: desktop,
      variants,
      link: stored.link || null,
      posX: variants.desktop?.posX ?? 50,
      alt: String(process.env.MINI_APP_BANNER_ALT || 'Reklam').trim(),
      isGif: /\.gif(\?|$)/i.test(desktop || ''),
      source: 'upload',
    };
  }

  const link = String(process.env.MINI_APP_BANNER_LINK || '').trim();
  const alt = String(process.env.MINI_APP_BANNER_ALT || 'Reklam').trim();
  const urls = pickEnvUrl(
    'MINI_APP_BANNER_DESKTOP_URL',
    'MINI_APP_BANNER_TABLET_URL',
    'MINI_APP_BANNER_MOBILE_URL',
    'MINI_APP_BANNER_GIF_URL',
  );

  let desktop = urls.desktop;
  if (!desktop) {
    if (localAssetExists(DEFAULT_GIF)) desktop = DEFAULT_GIF;
    else if (localAssetExists(DEFAULT_SVG)) desktop = DEFAULT_SVG;
    else desktop = DEFAULT_SVG;
  }
  const tablet = urls.tablet || desktop;
  const mobile = urls.mobile || tablet;

  const variants = {
    desktop: { imageUrl: desktop, posX: 50 },
    tablet: { imageUrl: tablet, posX: 50 },
    mobile: { imageUrl: mobile, posX: 50 },
  };

  return {
    enabled: true,
    imageUrl: desktop,
    variants,
    link: link || null,
    posX: 50,
    alt,
    isGif: /\.gif(\?|$)/i.test(desktop),
    source: 'env',
  };
}

module.exports = { getPromoBanner, VARIANTS };
