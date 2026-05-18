// Sadece Mini App (Dex UI) — BOT_TOKEN gerekmez, Telegram botu açılmaz.
require('dotenv').config();
require('./railway-env').applyRailwayEnv();

const { startMiniAppServer, getWebAppBaseUrl, getBotApiBaseUrl } = require('../src/miniAppServer');

const server = startMiniAppServer();
if (!server) {
  console.error('MINI_APP_ENABLED=0 — Mini App kapalı.');
  process.exit(1);
}
console.log('[railway] Mod: DEX Mini App (miniapp-only)');
console.log('WEB_APP_URL:', getWebAppBaseUrl());
console.log('BOT_API_URL:', getBotApiBaseUrl() || '(yok — feed/rapor çalışmaz)');
console.log('Durdurmak: Ctrl+C');
