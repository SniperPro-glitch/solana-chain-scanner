/** BotFather (Description, Short description, komut menüsü) — yalnızca elle; kod API ile yazmaz. */

const { isDexUserFacingBot } = require('./botMode');

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

async function applyTelegramBotProfile() {
  console.log('[botProfile] BotFather metinleri elle — API ile description/komut güncellenmez');
}

module.exports = {
  applyTelegramBotProfile,
  dexCommands,
  scanCommands,
  isDexUserFacingBot,
};
