// Railway: MINIAPP_ONLY=1 → sadece DEX (BOT_TOKEN yok). Yoksa scan bot.

require('dotenv').config();

const miniOnly = ['1', 'true', 'on', 'yes', 'dex', 'miniapp'].includes(
  String(process.env.MINIAPP_ONLY || process.env.SERVICE_MODE || '').trim().toLowerCase(),
);

if (miniOnly) {
  console.log('[railway] Mod: DEX Mini App (miniapp-only)');
  require('./miniapp-only');
} else {
  console.log('[railway] Mod: Scan bot (index.js)');
  require('../src/index');
}
