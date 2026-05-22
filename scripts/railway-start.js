// Railway: MINIAPP_ONLY=1 → sadece DEX (BOT_TOKEN yok). Yoksa scan bot.

require('dotenv').config();
require('./railway-env').applyRailwayEnv();

const miniOnly = ['1', 'true', 'on', 'yes', 'dex', 'miniapp'].includes(
  String(process.env.MINIAPP_ONLY || process.env.SERVICE_MODE || '').trim().toLowerCase(),
);
const hasBotToken = !!String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();

/** Sadece DEX, token yok → /start çalışmaz. Token varsa veya miniOnly kapalıysa bot + DEX (index.js). */
if (miniOnly && !hasBotToken) {
  console.log('[railway] Mod: DEX only — BOT_TOKEN yok, /start bu serviste dinlenmez');
  require('./miniapp-only');
} else {
  if (miniOnly && hasBotToken) {
    console.log('[railway] MINIAPP_ONLY + BOT_TOKEN → bot komutları + DEX birlikte');
  } else {
    console.log('[railway] Scan bot + DEX (index.js)');
  }
  require('../src/index');
}
