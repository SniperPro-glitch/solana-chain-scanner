// Daha önce paylaşılmış havuzları takip eden basit JSON tabanlı depo.
// Tekrar paylaşımı önler. Railway'de ephemeral disk olduğu için yeniden
// deploy sonrası sıfırlanır - bu kabul edilebilir, ilk birkaç dakikada
// "yeni" sanılan tokenler kanaldan filtrelenebilir veya tekrar atılabilir.

const fs = require('fs');
const path = require('path');

const { DATA_DIR, ensureDataDir } = require('./data-path');
const SEEN_FILE = path.join(DATA_DIR, 'seen.json');
const MAX_SEEN_ENTRIES = 5000; // En eski kayıtları otomatik temizle

function ensureDir() {
  ensureDataDir();
}

function load() {
  try {
    ensureDir();
    if (!fs.existsSync(SEEN_FILE)) {
      return {
        ids: {}, watched: {}, stats: defaultStats(),
        daily: defaultPeriod(), weekly: defaultWeekly(), ring: defaultRing(), control: defaultControl(),
      };
    }
    const raw = fs.readFileSync(SEEN_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.watched) data.watched = {}; // geriye uyumluluk
    if (!data.stats) data.stats = defaultStats();
    // Eski stats'lara eksik alanlar
    const ds = defaultStats();
    for (const k of Object.keys(ds)) if (data.stats[k] == null) data.stats[k] = ds[k];
    if (!data.weekly) data.weekly = defaultWeekly();
    // Eski tek "weekly" objesi günlük sıfırlanıyordu — daily olarak ayır
    if (!data.daily) {
      data.daily = data.weekly && data.weekly.lastSentAt
        ? { ...defaultPeriod(), ...data.weekly, lastDigestAt: data.weekly.lastSentAt }
        : defaultPeriod();
    }
    if (!data.ring) data.ring = defaultRing();
    if (!data.control) data.control = defaultControl();
    // Kategori map'i tablo olarak yoksa boş obje ata (eski cache'ler)
    if (!data.stats.filterRejByCategory) data.stats.filterRejByCategory = {};
    return data;
  } catch (err) {
    console.error('seen.json okuma hatası:', err.message);
    return {
      ids: {}, watched: {}, stats: defaultStats(),
      daily: defaultPeriod(), weekly: defaultWeekly(), ring: defaultRing(), control: defaultControl(),
    };
  }
}

function defaultStats() {
  return {
    totalShared: 0,
    lastScanAt: null,
    scamsCaught: 0,
    risksFlagged: 0,
    recoveries: 0,
    // Extended (eko: küçük, primitive sayaçlar)
    scansTotal: 0,
    poolsDiscovered: 0,
    tokensInspected: 0,
    filterRejected: 0,
    errors24h: 0,
    avgScanMs: 0,           // exp moving average
    lastScanDurationMs: 0,
    // Discovery health
    sseEvents: 0,
    sseHeartbeats: 0,
    restPolls: 0,
    lastHeartbeatAt: null,
    sseConnectedSince: null,
    // Filter rejection breakdown — kategori map (8-10 grup)
    // Anahtar: liquidity, volume, age, risk, dex, holders, audit, mcap, lp, sybil, hours, disabled, other
    filterRejByCategory: {},
  };
}

// 24h ring buffer — her saat 1 slot
function defaultRing() {
  // 24 slot, her biri { hour: 0-23, scans, found, shared, rejected, errors }
  return { startedAtHour: null, slots: [] };
}

// Bot kontrol state — runtime'da değişir, disk'e yazılır
function defaultControl() {
  return {
    status: 'running', // 'running' | 'paused' | 'stopped'
    pausedAt: null,
    pausedBy: null,
    startedAt: new Date().toISOString(),
  };
}

/** Günlük özet (17:00 UTC TR 20:00) sonrası sıfırlanır */
function defaultPeriod() {
  return {
    periodStart: null,
    shared: 0,
    scams: 0,
    risks: 0,
    recovered: 0,
    lastDigestAt: null,
  };
}

function defaultWeekly() {
  // Pazartesi 06:00 UTC — haftalık özet sonrası sıfırlanır
  return {
    weekStart: null,
    shared: 0,
    scams: 0,
    risks: 0,
    recovered: 0,
    lastDigestAt: null,
  };
}

