// Admin — trend algoritması ve mini app varsayılanları.

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./data-path');

const CONFIG_PATH = path.join(DATA_DIR, 'trend-config.json');

const DEFAULTS = {
  weights: {
    volume: 40,
    txns: 30,
    holders: 20,
    priceChange: 10,
  },
  defaults: {
    timeframe: '24h',
    dexFilter: 'all',
    sort: 'top',
    pageSize: 20,
  },
  ticker: {
    enabled: true,
    limit: 14,
    minVolumeUsd: 0,
  },
  view: {
    hideHighRisk: true,
    minVolumeUsd: 10000,
  },
  refresh: {
    enabled: true,
    intervalSec: 60,
  },
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeConfig(raw) {
  const w = { ...DEFAULTS.weights, ...(raw?.weights || {}) };
  const weights = {
    volume: clamp(Number(w.volume) || 0, 0, 100),
    txns: clamp(Number(w.txns) || 0, 0, 100),
    holders: clamp(Number(w.holders ?? w.liquidity) || 0, 0, 100),
    priceChange: clamp(Number(w.priceChange) || 0, 0, 100),
  };
  const d = { ...DEFAULTS.defaults, ...(raw?.defaults || {}) };
  const t = { ...DEFAULTS.ticker, ...(raw?.ticker || {}) };
  return {
    weights,
    defaults: {
      timeframe: String(d.timeframe || '24h').trim() || '24h',
      dexFilter: String(d.dexFilter || 'all').trim() || 'all',
      sort: String(d.sort || 'top').trim() || 'top',
      pageSize: clamp(parseInt(d.pageSize, 10) || 20, 5, 100),
    },
    ticker: {
      enabled: t.enabled !== false,
      limit: clamp(parseInt(t.limit, 10) || 14, 4, 24),
      minVolumeUsd: Math.max(0, Number(t.minVolumeUsd) || 0),
    },
    view: {
      hideHighRisk: (raw?.view?.hideHighRisk ?? DEFAULTS.view.hideHighRisk) !== false,
      minVolumeUsd: Math.max(0, Number(raw?.view?.minVolumeUsd ?? DEFAULTS.view.minVolumeUsd) || 0),
    },
    refresh: {
      enabled: (raw?.refresh?.enabled ?? DEFAULTS.refresh.enabled) !== false,
      intervalSec: clamp(parseInt(raw?.refresh?.intervalSec, 10) || 60, 30, 300),
    },
    updatedAt: raw?.updatedAt || null,
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return normalizeConfig(raw);
    }
  } catch (e) {
    console.warn('[trend-config] load:', e.message);
  }
  return normalizeConfig({});
}

function saveConfig(patch) {
  const cur = loadConfig();
  const next = normalizeConfig({
    ...cur,
    ...patch,
    weights: { ...cur.weights, ...(patch?.weights || {}) },
    defaults: { ...cur.defaults, ...(patch?.defaults || {}) },
    ticker: { ...cur.ticker, ...(patch?.ticker || {}) },
    view: { ...cur.view, ...(patch?.view || {}) },
    refresh: { ...cur.refresh, ...(patch?.refresh || {}) },
    updatedAt: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  DEFAULTS,
  loadConfig,
  saveConfig,
  normalizeConfig,
};
