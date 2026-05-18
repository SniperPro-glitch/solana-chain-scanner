// Başlangıç: Postgres / Volume / ephemeral teşhisi

const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir, isPersistentDataDir } = require('./data-path');
const pg = require('./pgClient');

async function initPersistence() {
  if (pg.enabled()) {
    try {
      await pg.ensureSchema();
      await migrateFilesToPostgres();
    } catch (e) {
      console.error('[pg] başlatılamadı:', e.message);
      console.error('   Railway → PostgreSQL eklentisi → DATABASE_URL bot servisinde olmalı');
    }
  }
  runVolumeProbe();
  logPersistenceMode();
}

function runVolumeProbe() {
  if (pg.enabled()) return;
  try {
    ensureDataDir();
    const probePath = path.join(DATA_DIR, '.deploy_probe');
    const prev = fs.existsSync(probePath)
      ? fs.readFileSync(probePath, 'utf8').trim()
      : '';
    const now = new Date().toISOString();
    fs.writeFileSync(probePath, now, 'utf8');
    if (prev && prev !== now) {
      console.log(`[data] Volume probe OK — önceki kayıt: ${prev.slice(0, 19)}Z`);
    } else if (!isPersistentDataDir()) {
      console.warn(
        '[data] ⚠️ Kalıcı depolama YOK — redeploy sonrası rapor/liste silinir.',
      );
      console.warn(
        '   Çözüm A: Railway → Bot servisi → Volumes → mount /app/data',
      );
      console.warn(
        '   Çözüm B: Railway → + New → Database → PostgreSQL → bot servisine bağla (DATABASE_URL)',
      );
    }
  } catch (e) {
    console.warn('[data] probe:', e.message);
  }
}

function logPersistenceMode() {
  if (pg.enabled()) {
    console.log('[data] Depolama: PostgreSQL (DATABASE_URL) — Volume gerekmez');
    return;
  }
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.RAILWAY_VOLUME_NAME || '';
  console.log(
    `[data] Depolama: dosya (${DATA_DIR}) · volume=${vol || 'yok'} · kalıcı=${isPersistentDataDir() ? 'EVET' : 'HAYIR'}`,
  );
}

async function migrateFilesToPostgres() {
  const reportStore = require('./reportStore');
  const botFeedStore = require('./botFeedStore');
  const n = await reportStore.migrateFileToPg?.();
  const f = await botFeedStore.migrateFileToPg?.();
  if ((n || 0) + (f || 0) > 0) {
    console.log(`[pg] dosyadan taşındı: ${n || 0} rapor, ${f || 0} feed`);
  }
}

module.exports = { initPersistence, logPersistenceMode };
