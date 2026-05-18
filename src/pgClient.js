// Railway PostgreSQL — DATABASE_URL veya PGHOST/PGUSER (Railway bağlantısı).

const { resolveDatabaseUrl } = require('../scripts/railway-env');

let pool = null;
let schemaReady = false;

function connectionString() {
  return resolveDatabaseUrl();
}

function enabled() {
  return !!connectionString();
}

async function getPool() {
  if (!enabled()) return null;
  if (!pool) {
    const { Pool } = require('pg');
    const cs = connectionString();
    const useSsl = !/localhost|127\.0\.0\.1|\.railway\.internal/i.test(cs)
      && String(process.env.PGSSLMODE || '').toLowerCase() !== 'disable';
    pool = new Pool({
      connectionString: cs,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 4,
    });
    pool.on('error', (e) => console.warn('[pg] pool:', e.message));
  }
  return pool;
}

async function ensureSchema() {
  if (!enabled() || schemaReady) return;
  const p = await getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS sc_reports (
      id TEXT PRIMARY KEY,
      created_at BIGINT NOT NULL,
      lang TEXT,
      level TEXT,
      body JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sc_feed (
      id TEXT PRIMARY KEY,
      mint TEXT NOT NULL,
      posted_at BIGINT NOT NULL,
      body JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sc_feed_posted ON sc_feed (posted_at DESC);
    CREATE INDEX IF NOT EXISTS sc_feed_mint ON sc_feed (mint);
  `);
  schemaReady = true;
  console.log('[pg] şema hazır (sc_reports, sc_feed)');
}

async function query(text, params) {
  const p = await getPool();
  if (!p) throw new Error('pg_disabled');
  return p.query(text, params);
}

module.exports = {
  enabled,
  getPool,
  ensureSchema,
  query,
  connectionString,
};
