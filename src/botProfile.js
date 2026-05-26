/** BotFather metinleri elle; deploy yalnızca eski API dil kayıtlarını (en/tr/ru) temizler. */

const { isDexUserFacingBot } = require('./botMode');
const { clearApiLocalizedBotTexts } = require('./botApiDescriptionClear');

function dexCommands() {
  return [
    { command: 'start', description: 'Open Sniper DEX' },
    { command: 'dex', description: 'Open Mini App' },
  ];
}

function scanCommands() {
  return [
    { command: 'start', description: 'Başlangıç / dil' },
    { command: 'dex', description: 'Sniper DEX Mini App' },
    { command: 'settings', description: 'Kanal ayarları' },
    { command: 'welcome', description: 'Hoş geldin (kanal)' },
    { command: 'post', description: 'Manuel paylaşım (DM)' },
    { command: 'channelid', description: 'Kanal ID' },
    { command: 'ping', description: 'Bot canlı mı?' },
    { command: 'stats', description: 'İstatistikler' },
    { command: 'subscribers', description: 'Abone sayısı (admin)' },
    { command: 'broadcast', description: 'DM duyuru (admin)' },
  ];
}

function envFlag(name, defaultOn = false) {
  const raw = process.env[name];
  const v = raw === undefined || raw === '' ? (defaultOn ? '1' : '0') : String(raw).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(v);
}

async function applyTelegramBotProfile(botToken) {
  const token = String(botToken || process.env.BOT_TOKEN || '').trim();
  const dex = isDexUserFacingBot();

  if (dex && token && !envFlag('BOT_SKIP_CLEAR_API_DESCRIPTIONS')) {
    const { cleared, errors } = await clearApiLocalizedBotTexts(token);
    if (errors.length) {
      console.warn('[botProfile] API dil açıklama temizliği:', errors.slice(0, 3).join('; '));
    }
    console.log(
      `[botProfile] API en/tr/ru description temizlendi (${cleared} çağrı) — BotFather Description geçerli; Rusça Telegram da varsayılanı gösterir`,
    );
  } else {
    console.log('[botProfile] BotFather metinleri elle — yeni description API ile yazılmaz');
  }
}

module.exports = {
  applyTelegramBotProfile,
  dexCommands,
  scanCommands,
  isDexUserFacingBot,
};