function save(state) {
  try {
    ensureDir();
    fs.writeFileSync(SEEN_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('seen.json yazma hatası:', err.message);
  }
}

function trim(state) {
  const entries = Object.entries(state.ids);
  if (entries.length <= MAX_SEEN_ENTRIES) return state;
  // En eski (timestamp'i küçük olan) kayıtları sil
  entries.sort((a, b) => a[1] - b[1]);
  const toRemove = entries.slice(0, entries.length - MAX_SEEN_ENTRIES);
  for (const [id] of toRemove) delete state.ids[id];
  return state;
}

let cache = load();

// ─── 24h ring buffer helpers ───
// Her saat (UTC) için 1 slot tutar. Eski slotlar otomatik düşer.
function _currentHourKey() {
  const d = new Date();
  // YYYY-MM-DD HH (UTC)
  return `${d.toISOString().slice(0, 13)}`;
}

function _ringPushScan({ tokensInspected = 0, tokensShared = 0, rejected = 0, errors = 0 }) {
  if (!cache.ring) cache.ring = defaultRing();
  const hour = _currentHourKey();
  let slot = cache.ring.slots.find((s) => s.hour === hour);
  if (!slot) {
    slot = { hour, scans: 0, found: 0, shared: 0, rejected: 0, errors: 0, scams: 0, risks: 0, recovered: 0 };
    cache.ring.slots.push(slot);
  }
  slot.scans += 1;
  slot.found += tokensInspected;
  slot.shared += tokensShared;
  slot.rejected += rejected;
  slot.errors += errors;

  // 24 saat penceresi: cutoff'tan eski slotları sil
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 13);
  cache.ring.slots = cache.ring.slots.filter((s) => s.hour >= cutoff);
  if (cache.ring.slots.length > 30) {
    // güvenlik: 30'dan fazla slot tutmasın
    cache.ring.slots = cache.ring.slots.slice(-24);
  }
}

function _ringPushEvent(eventKey, n = 1) {
  if (!cache.ring) cache.ring = defaultRing();
  const hour = _currentHourKey();
  let slot = cache.ring.slots.find((s) => s.hour === hour);
  if (!slot) {
    slot = { hour, scans: 0, found: 0, shared: 0, rejected: 0, errors: 0, scams: 0, risks: 0, recovered: 0 };
    cache.ring.slots.push(slot);
  }
  const map = { scamsCaught: 'scams', risksFlagged: 'risks', recoveries: 'recovered' };
  const field = map[eventKey];
  if (field) slot[field] = (slot[field] || 0) + n;
}

function _ringAggregate24h() {
  if (!cache.ring || !cache.ring.slots.length) {
    return {
      scans: 0, found: 0, shared: 0, rejected: 0, errors: 0,
      scams: 0, risks: 0, recovered: 0, hourlyShared: [],
    };
  }
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 13);
  const recent = cache.ring.slots.filter((s) => s.hour >= cutoff);
  const agg = recent.reduce((acc, s) => {
    acc.scans += s.scans;
    acc.found += s.found;
    acc.shared += s.shared;
    acc.rejected += s.rejected;
    acc.errors += s.errors;
    acc.scams += s.scams || 0;
    acc.risks += s.risks || 0;
    acc.recovered += s.recovered || 0;
    return acc;
  }, { scans: 0, found: 0, shared: 0, rejected: 0, errors: 0, scams: 0, risks: 0, recovered: 0 });
  agg.hourlyShared = recent.map((s) => s.shared);
  return agg;
}

function _bumpPeriod(periodObj, weeklyKey, n, startField, startIso) {
  if (!periodObj[startField] && startIso) periodObj[startField] = startIso;
  periodObj[weeklyKey] = (periodObj[weeklyKey] || 0) + n;
}


