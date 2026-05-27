/** DEX kullanıcı botu (@dexscannerappbot) vs kanal tarama botu. */

function parseUsernames(envVal, defaults) {
  const raw = String(envVal || '')
    .split(/[,;\s]+/)
    .map((s) => s.replace(/^@/, '').toLowerCase())
    .filter(Boolean);
  return new Set([...defaults, ...raw]);
}

const DEX_USERNAMES = parseUsernames(process.env.DEX_BOT_USERNAME, ['dexscannerappbot']);
/** Varsayılan kanal botu @ — çoklu ağ (TON/BSC/Solana); BotFather’da değiştirince SCAN_BOT_USERNAME güncelle */
const DEFAULT_SCAN_BOT_USERNAME = 'sniperscanbot';

const SCAN_USERNAMES = parseUsernames(process.env.SCAN_BOT_USERNAME, [
  DEFAULT_SCAN_BOT_USERNAME,
  'solanachainscanbot', // eski kullanıcı adı (geçiş)
  'sniperscanbot',
]);

function getScanBotUsername() {
  const fromEnv = String(process.env.SCAN_BOT_USERNAME || '').replace(/^@/, '').trim();
  if (fromEnv) return fromEnv.toLowerCase();
  const live = String(process.env.BOT_USERNAME || '').replace(/^@/, '').trim().toLowerCase();
  if (live && SCAN_USERNAMES.has(live)) return live;
  return DEFAULT_SCAN_BOT_USERNAME;
}

function getScanBotMention() {
  return `@${getScanBotUsername()}`;
}

function telegramUsername() {
  return String(process.env.BOT_USERNAME || '').replace(/^@/, '').toLowerCase();
}

function isDexUserFacingBot() {
  const u = telegramUsername();
  if (u) {
    if (DEX_USERNAMES.has(u)) return true;
    if (SCAN_USERNAMES.has(u)) return false;
  }

  const role = String(process.env.BOT_SERVICE_ROLE || process.env.BOT_MODE || '').trim().toLowerCase();
  if (role === 'dex' || role === 'miniapp') return true;
  if (role === 'scan' || role === 'channel') return false;

  const miniOnly = ['1', 'true', 'on', 'yes', 'dex', 'miniapp'].includes(
    String(process.env.MINIAPP_ONLY || process.env.SERVICE_MODE || '').trim().toLowerCase(),
  );
  const hasToken = !!String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  return miniOnly && hasToken;
}

module.exports = {
  isDexUserFacingBot,
  DEX_USERNAMES,
  SCAN_USERNAMES,
  DEFAULT_SCAN_BOT_USERNAME,
  getScanBotUsername,
  getScanBotMention,
};
