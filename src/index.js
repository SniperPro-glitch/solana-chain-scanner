// Solana Chain Scanner — Bot 2 (TON/BSC bağlantısı yok)

require('dotenv').config();
if (process.env.NTBA_FIX_350 === undefined || String(process.env.NTBA_FIX_350).trim() === '') {
  process.env.NTBA_FIX_350 = '1';
}

const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const chainsRegistry = require('./chains');
const {
  formatTokenCard,
  formatAnalysisOnly,
  formatRiskBanner,
} = require('./chains/solana/formatter');
const channels = require('./channels');
const storage = require('./storage');
const users = require('./users');
const settingsUI = require('./settings-ui');
const statsReport = require('./statsReport');
const whitelist = require('./whitelist');
const { ensureShareEnrichment } = require('./shareEnrich');
const { t, normalizeLang, DEFAULT_LANG } = require('./i18n');
const { wrapEmojis } = require('./emojiPack');
const userbot = require('./userbot');
const { createScanRunner } = require('./scanRunner');
const { createWatchRunner } = require('./watchRunner');

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ? String(process.env.ADMIN_USER_ID) : null;
const SOLANA_SCAN_ENABLED = ['1', 'true', 'on', 'yes'].includes(
  String(process.env.SOLANA_SCAN_ENABLED || '0').trim().toLowerCase(),
);
const SOLANA_SCAN_INTERVAL_MIN = parseInt(process.env.SOLANA_SCAN_INTERVAL_MIN || '12', 10);
const MAX_TOKENS_PER_SCAN = parseInt(process.env.MAX_TOKENS_PER_SCAN || '8', 10);
const SCAN_POOL_FETCH_LIMIT = parseInt(process.env.SOLANA_SCAN_POOL_LIMIT || '12', 10);
const SCAN_TOKEN_GAP_MS = parseInt(process.env.SOLANA_SCAN_TOKEN_GAP_MS || '1200', 10);
const WATCH_INTERVAL_SEC = parseInt(process.env.WATCH_INTERVAL_SECONDS || '60', 10);
const WATCH_BATCH_SIZE = Math.min(6, Math.max(2, parseInt(process.env.WATCH_BATCH_SIZE || '3', 10)));
const WATCH_BATCH_DELAY_MS = Math.min(1200, Math.max(200, parseInt(process.env.WATCH_BATCH_DELAY_MS || '400', 10)));

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tanımlı değil.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    params: {
      allowed_updates: JSON.stringify([
        'message', 'channel_post', 'my_chat_member', 'chat_member', 'callback_query',
      ]),
    },
  },
});

const ASSETS_SOL = path.join(__dirname, '..', 'assets', 'solana');
const BANNER = {
  green: process.env.SOLANA_GREEN_BANNER_FILE_ID || null,
  yellow: process.env.SOLANA_RISK_BANNER_FILE_ID || null,
  critical: process.env.SOLANA_CRITICAL_BANNER_FILE_ID || null,
  red: process.env.SOLANA_SCAM_BANNER_FILE_ID || null,
};

function localBanner(level) {
  const map = { green: 'green.jpg', yellow: 'risk.jpg', critical: 'critical.jpg', red: 'scam.jpg' };
  const p = path.join(ASSETS_SOL, map[level] || map.green);
  return fs.existsSync(p) ? p : null;
}

function solanaBannerSource(level) {
  const key = level === 'yellow' ? 'yellow' : (level === 'critical' ? 'critical' : (level === 'red' ? 'red' : 'green'));
  const fid = BANNER[key] || BANNER.green;
  if (fid) return { photoFileId: fid };
  const local = localBanner(key);
  if (local) return { photoLocalPath: local };
  return {};
}

function applyTokenBadges(token) {
  if (!token) return token;
  const hit = whitelist.matchToken(token);
  if (hit) token.trustedWhitelist = hit;
  else delete token.trustedWhitelist;
  return token;
}

function isChannelUserbotRequired() {
  const v = (process.env.CHANNEL_USERBOT_REQUIRED || '').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  if (v === '1' || v === 'true' || v === 'on') return true;
  return !!(process.env.TG_API_ID && process.env.TG_API_HASH && process.env.TG_SESSION);
}

async function _resolvePhotoBuffer(photoFileId, photoLocalPath) {
  if (photoLocalPath) {
    try { return fs.readFileSync(photoLocalPath); } catch (e) {
      console.warn('Local banner:', e.message);
    }
  }
  if (photoFileId) {
    try {
      const link = await bot.getFileLink(photoFileId);
      const res = await fetch(link);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn('File fetch:', e.message);
    }
  }
  return null;
}

