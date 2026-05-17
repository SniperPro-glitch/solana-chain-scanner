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

async function sendBotAnalysisFollowup(ch, cmEntry, token, audit, lang) {
  if (!ch || !cmEntry || !token || !audit) return;
  const sym = token.tokenSymbol || '?';
  const body = formatAnalysisOnly(token, audit, lang);
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
  try {
    const m = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(m.status);
  } catch {
    return false;
  }
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
  const message = formatTokenCard(token, audit, chLang, cardLevel, { compact: true });
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
    await sendBotAnalysisFollowup(ch, cmEntry, token, audit, chLang);
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
  let preview = wrapEmojis(formatTokenCard(token, audit, lang, cardLevel, { compact: true }), 'solana');
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
  const local = localBanner('green');
  if (local) {
    return bot.sendPhoto(chatId, local, {
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

bot.onText(/^\/start(@\w+)?/, async (msg) => {
  const lang = langForMsg(msg);
  await bot.sendMessage(msg.chat.id, t('welcome.start', lang), { parse_mode: 'HTML' });
});

bot.onText(/^\/post(@\w+)?(?:\s+([\s\S]+))?$/, async (msg, match) => {
  if (msg.chat.type !== 'private') return;
  return processManualPost(msg.chat.id, msg.from.id, (match[2] || '').trim(), langForMsg(msg));
});

bot.onText(/^\/scan(@\w+)?$/, async (msg) => {
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

bot.onText(/^\/wl(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
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

bot.onText(/^\/stats(@\w+)?$/, (msg) => {
  const lang = langForMsg(msg);
  const ch = channels.count();
  const bundle = storage.getStatsBundle();
  const body = statsReport.formatSubscriberStats(bundle, lang);
  const tail = `\n\n📢 Kanal: ${ch.total} (${ch.enabled} aktif) · ⏱ ${formatUptime(process.uptime())}`;
  bot.sendMessage(msg.chat.id, body + tail, { parse_mode: 'HTML', disable_web_page_preview: true });
});

bot.onText(/^\/settings(@\w+)?$/, async (msg) => {
  const lang = langForMsg(msg);
  if (msg.chat.type !== 'private') {
    if (!(await isChatAdmin(msg.chat.id, msg.from.id))) {
      return bot.sendMessage(msg.chat.id, t('cmd.adminOnly', lang));
    }
    if (!channels.get(msg.chat.id)) channels.add(msg.chat, msg.from?.username || 'cmd');
    channels.updateSetting(msg.chat.id, 'chains', ['solana']);
    const { text, keyboard } = settingsUI.renderMenu('main', msg.chat.id);
    return sendSettingsWithBanner(msg.chat.id, text, keyboard);
  }
  const adminChannels = [];
  for (const ch of channels.list()) {
    if (await isChatAdmin(ch.id, msg.from.id)) adminChannels.push(ch);
  }
  if (!adminChannels.length) {
    return bot.sendMessage(msg.chat.id, t('settings.noChannels', lang));
  }
  if (adminChannels.length === 1) {
    setDmTarget(msg.from.id, adminChannels[0].id);
    const { text, keyboard } = settingsUI.renderMenu('main', adminChannels[0].id);
    return sendSettingsWithBanner(msg.chat.id, `${t('cmd.settingsFor', lang, { name: adminChannels[0].title })}\n\n${text}`, keyboard);
  }
  const kb = adminChannels.map((ch) => [{ text: ch.title || String(ch.id), callback_data: `pickchat:${ch.id}` }]);
  return bot.sendMessage(msg.chat.id, t('cmd.pickChannel', lang), { reply_markup: { inline_keyboard: kb } });
});

bot.on('my_chat_member', async (upd) => {
  const chat = upd.chat;
  const st = upd.new_chat_member?.status;
  if (st === 'administrator' || st === 'member') {
    channels.add(chat, upd.from?.username || 'auto');
    channels.updateSetting(chat.id, 'chains', ['solana']);
    console.log(`📢 Kanal: ${chat.title || chat.id}`);
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

  if (cb.data?.startsWith('pickchat:')) {
    const chId = cb.data.slice('pickchat:'.length);
    setDmTarget(userId, chId);
    const { text, keyboard } = settingsUI.renderMenu('main', chId);
    await bot.editMessageText(text, {
      chat_id: fromChatId,
      message_id: cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }).catch(() => {});
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

  if (cb.data?.startsWith('menu:') || cb.data?.startsWith('set:') || cb.data?.startsWith('dex:') || cb.data?.startsWith('tgl:')) {
    const targetChatId = cb.message.chat.type === 'private' ? (getDmTarget(userId) || fromChatId) : fromChatId;
    if (!(await isChatAdmin(targetChatId, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.adminOnly', cbLang) });
    }
    if (cb.data === 'menu:banner') {
      setPendingBanner(targetChatId, userId);
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.bannerPrompt', cbLang) || 'Foto gönder' });
    }
    const result = settingsUI.handleCallback(cb.data, targetChatId);
    if (result?.toast) bot.answerCallbackQuery(cb.id, { text: result.toast }).catch(() => {});
    else bot.answerCallbackQuery(cb.id).catch(() => {});
    if (result?.menu) {
      const { text, keyboard } = settingsUI.renderMenu(result.menu, targetChatId);
      await bot.editMessageText(text, {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }).catch(() => {});
    }
    return;
  }

  return bot.answerCallbackQuery(cb.id);
});

async function main() {
  const me = await bot.getMe();
  console.log(`✅ Solana bot: @${me.username}`);
  console.log(`   Tarama: ${SOLANA_SCAN_ENABLED ? `AÇIK (${SOLANA_SCAN_INTERVAL_MIN} dk)` : 'KAPALI'}`);
  console.log(`   İzleme: ${WATCH_INTERVAL_SEC} sn`);
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
