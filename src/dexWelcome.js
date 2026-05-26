/** @dexscannerappbot — /start karşılama (kanal tarama botundan ayrı UX). */

const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');
const { buildSniperDexWebAppButton } = require('./dexAppButton');

const SCAN_BOT_USERNAME = String(process.env.SCAN_BOT_USERNAME || 'solanachainscanbot').replace(/^@/, '');
const OFFICIAL_CHANNEL_URL =
  String(process.env.DEX_OFFICIAL_CHANNEL_URL || process.env.OFFICIAL_CHANNEL_URL || '').trim()
  || `https://t.me/${SCAN_BOT_USERNAME}`;

/** BotFather Description: 640×360. /start: mümkünse 1280×720 PNG (Telegram tam genişlik gösterir). */
const WELCOME_PHOTO_CANDIDATES = [
  'dex-welcome-start@2x.png',
  'dex-welcome-start.png',
  'dex-welcome-start.jpg',
].map((name) => path.join(__dirname, '..', 'public', 'bot-assets', name));

function welcomePhotoPath() {
  for (const p of WELCOME_PHOTO_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function photoFileOptions(photoPath) {
  const base = path.basename(photoPath);
  return {
    filename: base,
    contentType: base.endsWith('.png') ? 'image/png' : 'image/jpeg',
  };
}

function dexWelcomeCaption(lang) {
  return t('welcome.dexStartHtml', lang);
}

function dexLangPickCaption(lang) {
  return t('welcome.dexLangPickHtml', lang);
}

function buildDexStartKeyboard(lang) {
  const launch = buildSniperDexWebAppButton(lang);
  if (!launch) return { inline_keyboard: [] };
  launch.text = t('welcome.dexBtnLaunch', lang);
  return { inline_keyboard: [[launch]] };
}

function buildDexLangPickKeyboard() {
  const rows = [];
  const launch = buildSniperDexWebAppButton('en');
  if (launch) {
    launch.text = t('welcome.dexBtnLaunch', 'en');
    rows.push([launch]);
  }
  rows.push([
    { text: 'English', callback_data: 'startlang:en' },
    { text: 'Türkçe', callback_data: 'startlang:tr' },
    { text: 'Русский', callback_data: 'startlang:ru' },
  ]);
  return { inline_keyboard: rows };
}

function dexWelcomeSendOptions(lang) {
  return {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: buildDexStartKeyboard(lang),
  };
}

/**
 * Telegram caption+photo tek mesajda görseli küçük gösterir.
 * Banner ayrı (tam genişlik), metin+düğme altta.
 */
async function sendDexWelcomeMessage(bot, chatId, lang) {
  const caption = dexWelcomeCaption(lang);
  const opts = dexWelcomeSendOptions(lang);
  const photo = welcomePhotoPath();
  if (photo) {
    const fo = photoFileOptions(photo);
    await bot.sendPhoto(chatId, photo, {}, fo);
    return bot.sendMessage(chatId, caption, opts);
  }
  return bot.sendMessage(chatId, caption, opts);
}

async function sendDexLangPickMessage(bot, chatId, lang = 'en') {
  const caption = dexLangPickCaption(lang);
  const opts = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: buildDexLangPickKeyboard(),
  };
  const photo = welcomePhotoPath();
  if (photo) {
    const fo = photoFileOptions(photo);
    await bot.sendPhoto(chatId, photo, {}, fo);
    return bot.sendMessage(chatId, caption, opts);
  }
  return bot.sendMessage(chatId, caption, opts);
}

async function editDexWelcomeMessage(bot, chatId, messageId, lang) {
  const caption = `${t('welcome.langSetHtml', lang)}\n\n${dexWelcomeCaption(lang)}`;
  const opts = dexWelcomeSendOptions(lang);
  const edited = await bot
    .editMessageText(caption, {
      chat_id: chatId,
      message_id: messageId,
      ...opts,
    })
    .catch(() => null);
  if (edited) return edited;
  return sendDexWelcomeMessage(bot, chatId, lang);
}

module.exports = {
  OFFICIAL_CHANNEL_URL,
  SCAN_BOT_USERNAME,
  dexWelcomeCaption,
  dexLangPickCaption,
  buildDexStartKeyboard,
  buildDexLangPickKeyboard,
  dexWelcomeSendOptions,
  sendDexWelcomeMessage,
  sendDexLangPickMessage,
  editDexWelcomeMessage,
};
