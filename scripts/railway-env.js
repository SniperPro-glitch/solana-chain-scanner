// Railway deploy: WEB_APP_URL https, Postgres PGHOST → DATABASE_URL otomatik.

function normalizePublicUrl(raw) {
  let u = String(raw || '').trim().replace(/\/$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function buildPgUrlFromParts() {
  const host = String(process.env.PGHOST || process.env.POSTGRES_HOST || '').trim();
  if (!host) return '';
  const user = encodeURIComponent(process.env.PGUSER || process.env.POSTGRES_USER || 'postgres');
  const pass = encodeURIComponent(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '');
  const db = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_PRIVATE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRESQL_URL,
    process.env.RAILWAY_DATABASE_URL,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && !/^\$\{\{/.test(s)) return s;
  }
  return buildPgUrlFromParts();
}

function applyRailwayEnv() {
  const onRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

  const webRaw = String(process.env.WEB_APP_URL || '').trim();
  if (webRaw) {
    const fixed = normalizePublicUrl(webRaw);
    if (fixed !== webRaw.replace(/\/$/, '')) {
      console.log(`[railway-env] WEB_APP_URL → ${fixed}`);
    }
    process.env.WEB_APP_URL = fixed;
  } else if (onRailway && process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.WEB_APP_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    console.log(`[railway-env] WEB_APP_URL otomatik: ${process.env.WEB_APP_URL}`);
  }

  if (!String(process.env.DATA_DIR || '').trim() && onRailway) {
    const mount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
    process.env.DATA_DIR = mount || '/app/data';
  }

  const pgUrl = resolveDatabaseUrl();
  if (pgUrl) {
    if (!String(process.env.DATABASE_URL || '').trim()
      || /^\$\{\{/.test(String(process.env.DATABASE_URL))) {
      process.env.DATABASE_URL = pgUrl;
      console.log('[railway-env] PostgreSQL bağlantısı hazır (DATABASE_URL)');
    }
  } else if (onRailway && process.env.PGHOST) {
    console.warn('[railway-env] PGHOST var ama URL kurulamadı — Postgres Variables kontrol edin');
  }
}

module.exports = { applyRailwayEnv, normalizePublicUrl, resolveDatabaseUrl };
