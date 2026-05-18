// Paylaşım başına tam denetim — Mini App API (dosya veya PostgreSQL).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DATA_DIR, ensureDataDir } = require('./data-path');
const pg = require('./pgClient');

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

function rowToReport(row) {
  if (!row) return null;
  const body = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
  return {
    createdAt: Number(row.created_at),
    lang: row.lang || body?.lang,
    level: row.level || body?.level,
    token: body.token,
    audit: body.audit,
  };
}

async function saveReportPg(id, report) {
  await pg.query(
    `INSERT INTO sc_reports (id, created_at, lang, level, body)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body`,
    [id, report.createdAt, report.lang, report.level, JSON.stringify(report)],
  );
}

async function saveReportAsync({ token, audit, lang, level }) {
  const id = newId();
  const report = {
    createdAt: Date.now(),
    lang: lang || 'tr',
    level: level || 'green',
    token: JSON.parse(JSON.stringify(token)),
    audit: JSON.parse(JSON.stringify(audit)),
  };

  if (pg.enabled()) {
    await saveReportPg(id, report);
    return id;
  }

  const data = load();
  prune(data);
  data.reports[id] = report;
  save(data);
  return id;
}

function saveReport(opts) {
  if (pg.enabled()) {
    throw new Error('saveReport: DATABASE_URL aktif — saveReportAsync kullanın');
  }
  const data = load();
  prune(data);
  const id = newId();
  data.reports[id] = {
    createdAt: Date.now(),
    lang: opts.lang || 'tr',
    level: opts.level || 'green',
    token: JSON.parse(JSON.stringify(opts.token)),
    audit: JSON.parse(JSON.stringify(opts.audit)),
  };
  save(data);
  return id;
}

async function getReportMetaAsync(id) {
  if (!id) return { status: 'missing' };

  if (pg.enabled()) {
    try {
      const r = await pg.query(
        'SELECT id, created_at, lang, level, body FROM sc_reports WHERE id = $1',
        [String(id)],
      );
      const row = r.rows[0];
      if (!row) return { status: 'not_found' };
      const createdAt = Number(row.created_at);
      if (Date.now() - createdAt > TTL_MS) {
        return { status: 'expired', createdAt };
      }
      const report = rowToReport(row);
      return { status: 'ok', report };
    } catch (e) {
      console.warn('[reportStore] pg get:', e.message);
      return { status: 'not_found' };
    }
  }

  return getReportMeta(id);
}

function getReportMeta(id) {
  if (!id) return { status: 'missing' };
  const data = load();
  const r = data.reports[String(id)];
  if (!r) return { status: 'not_found' };
  if (Date.now() - (r.createdAt || 0) > TTL_MS) {
    return { status: 'expired', createdAt: r.createdAt };
  }
  return { status: 'ok', report: r };
}

function getReport(id) {
  const meta = getReportMeta(id);
  return meta.status === 'ok' ? meta.report : null;
}

async function reportCountAsync() {
  if (!pg.enabled()) return reportCount();
  try {
    const r = await pg.query('SELECT COUNT(*)::int AS c FROM sc_reports');
    return r.rows[0]?.c || 0;
  } catch {
    return 0;
  }
}

function reportCount() {
  const data = load();
  return Object.keys(data.reports || {}).length;
}

async function migrateFileToPg() {
  if (!pg.enabled() || !fs.existsSync(REPORTS_FILE)) return 0;
  const data = load();
  let n = 0;
  for (const [id, report] of Object.entries(data.reports || {})) {
    try {
      await saveReportPg(id, report);
      n += 1;
    } catch {
      /* skip */
    }
  }
  return n;
}

module.exports = {
  saveReport,
  saveReportAsync,
  getReport,
  getReportMeta,
  getReportMetaAsync,
  newId,
  reportCount,
  reportCountAsync,
  migrateFileToPg,
  TTL_MS,
};
