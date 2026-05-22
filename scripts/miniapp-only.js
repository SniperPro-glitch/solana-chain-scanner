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
  const { isAdminEnabled, getAdminCredentials } = require('../src/adminPanel');
  const adminOn = isAdminEnabled();
  const port = process.env.MINI_APP_PORT || process.env.PORT || '3080';
  const adminLocal = `http://127.0.0.1:${port}/admin/`;
  if (adminOn) {
    const c = getAdminCredentials();
    console.log(`[admin] Yerel panel: ${adminLocal}`);
    console.log(`[admin] Kullanıcı: ${c.username} (şifre .env ADMIN_PASSWORD)`);
    if (getWebAppBaseUrl() !== adminLocal.replace(/\/admin\/$/, '')) {
      console.log(`[admin] WEB_APP_URL: ${getWebAppBaseUrl()}/admin/`);
    }
  } else {
    console.log(`[admin] Panel KAPALI — .env: ADMIN_USERNAME + ADMIN_PASSWORD`);
    console.log(`[admin] Açılınca: ${adminLocal}`);
  }
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
