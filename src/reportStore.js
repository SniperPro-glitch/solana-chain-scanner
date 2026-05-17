// Paylaşım başına tam denetim — Mini App API için (reports.json).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DATA_DIR, ensureDataDir } = require('./data-path');

const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const MAX_REPORTS = 800;
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

function load() {
  try {
    ensureDataDir();
    if (!fs.existsSync(REPORTS_FILE)) return { reports: {} };
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
  } catch (e) {
    console.warn('[reportStore] load:', e.message);
    return { reports: {} };
  }
}

function save(data) {
  ensureDataDir();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 0));
}

function prune(data) {
  const now = Date.now();
  const entries = Object.entries(data.reports || {});
  entries.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const kept = entries
    .filter(([, r]) => now - (r.createdAt || 0) < TTL_MS)
    .slice(0, MAX_REPORTS);
  data.reports = Object.fromEntries(kept);
}

function newId() {
  return crypto.randomBytes(8).toString('base64url').slice(0, 12);
}

function saveReport({ token, audit, lang, level }) {
  const data = load();
  prune(data);
  const id = newId();
  data.reports[id] = {
    createdAt: Date.now(),
    lang: lang || 'tr',
    level: level || 'green',
    token: JSON.parse(JSON.stringify(token)),
    audit: JSON.parse(JSON.stringify(audit)),
  };
  save(data);
  return id;
}

function getReport(id) {
  if (!id) return null;
  const data = load();
  const r = data.reports[String(id)];
  if (!r) return null;
  if (Date.now() - (r.createdAt || 0) > TTL_MS) return null;
  return r;
}

module.exports = { saveReport, getReport, newId };