module.exports = {
  isSeen(poolId) {
    return Boolean(cache.ids[poolId]);
  },

  markSeen(poolId) {
    cache.ids[poolId] = Date.now();
    cache = trim(cache);
    save(cache);
  },

  recordScan(found) {
    if (!cache.stats) cache.stats = defaultStats();
    if (!cache.daily) cache.daily = defaultPeriod();
    if (!cache.weekly) cache.weekly = defaultWeekly();
    const today = new Date().toISOString().slice(0, 10);
    cache.stats.lastScanAt = new Date().toISOString();
    if (found && found > 0) {
      cache.stats.totalShared = (cache.stats.totalShared || 0) + found;
      _bumpPeriod(cache.daily, 'shared', found, 'periodStart', today);
      _bumpPeriod(cache.weekly, 'shared', found, 'weekStart', today);
    }
    save(cache);
  },

  getStats() {
    return {
      ...cache.stats,
      seenCount: Object.keys(cache.ids).length,
    };
  },

  // İzleme listesi: paylaşılan token'ın meta veri — likidite rüg kontrolü için
  // poolId → { ... meta, lastWatchLevel: 'green'|'yellow'|'red' — likidite izleme kart rengi }
  watch(poolId, meta) {
    if (!cache.watched) cache.watched = {};
    cache.watched[poolId] = {
      ...meta,
      sharedAt: Date.now(),
      alerted: false,
      lastLiquidity: meta.initialLiquidity,
      lastWatchLevel: meta.lastWatchLevel || 'green',
    };
    save(cache);
  },

  getWatched(poolId) {
    return cache.watched && cache.watched[poolId];
  },

  listWatched() {
    return Object.entries(cache.watched || {}).map(([poolId, m]) => ({ poolId, ...m }));
  },

  updateWatched(poolId, patch) {
    if (!cache.watched || !cache.watched[poolId]) return;
    cache.watched[poolId] = { ...cache.watched[poolId], ...patch };
    save(cache);
  },

  removeWatched(poolId) {
    if (cache.watched) delete cache.watched[poolId];
    save(cache);
  },

  // ─── Sayaçlar (haftalık + cumulative birlikte) ───
  incStat(key, n = 1) {
    if (!cache.stats) cache.stats = defaultStats();
    if (!cache.daily) cache.daily = defaultPeriod();
    if (!cache.weekly) cache.weekly = defaultWeekly();
    const today = new Date().toISOString().slice(0, 10);
    cache.stats[key] = (cache.stats[key] || 0) + n;
    const periodKey = { scamsCaught: 'scams', risksFlagged: 'risks', recoveries: 'recovered', totalShared: 'shared' }[key];
    if (periodKey) {
      _bumpPeriod(cache.daily, periodKey, n, 'periodStart', today);
      _bumpPeriod(cache.weekly, periodKey, n, 'weekStart', today);
    }
    _ringPushEvent(key, n);
    save(cache);
  },

  getDaily() {
    return { ...(cache.daily || defaultPeriod()) };
  },

  getWeekly() {
    return { ...(cache.weekly || defaultWeekly()) };
  },

  /** @deprecated günlük özet için getDaily kullanın */
  getWeeklyAsDaily() {
    return this.getDaily();
  },

  resetDaily(periodStartIso) {
    cache.daily = { ...defaultPeriod(), periodStart: periodStartIso, lastDigestAt: new Date().toISOString() };
    save(cache);
  },

  resetWeekly(weekStartIso) {
    cache.weekly = { ...defaultWeekly(), weekStart: weekStartIso, lastDigestAt: new Date().toISOString() };
    save(cache);
  },

  setWeeklyStart(weekStartIso) {
    if (!cache.weekly) cache.weekly = defaultWeekly();
    if (!cache.weekly.weekStart) {
      cache.weekly.weekStart = weekStartIso;
      save(cache);
    }
  },

  getStatsBundle() {
    return {
      stats: this.getStats(),
      daily: this.getDaily(),
      weekly: this.getWeekly(),
      last24h: _ringAggregate24h(),
    };
  },

  // ─── Extended stats: tarama döngüsü kayıt ───
  // params: { durationMs, poolsFetched, tokensInspected, tokensShared, rejectionsByCategory: { liquidity: 3, risk: 2 }, errors: 0 }
  recordScanCycle({ durationMs = 0, poolsFetched = 0, tokensInspected = 0, tokensShared = 0, rejectionsByCategory = {}, errors = 0 } = {}) {
    if (!cache.stats) cache.stats = defaultStats();
    if (!cache.ring) cache.ring = defaultRing();

    // Cumulative counters
    cache.stats.scansTotal = (cache.stats.scansTotal || 0) + 1;
    cache.stats.poolsDiscovered = (cache.stats.poolsDiscovered || 0) + poolsFetched;
    cache.stats.tokensInspected = (cache.stats.tokensInspected || 0) + tokensInspected;
    const rejThis = Object.values(rejectionsByCategory).reduce((a, b) => a + (b || 0), 0);
    cache.stats.filterRejected = (cache.stats.filterRejected || 0) + rejThis;
    cache.stats.lastScanAt = new Date().toISOString();
    cache.stats.lastScanDurationMs = durationMs;
    // EMA: avgScanMs = avgScanMs * 0.8 + duration * 0.2
    const prev = cache.stats.avgScanMs || durationMs;
    cache.stats.avgScanMs = Math.round(prev * 0.8 + durationMs * 0.2);

    // Filter rejection by category — birikimli
    if (!cache.stats.filterRejByCategory) cache.stats.filterRejByCategory = {};
    for (const [cat, n] of Object.entries(rejectionsByCategory)) {
      cache.stats.filterRejByCategory[cat] = (cache.stats.filterRejByCategory[cat] || 0) + (n || 0);
    }

    // 24h ring buffer — saat slotu
    _ringPushScan({ tokensInspected, tokensShared, rejected: rejThis, errors });

    save(cache);
  },

  // ─── Discovery health ───
  recordDiscoveryEvent(type) {
    if (!cache.stats) cache.stats = defaultStats();
    const now = new Date().toISOString();
    if (type === 'sse_connect') {
      cache.stats.sseConnectedSince = now;
    } else if (type === 'sse_disconnect') {
      cache.stats.sseConnectedSince = null;
    } else if (type === 'sse_event') {
      cache.stats.sseEvents = (cache.stats.sseEvents || 0) + 1;
      cache.stats.lastHeartbeatAt = now;
    } else if (type === 'heartbeat') {
      cache.stats.sseHeartbeats = (cache.stats.sseHeartbeats || 0) + 1;
      cache.stats.lastHeartbeatAt = now;
    } else if (type === 'rest_poll') {
      cache.stats.restPolls = (cache.stats.restPolls || 0) + 1;
    } else if (type === 'error') {
      cache.stats.errors24h = (cache.stats.errors24h || 0) + 1;
    }
    save(cache);
  },

  // ─── Extended stats okuma ───
  getExtendedStats() {
    if (!cache.stats) cache.stats = defaultStats();
    if (!cache.ring) cache.ring = defaultRing();
    if (!cache.control) cache.control = defaultControl();
    // Son 24h aggregate
    const last24h = _ringAggregate24h();
    // SSE bağlı mı + saniye
    const sseConnectedSec = cache.stats.sseConnectedSince
      ? Math.floor((Date.now() - new Date(cache.stats.sseConnectedSince).getTime()) / 1000)
      : 0;
    const lastHeartbeatSec = cache.stats.lastHeartbeatAt
      ? Math.floor((Date.now() - new Date(cache.stats.lastHeartbeatAt).getTime()) / 1000)
      : null;
    return {
      ...cache.stats,
      seenCount: Object.keys(cache.ids || {}).length,
      watchedCount: Object.keys(cache.watched || {}).length,
      control: { ...cache.control },
      last24h,
      sseConnectedSec,
      lastHeartbeatSec,
      ringSlots: cache.ring.slots.length,
    };
  },

  // ─── Bot control (running/paused/stopped) ───
  getControl() {
    if (!cache.control) cache.control = defaultControl();
    return { ...cache.control };
  },
  setControl(status, by = null) {
    if (!cache.control) cache.control = defaultControl();
    const now = new Date().toISOString();
    cache.control.status = status;
    if (status === 'paused') {
      cache.control.pausedAt = now;
      cache.control.pausedBy = by;
    } else if (status === 'running') {
      cache.control.pausedAt = null;
      cache.control.pausedBy = null;
      if (!cache.control.startedAt) cache.control.startedAt = now;
    } else if (status === 'stopped') {
      cache.control.pausedAt = now;
      cache.control.pausedBy = by;
    }
    save(cache);
  },

  // Test/debug için
  reset() {
    // Control state korunur (running/paused durumu sıfırlanmasın)
    const keepControl = cache.control || defaultControl();
    cache = {
      ids: {},
      watched: {},
      stats: defaultStats(),
      daily: defaultPeriod(),
      weekly: defaultWeekly(),
      ring: defaultRing(),
      control: keepControl,
    };
    save(cache);
  },
};
