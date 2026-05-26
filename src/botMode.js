/** DEX kullanıcı botu (@dexscannerappbot) vs kanal tarama botu. */

function isDexUserFacingBot() {
  const role = String(process.env.BOT_SERVICE_ROLE || process.env.BOT_MODE || '').trim().toLowerCase();
  if (role === 'dex' || role === 'miniapp') return true;
  if (role === 'scan' || role === 'channel') return false;

  const miniOnly = ['1', 'true', 'on', 'yes', 'dex', 'miniapp'].includes(
    String(process.env.MINIAPP_ONLY || process.env.SERVICE_MODE || '').trim().toLowerCase(),
  );
  const hasToken = !!String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  return miniOnly && hasToken;
}

module.exports = { isDexUserFacingBot };
