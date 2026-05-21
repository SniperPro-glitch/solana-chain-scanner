// Admin panel — genel ayarlar (mockup: Ayarlar sayfası).

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./data-path');

const SETTINGS_PATH = path.join(DATA_DIR, 'admin-settings.json');
const CREDS_PATH = path.join(DATA_DIR, 'admin-credentials.json');

const DEFAULTS = {
  siteTitle: 'SNIPER DEX SCANNER',
  defaultLang: 'tr',
  feedRefreshSec: 30,
  maintenanceMode: false,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      return {
        siteTitle: String(raw.siteTitle || DEFAULTS.siteTitle),
        defaultLang: String(raw.defaultLang || DEFAULTS.defaultLang),
        feedRefreshSec: Math.max(5, parseInt(raw.feedRefreshSec, 10) || DEFAULTS.feedRefreshSec),
        maintenanceMode: !!raw.maintenanceMode,
        updatedAt: raw.updatedAt || null,
      };
    }
  } catch (e) {
    console.warn('[admin-settings] load:', e.message);
  }
  return { ...DEFAULTS, updatedAt: null };
}

function saveSettings(patch) {
  const cur = loadSettings();
  const next = {
    siteTitle: patch.siteTitle != null ? String(patch.siteTitle).trim() : cur.siteTitle,
    defaultLang: patch.defaultLang != null ? String(patch.defaultLang).trim() : cur.defaultLang,
    feedRefreshSec: patch.feedRefreshSec != null
      ? Math.max(5, parseInt(patch.feedRefreshSec, 10) || cur.feedRefreshSec)
      : cur.feedRefreshSec,
    maintenanceMode: patch.maintenanceMode != null ? !!patch.maintenanceMode : cur.maintenanceMode,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function loadCredentialOverride() {
  try {
    if (fs.existsSync(CREDS_PATH)) {
      return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
    }
  } catch { /* */ }
  return null;
}

function savePassword(username, newPassword) {
  const row = {
    username: String(username || '').trim(),
    password: String(newPassword || ''),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify(row, null, 2), 'utf8');
  return row;
}

module.exports = {
  loadSettings,
  saveSettings,
  loadCredentialOverride,
  savePassword,
  CREDS_PATH,
};
