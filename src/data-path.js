// Kalıcı veri dizini — Railway Volume (/app/data) veya DATABASE_URL (Postgres).

const fs = require('fs');
const path = require('path');

const LEGACY_DATA_DIR = path.join(__dirname, '..', 'data');

function resolveDataDir() {
  const explicit = String(process.env.DATA_DIR || '').trim();
  if (explicit) return path.resolve(explicit);

  const railwayMount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
  if (railwayMount) return path.resolve(railwayMount);

  const onRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (onRailway) return '/app/data';

  return LEGACY_DATA_DIR;
}

const DATA_DIR = resolveDataDir();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isPersistentDataDir() {
  try {
    const { resolveDatabaseUrl } = require('../scripts/railway-env');
    if (resolveDatabaseUrl()) return true;
  } catch {
    /* yoksay */
  }
  if (process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL) return true;
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.RAILWAY_VOLUME_NAME) return true;
  if (String(process.env.DATA_DIR || '').trim()) return true;
  return false;
}

function migrateLegacyDataDir() {
  if (path.resolve(DATA_DIR) === path.resolve(LEGACY_DATA_DIR)) return;
  if (!fs.existsSync(LEGACY_DATA_DIR)) return;
  ensureDataDir();
  for (const file of ['channels.json', 'users.json', 'seen.json', 'whitelist.json', 'reports.json', 'bot_feed.json']) {
    const src = path.join(LEGACY_DATA_DIR, file);
    const dst = path.join(DATA_DIR, file);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      console.log(`[data] ${file} taşındı → ${DATA_DIR}`);
    }
  }
}

migrateLegacyDataDir();

module.exports = {
  DATA_DIR,
  LEGACY_DATA_DIR,
  ensureDataDir,
  isPersistentDataDir,
};
