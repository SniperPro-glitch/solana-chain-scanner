/** Telegram bot profili — açıklama, kısa açıklama, komut menüsü (DEX vs scan). */

const { isDexUserFacingBot } = require('./botMode');

const DEX_DESCRIPTION = {
  en:
    'Sniper DEX — token scanner inside Telegram.\n\n'
    + 'Trending, new pairs, charts, risk & alerts in one Mini App.\n'
    + 'Tap Start or the menu button to open.',
  tr:
    'Sniper DEX — Telegram içinde token tarayıcı.\n\n'
    + 'Trending, yeni çift, grafik, risk ve alarmlar tek uygulamada.\n'
    + 'Start veya menüden açın.',
  ru:
    'Sniper DEX — сканер токенов в Telegram.\n\n'
    + 'Тренды, новые пары, графики, риск и алерты в Mini App.\n'
    + 'Start или кнопка меню.',
};

const DEX_SHORT = {
  en: 'Open Sniper DEX — trending, charts & risk in Telegram.',
  tr: 'Sniper DEX — liste, grafik ve risk (Mini App).',
  ru: 'Sniper DEX — тренды, графики и риск в Telegram.',
};

const SCAN_DESCRIPTION = {
  en:
    'Sniper Scan — multi-chain channel scanner (TON, BSC, Solana).\n'
    + 'Add me as channel admin, open Settings in DM, pick one network per channel.',
  tr:
    'Sniper Scan — çoklu ağ kanal tarayıcı (TON, BSC, Solana).\n'
    + 'Kanala admin ekleyin, DM\'den ayarları açın, kanal başına tek ağ seçin.',
  ru:
    'Sniper Scan — сканер каналов TON, BSC, Solana.\n'
    + 'Добавьте админом в канал, настройки в ЛС, одна сеть на канал.',
};

const SCAN_SHORT = {
  en: 'TON · BSC · Solana channel token scanner.',
  tr: 'TON · BSC · Solana kanal token tarayıcı.',
  ru: 'Сканер токенов для канала (TON, BSC, Solana).',
};

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

async function setDescriptionLang(bot, map, method) {
  const field = method === 'setMyShortDescription' ? 'short_description' : 'description';
  for (const [lang, text] of Object.entries(map)) {
    try {
      await bot[method]({ [field]: text, language_code: lang });
    } catch (e) {
      console.warn(`[botProfile] ${method} ${lang}:`, e.message);
    }
  }
}

async function applyTelegramBotProfile(bot) {
  if (!bot) return;
  const dex = isDexUserFacingBot();

  try {
    if (dex) {
      await setDescriptionLang(bot, DEX_DESCRIPTION, 'setMyDescription');
      await setDescriptionLang(bot, DEX_SHORT, 'setMyShortDescription');
    } else {
      await setDescriptionLang(bot, SCAN_DESCRIPTION, 'setMyDescription');
      await setDescriptionLang(bot, SCAN_SHORT, 'setMyShortDescription');
    }
  } catch (e) {
    console.warn('[botProfile] description:', e.message);
  }

  const commands = dex ? dexCommands() : scanCommands();
  try {
    await bot.setMyCommands(commands);
    console.log(`[botProfile] komutlar (${dex ? 'DEX' : 'scan'}): ${commands.length} adet`);
  } catch (e) {
    console.warn('[botProfile] setMyCommands:', e.message);
  }
}

module.exports = {
  applyTelegramBotProfile,
  dexCommands,
  scanCommands,
  isDexUserFacingBot,
};
