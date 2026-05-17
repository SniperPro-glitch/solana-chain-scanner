// Sadece Mini App (Dex UI) — BOT_TOKEN gerekmez, Telegram botu açılmaz.
require('dotenv').config();
const { startMiniAppServer, getWebAppBaseUrl } = require('../src/miniAppServer');

const server = startMiniAppServer();
if (!server) {
  console.error('MINI_APP_ENABLED=0 — Mini App kapalı.');
  process.exit(1);
}
console.log('Mini App geliştirme modu (bot yok)');
console.log('Tarayıcı:', getWebAppBaseUrl());
console.log('Durdurmak: Ctrl+C');
