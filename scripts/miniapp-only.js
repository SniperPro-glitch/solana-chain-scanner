// Sadece Mini App (Dex UI) — BOT_TOKEN gerekmez, Telegram botu açılmaz.
require('dotenv').config();
require('./railway-env').applyRailwayEnv();

const { startMiniAppServer, getWebAppBaseUrl, getBotApiBaseUrl } = require('../src/miniAppServer');

async function main() {
  const { initPersistence } = require('../src/persistence');
  await initPersistence();

  const pg = require('../src/pgClient');
  const server = startMiniAppServer();
  if (!server) {
    console.error('MINI_APP_ENABLED=0 — Mini App kapalı.');
    process.exit(1);
  }

  console.log('[railway] Mod: DEX Mini App (miniapp-only)');
  console.log('WEB_APP_URL:', getWebAppBaseUrl());
  if (pg.enabled()) {
    console.log('Veri: PostgreSQL (bot ile aynı DB — HTTP proxy yok)');
  } else {
    console.log('BOT_API_URL:', getBotApiBaseUrl() || '(yok)');
    console.log('Öneri: DEX Variables → DATABASE_URL = ${{ Postgres.DATABASE_URL }}');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