function inlineKeyboard(keyboard) {
  if (!keyboard) return undefined;
  if (keyboard.inline_keyboard) return keyboard;
  return { inline_keyboard: keyboard };
}

const INFO_BANNER_LOCAL_PATH = path.join(__dirname, '..', 'assets', 'settings-banner.jpg');
let INFO_BANNER_FILE_ID = process.env.BOT_INFO_BANNER_FILE_ID || null;

function telegramLocalPhotoFileOpts(photoArg) {
  if (typeof photoArg !== 'string') return undefined;
  try {
    if (fs.existsSync(photoArg)) {
      return { filename: path.basename(photoArg) || 'photo.jpg', contentType: 'image/jpeg' };
    }
  } catch (_) { /* yoksay */ }
  return undefined;
}

async function sendCardToChannel(ch, opts) {
  const channelUbReq = isChannelUserbotRequired();
  const useUserbot = ch?.settings?.userbotEnabled !== false;
  const silent = opts.silent === true;
  const text = opts.text || '';
  const photoFileId = opts.photoFileId || null;
  const photoLocalPath = opts.photoLocalPath || null;
  const hasPhoto = !!(photoFileId || photoLocalPath);
  const chain = opts.chain || 'solana';
  const sendAsChannel = process.env.USERBOT_SEND_AS_CHANNEL === '1';

  if (channelUbReq && (!useUserbot || !userbot.isEnabled())) {
    return { ok: false, error: 'Userbot gerekli (TG_SESSION).', via: 'none' };
  }

  if (useUserbot && userbot.isEnabled()) {
    const captionText = wrapEmojis(text, chain);
    try {
      if (hasPhoto) {
        const buf = await _resolvePhotoBuffer(photoFileId, photoLocalPath);
        if (buf) {
          const r = await userbot.sendFile(ch.id, buf, captionText, { silent, sendAsChannel });
          if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot' };
        }
      }
      const r = await userbot.sendMessage(ch.id, captionText, { silent, sendAsChannel });
      if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot' };
    } catch (e) {
      if (channelUbReq) return { ok: false, error: e.message, via: 'none' };
    }
  }

  if (channelUbReq) {
    return { ok: false, error: 'Userbot zorunlu.', via: 'none' };
  }

  try {
    if (hasPhoto) {
      const photoArg = photoLocalPath || photoFileId;
      const msg = await bot.sendPhoto(ch.id, photoArg, {
        caption: wrapEmojis(text, chain),
        parse_mode: 'HTML',
        disable_notification: silent,
        ...telegramLocalPhotoFileOpts(photoArg),
      });
      return { ok: true, messageId: msg.message_id, via: 'bot' };
    }
    const msg = await bot.sendMessage(ch.id, wrapEmojis(text, chain), {
      parse_mode: 'HTML',
      disable_notification: silent,
      disable_web_page_preview: true,
    });
    return { ok: true, messageId: msg.message_id, via: 'bot' };
  } catch (e) {
    return { ok: false, error: e.message, via: 'bot' };
  }
}

