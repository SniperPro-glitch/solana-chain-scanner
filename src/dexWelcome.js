/** @dexscannerappbot — /start karşılama (kanal tarama botundan ayrı UX). */

const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');
const { buildSniperDexWebAppButton } = require('./dexAppButton');

/** Bot DM /start metinleri — yalnızca EN; dil Mini App içinde. */
const DEX_BOT_UI_LANG = 'en';

const SCAN_BOT_USERNAME = String(process.env.SCAN_BOT_USERNAME || 'solanachainscanbot').replace(/^@/, '');
const OFFICIAL_CHANNEL_URL =
  String(process.env.DEX_OFFICIAL_CHANNEL_URL || process.env.OFFICIAL_CHANNEL_URL || '').trim()
  || `https://t.me/${SCAN_BOT_USERNAME}`;

const WELCOME_PHOTO_CANDIDATES = [
  'dex-welcome-1080.jpg',
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

function dexWelcomeCaption() {
  return t('welcome.dexStartHtml', DEX_BOT_UI_LANG);
}

function buildDexStartKeyboard() {
  const launch = buildSniperDexWebAppButton(DEX_BOT_UI_LANG);
  if (!launch) return { inline_keyboard: [] };
  launch.text = t('welcome.dexBtnLaunch', DEX_BOT_UI_LANG);
  return { inline_keyboard: [[launch]] };
}

function dexWelcomeSendOptions() {
  return {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: buildDexStartKeyboard(),
  };
}

async function sendDexWelcomeMessage(bot, chatId) {
  const caption = dexWelcomeCaption();
  const opts = dexWelcomeSendOptions();
  const photo = welcomePhotoPath();
  if (photo) {
    return bot.sendPhoto(chatId, photo, { caption, ...opts }, photoFileOptions(photo));
  }
  return bot.sendMessage(chatId, caption, opts);
}

module.exports = {
  DEX_BOT_UI_LANG,
  OFFICIAL_CHANNEL_URL,
  SCAN_BOT_USERNAME,
  dexWelcomeCaption,
  buildDexStartKeyboard,
  dexWelcomeSendOptions,
  sendDexWelcomeMessage,
};
