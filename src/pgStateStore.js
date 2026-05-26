// PostgreSQL — channels.json, users.json vb. (deploy sonrası ayarlar kalır).

const pg = require('./pgClient');

async function ensureStateSchema() {
  if (!pg.enabled()) return;
  await pg.ensureSchema();
  const p = await pg.getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS sc_state (
      key TEXT PRIMARY KEY,
      body JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);
}

async function load(key) {
  if (!pg.enabled()) return null;
  await ensureStateSchema();
  const r = await pg.query('SELECT body FROM sc_state WHERE key = $1', [String(key)]);
  if (!r.rows[0]) return null;
  const b = r.rows[0].body;
  return typeof b === 'string' ? JSON.parse(b) : b;
}

async function save(key, body) {
  if (!pg.enabled()) return false;
  await ensureStateSchema();
  await pg.query(
    `INSERT INTO sc_state (key, body, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at`,
    [String(key), JSON.stringify(body), Date.now()],
  );
  return true;
}

async function has(key) {
  if (!pg.enabled()) return false;
  await ensureStateSchema();
  const r = await pg.query('SELECT 1 FROM sc_state WHERE key = $1 LIMIT 1', [String(key)]);
  return r.rows.length > 0;
}

module.exports = { ensureStateSchema, load, save, has };