async function editCardMessage(msg, opts) {
  const { hasPhoto, photoFileId, photoLocalPath, caption, fullText } = opts;
  const chain = opts.chain || 'solana';
  const via = msg.via || 'bot';

  if (via === 'userbot' && userbot.isEnabled()) {
    const wrapped = wrapEmojis(caption || fullText || '', chain);
    try {
      if (hasPhoto && (photoFileId || photoLocalPath)) {
        const buf = await _resolvePhotoBuffer(photoFileId, photoLocalPath);
        if (buf) {
          const r = await userbot.editMessageMedia(msg.chatId, msg.messageId, buf, wrapped);
          if (r.ok) return { ok: true, via: 'userbot' };
        }
      } else {
        const r = await userbot.editMessage(msg.chatId, msg.messageId, wrapped);
        if (r.ok) return { ok: true, via: 'userbot' };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  try {
    if (hasPhoto) {
      await bot.editMessageCaption(wrapEmojis(caption || '', chain), {
        chat_id: msg.chatId,
        message_id: msg.messageId,
        parse_mode: 'HTML',
      });
    } else {
      await bot.editMessageText(wrapEmojis(fullText || caption || '', chain), {
        chat_id: msg.chatId,
        message_id: msg.messageId,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }
    return { ok: true, via: 'bot' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function sendBotAnalysisFollowup(ch, cmEntry, token, audit, lang, cardLevel = 'green') {
  if (!ch || !cmEntry || !token || !audit) return;
  const sym = token.tokenSymbol || '?';
  const body = formatAnalysisOnly(token, audit, lang, cardLevel);
  if (!String(body || '').trim()) return;
  let text = `<b>$${sym}</b>\n${body}`;
  text = wrapEmojis(text, 'solana');
  if (text.length > 4080) text = `${text.slice(0, 4056)}\n<i>…</i>`;
  const ar = await sendCardToChannel(ch, { text, silent: true, chain: 'solana' });
  if (ar?.ok && ar.messageId) {
    cmEntry.analysisMessageId = ar.messageId;
    cmEntry.analysisVia = ar.via;
  }
}

const scanDeps = {
  chainsRegistry,
  channels,
  storage,
  formatTokenCard,
  solanaBannerSource,
  sendCardToChannel,
  sendBotAnalysisFollowup,
  ensureShareEnrichment,
  applyTokenBadges,
  MAX_TOKENS_PER_SCAN,
  SCAN_POOL_FETCH_LIMIT,
  SCAN_TOKEN_GAP_MS,
};
const { runScan } = createScanRunner(scanDeps);

const { checkWatchedTokens } = createWatchRunner({
  bot,
  chainsRegistry,
  channels,
  storage,
  formatTokenCard,
  formatRiskBanner,
  solanaBannerSource,
  editCardMessage,
  wrapEmojis,
  DEFAULT_LANG,
  WATCH_BATCH_SIZE,
  WATCH_BATCH_DELAY_MS,
});

const pendingPost = new Map();
const POST_TTL_MS = 10 * 60 * 1000;
const dmTarget = new Map();
const pendingBannerUpload = new Map();
/** Kanal butonundan geldi; dil seçilince bu kanalın ayar paneli açılır (TON akışı). */
const pendingChannelAfterLang = new Map();

function setPendingPost(userId, data) {
  pendingPost.set(String(userId), { ...data, expiresAt: Date.now() + POST_TTL_MS });
}
function getPendingPost(userId) {
  const p = pendingPost.get(String(userId));
  if (!p || p.expiresAt < Date.now()) {
    pendingPost.delete(String(userId));
    return null;
  }
  return p;
}
function clearPendingPost(userId) {
  pendingPost.delete(String(userId));
}

function setDmTarget(userId, chatId) {
  dmTarget.set(String(userId), String(chatId));
}
function getDmTarget(userId) {
  return dmTarget.get(String(userId)) || null;
}

function setPendingBanner(chatId, userId) {
  pendingBannerUpload.set(`${chatId}:${userId}`, Date.now() + 5 * 60 * 1000);
}
function consumePendingBanner(chatId, userId) {
  const k = `${chatId}:${userId}`;
  const exp = pendingBannerUpload.get(k);
  if (!exp || exp < Date.now()) {
    pendingBannerUpload.delete(k);
    return false;
  }
  pendingBannerUpload.delete(k);
  return true;
}

const ADMIN_IDS = (ADMIN_USER_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
function isBotAdmin(userId) {
  if (!ADMIN_IDS.length) return true;
  return ADMIN_IDS.includes(String(userId));
}

async function isChatAdmin(chatId, userId) {
  if (userId == null || userId === '') return false;
  try {
    const m = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(m.status);
  } catch {
    return false;
  }
}

/** Kanal gönderisinde from yok; grup/DM'de from.id */
function actorUserId(msg) {
  return msg?.from?.id ?? null;
}

/** Kanal / grup ayarlarını kim değiştirebilir */
async function canManageChat(msg) {
  const chat = msg?.chat;
  if (!chat) return false;
  if (chat.type === 'private') return true;
  const uid = actorUserId(msg);
  if (chat.type === 'channel') {
    if (uid) return isChatAdmin(chat.id, uid);
    return true;
  }
  if (uid) return isChatAdmin(chat.id, uid);
  return false;
}

/** Hem DM/grup message hem kanal channel_post için komut bağla */
function bindTextCommand(regex, handler) {
  const run = async (msg, match) => {
    try {
      await handler(msg, match);
    } catch (e) {
      console.error('[cmd]', regex, msg?.text, e?.message);
      bot.sendMessage(msg.chat.id, '⚠️ Komut işlenemedi. Lütfen bota özelden /settings yazın.').catch(() => {});
    }
  };
  bot.onText(regex, run);
  bot.on('channel_post', async (msg) => {
    if (!msg?.text) return;
    const m = msg.text.trim().match(regex);
    if (m) await run(msg, m);
  });
}

function langForMsg(msg) {
  if (!msg) return DEFAULT_LANG;
  if (msg.chat?.type === 'private') {
    return users.getLang(msg.from?.id) || normalizeLang(msg.from?.language_code);
  }
  return channels.getSettings(msg.chat.id)?.lang || DEFAULT_LANG;
}

function escapeHtmlLite(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function registerWatch(token, audit, channelMessages) {
  if (!token?.poolId) return;
  const isCritical = audit?.isCritical === true;
  const isRisky = !isCritical && (audit?.risk?.code === 'HIGH' || audit?.risk?.code === 'MEDIUM');
  storage.watch(token.poolId, {
    chain: 'solana',
    tokenSymbol: token.tokenSymbol,
    tokenName: token.tokenName,
    tokenAddress: token.tokenAddress,
    poolAddress: token.poolAddress,
    dex: token.dex,
    initialLiquidity: token.liquidityUsd || 0,
    channelMessages,
    lastWatchLevel: isCritical || isRisky ? 'yellow' : 'green',
  });
}

async function shareTokenToChannel(ch, token, audit, opts = {}) {
  const chLang = ch.settings?.lang || DEFAULT_LANG;
  const isCritical = audit.isCritical === true;
  const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
  const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
  const bannerLevel = cardLevel === 'yellow' ? 'yellow' : (isCritical ? 'critical' : 'green');
  const message = formatTokenCard(token, audit, chLang, cardLevel, { slim: true });
  const silent = ch.settings?.silentNotification === true;
  const banner = opts.customBannerFileId
    ? { photoFileId: opts.customBannerFileId }
    : solanaBannerSource(bannerLevel);
  const r = await sendCardToChannel(ch, { text: message, ...banner, silent, chain: 'solana' });
  if (!r.ok) return { ok: false, error: r.error };

  const hasPhoto = !!(banner.photoFileId || banner.photoLocalPath);
  const cmEntry = r.messageId ? {
    chatId: ch.id,
    messageId: r.messageId,
    hasPhoto,
    originalText: message,
    lang: chLang,
    via: r.via,
  } : null;
  if (cmEntry) {
    await sendBotAnalysisFollowup(ch, cmEntry, token, audit, chLang, cardLevel);
    registerWatch(token, audit, [cmEntry]);
  }
  channels.recordSuccess(ch.id);
  return { ok: true, cmEntry };
}

async function processManualPost(chatId, userId, arg, lang) {
  if (!arg) {
    return bot.sendMessage(chatId, t('post.usage', lang), { parse_mode: 'HTML' });
  }
  const adminChannels = [];
  for (const ch of channels.list()) {
    if (await isChatAdmin(ch.id, userId)) adminChannels.push(ch);
  }
  if (!adminChannels.length) {
    return bot.sendMessage(chatId, t('settings.noChannels', lang));
  }

  await bot.sendMessage(chatId, t('post.fetching', lang));
  const sol = chainsRegistry.getChain('solana');
  let token;
  let audit;
  try {
    token = await sol.resolveTokenFromInput(arg);
    if (token) {
      token.chain = 'solana';
      await ensureShareEnrichment(token);
      applyTokenBadges(token);
      audit = sol.auditToken(token);
    }
  } catch (err) {
    console.error('[post]', err.message);
    return bot.sendMessage(chatId, t('post.notFound', lang));
  }
  if (!token || !audit) {
    return bot.sendMessage(chatId, t('post.notFound', lang));
  }

  setPendingPost(userId, { token, audit });

  const isCritical = audit.isCritical === true;
  const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
  const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
  let preview = wrapEmojis(formatTokenCard(token, audit, lang, cardLevel, { slim: true }), 'solana');
  try {
    if (userbot.isEnabled()) await userbot.sendMessage(chatId, preview, { silent: false });
    else await bot.sendMessage(chatId, preview, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (_) { /* yoksay */ }

  const kb = adminChannels.map((ch) => ([
    { text: ch.title || `Chat ${ch.id}`, callback_data: `post:ch:${ch.id}` },
  ]));
  kb.push([{ text: t('settings.close', lang), callback_data: 'post:cancel' }]);
  return bot.sendMessage(chatId, t('post.pickChannel', lang), {
    reply_markup: { inline_keyboard: kb },
  });
}

async function sendSettingsWithBanner(chatId, text, keyboard) {
  const replyMarkup = inlineKeyboard(keyboard);
  const CAPTION_LIMIT = 1024;
  const tooLong = text && text.length > CAPTION_LIMIT;

  async function sendCombined(photoArg) {
    const fo = telegramLocalPhotoFileOpts(photoArg);
    const opts = {
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    };
    try {
      return fo
        ? await bot.sendPhoto(chatId, photoArg, opts, fo)
        : await bot.sendPhoto(chatId, photoArg, opts);
    } catch (e) {
      console.warn('[settings] caption markdown fail:', e?.message);
      const plain = text.replace(/\*/g, '');
      const opts2 = { caption: plain, reply_markup: replyMarkup };
      return fo
        ? await bot.sendPhoto(chatId, photoArg, opts2, fo)
        : await bot.sendPhoto(chatId, photoArg, opts2);
    }
  }

  if (!tooLong) {
    if (INFO_BANNER_FILE_ID) {
      try {
        return await sendCombined(INFO_BANNER_FILE_ID);
      } catch (e) {
        INFO_BANNER_FILE_ID = null;
      }
    }
    const local = fs.existsSync(INFO_BANNER_LOCAL_PATH)
      ? INFO_BANNER_LOCAL_PATH
      : localBanner('green');
    if (local) {
      try {
        const sent = await sendCombined(local);
        const photos = sent?.photo;
        if (photos?.length) INFO_BANNER_FILE_ID = photos[photos.length - 1].file_id;
        return sent;
      } catch (e) {
        console.warn('[settings] banner upload fail:', e?.message);
      }
    }
  }

  try {
    return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
  } catch (e) {
    const plain = text.replace(/\*/g, '');
    return bot.sendMessage(chatId, plain, { reply_markup: replyMarkup });
  }
}

bindTextCommand(/^\/ping(@\w+)?$/i, async (msg) => {
  await bot.sendMessage(msg.chat.id, '🏓 pong — bot çalışıyor');
});

async function openDmChannelSettings(dmChatId, userId, channelId) {
  const targetId = String(channelId);
  const ch = channels.get(targetId);
  const lang = users.getLang(userId) || ch?.settings?.lang || DEFAULT_LANG;
  if (!ch) {
    return bot.sendMessage(dmChatId, t('cmd.channelNotFound', lang));
  }
  if (!(await isChatAdmin(targetId, userId))) {
    return bot.sendMessage(dmChatId, t('cmd.notChannelAdmin', lang));
  }
  setDmTarget(userId, targetId);
  const welcomeId = ch.settings?.welcomeMessageId;
  if (welcomeId) {
    bot.deleteMessage(targetId, welcomeId).catch(() => {});
    channels.updateSetting(targetId, 'welcomeMessageId', null);
  }
  const { text, keyboard } = settingsUI.renderMenu('main', targetId);
  const composed = `${t('cmd.settingsFor', lang, { name: ch.title })}\n\n${text}`;
  return sendSettingsWithBanner(dmChatId, composed, keyboard);
}

async function handleSettings(msg) {
  const lang = langForMsg(msg);
  const uid = actorUserId(msg);

  if (msg.chat.type !== 'private') {
    return bot.sendMessage(
      msg.chat.id,
      lang === 'tr'
        ? '⚙️ Ayarlar özel mesajda açılır. Kanaldaki *Ayarları aç (DM)* butonuna basın.'
        : '⚙️ Settings open in DM. Use the *Open Settings (DM)* button in the channel.',
      { parse_mode: 'Markdown' },
    );
  }

  if (!uid) {
    return bot.sendMessage(msg.chat.id, t('cmd.adminOnly', lang));
  }

  const adminChannels = [];
  for (const ch of channels.list()) {
    if (await isChatAdmin(ch.id, uid)) adminChannels.push(ch);
  }
  if (!adminChannels.length) {
    return bot.sendMessage(msg.chat.id, t('settings.noChannels', lang));
  }
  if (adminChannels.length === 1) {
    setDmTarget(uid, adminChannels[0].id);
    const { text, keyboard } = settingsUI.renderMenu('main', adminChannels[0].id);
    return sendSettingsWithBanner(
      msg.chat.id,
      `${t('cmd.settingsFor', lang, { name: adminChannels[0].title })}\n\n${text}`,
      keyboard,
    );
  }
  const kb = adminChannels.map((ch) => [{ text: ch.title || String(ch.id), callback_data: `pickchat:${ch.id}` }]);
  return bot.sendMessage(msg.chat.id, t('cmd.pickChannel', lang), { reply_markup: { inline_keyboard: kb } });
}

bindTextCommand(/^\/settings(@\w+)?$/i, handleSettings);

bindTextCommand(/^\/start(@\w+)?(\s+(.+))?$/, async (msg, match) => {
  if (msg.chat.type !== 'private') {
    channels.add(msg.chat, msg.from?.username || 'cmd');
  }

  const param = (match && match[3] || '').trim();
  if (param.startsWith('settings_') && msg.chat.type === 'private') {
    const targetId = param.slice('settings_'.length).trim();
    if (targetId) {
      if (!users.getLang(msg.from.id)) {
        pendingChannelAfterLang.set(String(msg.from.id), targetId);
        return bot.sendMessage(msg.chat.id, t('welcome.langPick', 'en'), {
          reply_markup: {
            inline_keyboard: [[
              { text: '🇬🇧 English', callback_data: 'startlang:en' },
              { text: '🇹🇷 Türkçe', callback_data: 'startlang:tr' },
              { text: '🇷🇺 Русский', callback_data: 'startlang:ru' },
            ]],
          },
        });
      }
      return openDmChannelSettings(msg.chat.id, msg.from.id, targetId);
    }
  }

  if (msg.chat.type === 'private' && !users.getLang(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t('welcome.langPick', 'en'), {
      reply_markup: {
        inline_keyboard: [[
          { text: '🇬🇧 English', callback_data: 'startlang:en' },
          { text: '🇹🇷 Türkçe', callback_data: 'startlang:tr' },
          { text: '🇷🇺 Русский', callback_data: 'startlang:ru' },
        ]],
      },
    });
  }

  const lang = langForMsg(msg);
  await bot.sendMessage(msg.chat.id, t('welcome.start', lang), { parse_mode: 'Markdown' });
});

bindTextCommand(/^\/post(@\w+)?(?:\s+([\s\S]+))?$/, async (msg, match) => {
  if (msg.chat.type !== 'private') return;
  return processManualPost(msg.chat.id, msg.from.id, (match[2] || '').trim(), langForMsg(msg));
});

bindTextCommand(/^\/scan(@\w+)?$/i, async (msg) => {
  if (!isBotAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Admin only.');
  }
  await bot.sendMessage(msg.chat.id, '🔍 Tarama başlatılıyor…');
  const r = await runScan('manual');
  const lang = langForMsg(msg);
  await bot.sendMessage(
    msg.chat.id,
    `✅ Bitti: ${r.tokensShared || 0} paylaşım, ${r.found || 0} aday, ${r.errors || 0} hata (${r.durationMs || 0}ms)`,
    { parse_mode: 'HTML' },
  );
});

bindTextCommand(/^\/wl(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  if (!isBotAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Sadece bot admin.');
  }
  const rest = (match[1] || '').trim();
  if (!rest || rest === 'list') {
    const entries = whitelist.listEntries('solana');
    if (!entries.length) {
      return bot.sendMessage(
        msg.chat.id,
        'ℹ Whitelist boş.\n\n<code>/wl add solana MINT... Etiket</code>\n<code>/wl remove solana MINT...</code>',
        { parse_mode: 'HTML' },
      );
    }
    const lines = ['📋 <b>Whitelist</b> (Solana)', ''];
    for (const e of entries.slice(0, 40)) {
      lines.push(`• ${escapeHtmlLite(e.label)} — <code>${escapeHtmlLite(e.address)}</code>`);
    }
    return bot.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'HTML' });
  }
  const addM = rest.match(/^add\s+solana\s+(\S+)(?:\s+(.+))?$/i);
  if (addM) {
    const r = whitelist.addEntry({ chain: 'solana', address: addM[1], label: addM[2]?.trim(), addedBy: msg.from.id });
    if (!r.ok) return bot.sendMessage(msg.chat.id, `❌ ${r.error}`);
    return bot.sendMessage(msg.chat.id, `✅ ${escapeHtmlLite(r.entry.label)}`, { parse_mode: 'HTML' });
  }
  const remM = rest.match(/^remove\s+solana\s+(\S+)$/i);
  if (remM) {
    const r = whitelist.removeEntry('solana', remM[1]);
    return bot.sendMessage(msg.chat.id, r.removed ? '✅ Silindi.' : 'ℹ Bulunamadı.');
  }
  return bot.sendMessage(msg.chat.id, '<code>/wl add solana MINT... Etiket</code>', { parse_mode: 'HTML' });
});

bindTextCommand(/^\/stats(@\w+)?$/i, (msg) => {
  const lang = langForMsg(msg);
  const ch = channels.count();
  const bundle = storage.getStatsBundle();
  const body = statsReport.formatSubscriberStats(bundle, lang);
  const tail = `\n\n📢 Kanal: ${ch.total} (${ch.enabled} aktif) · ⏱ ${formatUptime(process.uptime())}`;
  bot.sendMessage(msg.chat.id, body + tail, { parse_mode: 'HTML', disable_web_page_preview: true });
});

bot.on('my_chat_member', async (upd) => {
  const chat = upd.chat;
  const newStatus = upd.new_chat_member?.status;
  const oldStatus = upd.old_chat_member?.status;

  if (['administrator', 'member'].includes(newStatus) && !['administrator', 'member'].includes(oldStatus)) {
    channels.add(chat, upd.from?.username || 'auto');
    console.log(`➕ ${chat.title || chat.id} (${chat.type}) — Toplam: ${channels.count().total}`);

    if (newStatus === 'administrator' && chat.type !== 'private') {
      const channelName = chat.title || 'Channel';
      const lang = channels.getSettings(chat.id)?.lang || DEFAULT_LANG;
      const me = await bot.getMe().catch(() => null);
      const username = me?.username || 'bot';
      const deeplink = `https://t.me/${username}?start=settings_${chat.id}`;
      const welcomeMsg = t('welcome.added', lang, { name: channelName });
      const sent = await bot.sendMessage(chat.id, welcomeMsg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[
            { text: t('settings.open', lang), url: deeplink },
          ]],
        },
      }).catch((e) => {
        console.warn('[welcome] channel msg fail:', e?.message);
        return null;
      });
      if (sent?.message_id) {
        channels.updateSetting(chat.id, 'welcomeMessageId', sent.message_id);
      }
    }
  }

  if (['left', 'kicked'].includes(newStatus)) {
    channels.remove(chat.id);
    console.log(`➖ ${chat.title || chat.id} silindi`);
  }
});

bot.on('photo', async (msg) => {
  if (!msg.from || !msg.photo?.length) return;
  const userId = msg.from.id;
  const targetChatId = msg.chat.type === 'private' ? getDmTarget(userId) : msg.chat.id;
  if (!targetChatId || !consumePendingBanner(targetChatId, userId)) return;
  if (!(await isChatAdmin(targetChatId, userId))) return;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  channels.updateSetting(targetChatId, 'bannerFileId', fileId);
  await bot.sendMessage(msg.chat.id, t('cmd.bannerSaved', langForMsg(msg))).catch(() => {});
});

bot.on('callback_query', async (cb) => {
  const userId = cb.from.id;
  const fromChatId = cb.message?.chat?.id;
  const cbLang = langForMsg(cb);
  const isDM = cb.message?.chat?.type === 'private';

  if (cb.data?.startsWith('startlang:')) {
    const code = normalizeLang(cb.data.slice('startlang:'.length));
    users.setLang(userId, code);
    const pendingCh = pendingChannelAfterLang.get(String(userId));
    if (pendingCh) {
      pendingChannelAfterLang.delete(String(userId));
      channels.updateSetting(pendingCh, 'lang', code);
      await bot.editMessageText(t('welcome.langSet', code), {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
      }).catch(() => {});
      await bot.answerCallbackQuery(cb.id, { text: t('welcome.langSet', code) });
      return openDmChannelSettings(fromChatId, userId, pendingCh);
    }
    const newText = `${t('welcome.langSet', code)}\n\n${t('welcome.start', code)}`;
    await bot.editMessageText(newText, {
      chat_id: fromChatId,
      message_id: cb.message.message_id,
      parse_mode: 'Markdown',
    }).catch(() => {});
    return bot.answerCallbackQuery(cb.id, { text: t('welcome.langSet', code) });
  }

  if (cb.data?.startsWith('pickchat:')) {
    const targetId = parseInt(cb.data.slice('pickchat:'.length), 10);
    const ch = channels.get(targetId);
    if (!ch) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.channelNotFound', cbLang), show_alert: true });
    }
    if (!(await isChatAdmin(targetId, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.notChannelAdmin', cbLang), show_alert: true });
    }
    setDmTarget(userId, targetId);
    const { text, keyboard } = settingsUI.renderMenu('main', targetId);
    const composed = `${t('cmd.settingsFor', cbLang, { name: ch.title })}\n\n${text}`;
    await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
    await sendSettingsWithBanner(fromChatId, composed, keyboard);
    return bot.answerCallbackQuery(cb.id);
  }

  if (cb.data?.startsWith('post:ch:') || cb.data === 'post:cancel') {
    if (cb.data === 'post:cancel') {
      clearPendingPost(userId);
      await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.closed', cbLang) });
    }
    const pending = getPendingPost(userId);
    if (!pending) {
      return bot.answerCallbackQuery(cb.id, { text: t('post.notFound', cbLang) });
    }
    const ch = channels.get(cb.data.slice('post:ch:'.length));
    if (!ch || !(await isChatAdmin(ch.id, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: 'Yetki yok' });
    }
    const fc = channels.tokenPassesChannelFilters(pending.token, pending.audit, ch, { skipAge: true });
    if (!fc.pass) {
      return bot.answerCallbackQuery(cb.id, { text: fc.reason, show_alert: true });
    }
    const r = await shareTokenToChannel(ch, pending.token, pending.audit);
    clearPendingPost(userId);
    await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
    if (r.ok) {
      await bot.sendMessage(fromChatId, t('post.sent', cbLang, { count: 1 }));
      return bot.answerCallbackQuery(cb.id, { text: 'OK' });
    }
    await bot.sendMessage(fromChatId, `❌ ${r.error}`);
    return bot.answerCallbackQuery(cb.id);
  }

  if (cb.data === 'manual:start') {
    const targetChatId = isDM ? (getDmTarget(userId) || fromChatId) : fromChatId;
    if (targetChatId) setDmTarget(userId, targetChatId);
    const prompt = cbLang === 'tr'
      ? '📤 <b>Manuel Paylaş</b>\n\nSolana mint veya DexScreener linki gönderin.\n<i>5 dakika içinde.</i>'
      : cbLang === 'ru'
        ? '📤 <b>Ручной пост</b>\n\nОтправьте mint Solana или ссылку DexScreener.\n<i>5 минут.</i>'
        : '📤 <b>Manual post</b>\n\nSend a Solana mint or DexScreener link.\n<i>Within 5 minutes.</i>';
    await bot.sendMessage(fromChatId, prompt, { parse_mode: 'HTML' }).catch(() => {});
    return bot.answerCallbackQuery(cb.id);
  }

  if (cb.data?.startsWith('menu:') || cb.data?.startsWith('set:') || cb.data?.startsWith('dex:')
    || cb.data?.startsWith('tgl:') || cb.data?.startsWith('tgf:') || cb.data?.startsWith('profile:')
    || cb.data?.startsWith('rst:') || cb.data === 'reset') {
    const targetChatId = isDM ? (getDmTarget(userId) || fromChatId) : fromChatId;
    if (!targetChatId) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.noChannelPicked', cbLang), show_alert: true });
    }
    if (!(await isChatAdmin(targetChatId, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.adminOnlyShort', cbLang) });
    }
    if (cb.data === 'menu:banner') {
      setPendingBanner(targetChatId, userId);
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.bannerPrompt', cbLang) || 'Foto gönder' });
    }
    if (cb.data?.startsWith('set:lang:') && isDM) {
      users.setLang(userId, cb.data.slice('set:lang:'.length));
    }
    const result = settingsUI.handleCallback(cb.data, targetChatId);
    if (result?.close) {
      await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.closed', cbLang) });
    }
    if (result?.awaitBannerUpload) setPendingBanner(targetChatId, userId);
    if (result?.toast) bot.answerCallbackQuery(cb.id, { text: result.toast }).catch(() => {});
    else bot.answerCallbackQuery(cb.id).catch(() => {});
    if (result?.menu) {
      const { text, keyboard } = settingsUI.renderMenu(result.menu, targetChatId);
      const markup = inlineKeyboard(keyboard);
      const isPhoto = !!cb.message?.photo;
      const editOpts = {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: markup,
      };
      const editFn = isPhoto
        ? () => bot.editMessageCaption(text, editOpts)
        : () => bot.editMessageText(text, editOpts);
      await editFn().catch(async (err) => {
        if (String(err?.message || '').includes('not modified')) return;
        const plain = text.replace(/\*/g, '');
        const plainOpts = {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          reply_markup: markup,
        };
        if (isPhoto) {
          await bot.editMessageCaption(plain, plainOpts).catch(() => {});
        } else {
          await bot.editMessageText(plain, plainOpts).catch(() => {});
        }
      });
    }
    return;
  }

  return bot.answerCallbackQuery(cb.id);
});

bot.on('polling_error', (err) => console.error('Polling error:', err?.message || err));

async function main() {
  const me = await bot.getMe();
  console.log(`✅ Solana bot: @${me.username}`);
  console.log(`   Tarama: ${SOLANA_SCAN_ENABLED ? `AÇIK (${SOLANA_SCAN_INTERVAL_MIN} dk)` : 'KAPALI'}`);
  console.log(`   İzleme: ${WATCH_INTERVAL_SEC} sn`);

  await bot.setMyCommands([
    { command: 'start', description: 'Başlangıç / dil' },
    { command: 'settings', description: 'Kanal ayarları' },
    { command: 'post', description: 'Manuel token paylaş (DM)' },
    { command: 'ping', description: 'Bot canlı mı?' },
    { command: 'stats', description: 'İstatistikler' },
  ]).catch((e) => console.warn('setMyCommands:', e?.message));

  await userbot.getClient();

  if (SOLANA_SCAN_ENABLED) {
    setTimeout(() => runScan('cron'), 15_000);
    setInterval(() => runScan('cron'), SOLANA_SCAN_INTERVAL_MIN * 60 * 1000);
  }
  setInterval(() => {
    checkWatchedTokens().catch((e) => console.error('[watch]', e.message));
  }, WATCH_INTERVAL_SEC * 1000);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
