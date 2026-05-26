// Sniper Scan Bot — TON + BSC + Solana (tek BOT_TOKEN)

require('dotenv').config();
require('./envBootstrap').applyHeliusEnv();
if (process.env.NTBA_FIX_350 === undefined || String(process.env.NTBA_FIX_350).trim() === '') {
  process.env.NTBA_FIX_350 = '1';
}

const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const chainsRegistry = require('./chains');
const {
  formatAnalysisOnly,
  formatRiskBanner,
} = require('./chains/solana/formatter');
const {
  formatTokenCardForChain,
  bannerSourceForChain,
  isScanEnabled,
  scanIntervalMin,
  scanPoolLimit,
} = require('./chainRuntime');
const channels = require('./channels');
const storage = require('./storage');
const users = require('./users');
const botSubscribers = require('./botSubscribers');
const settingsUI = require('./settings-ui');
const statsReport = require('./statsReport');
const whitelist = require('./whitelist');
const { ensureShareEnrichment } = require('./shareEnrich');
const { t, normalizeLang, DEFAULT_LANG } = require('./i18n');
const { wrapEmojis } = require('./emojiPack');
const { trimForCaption } = require('./cardCaption');
const userbot = require('./userbot');
const { createScanRunner } = require('./scanRunner');
const { createWatchRunner } = require('./watchRunner');
const reportStore = require('./reportStore');
const { formatTrustTeaserComment } = require('./trustTeaser');
const { startMiniAppServer, buildWebAppUrl, getWebAppBaseUrl, getWebAppEntryUrl } = require('./miniAppServer');

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ? String(process.env.ADMIN_USER_ID) : null;
const TON_SCAN_ENABLED = isScanEnabled('ton');
const BSC_SCAN_ENABLED = isScanEnabled('bsc');
const SOLANA_SCAN_ENABLED = isScanEnabled('solana');
const MAX_TOKENS_PER_SCAN = parseInt(process.env.MAX_TOKENS_PER_SCAN || '8', 10);
const SCAN_POOL_FETCH_LIMIT = parseInt(process.env.SOLANA_SCAN_POOL_LIMIT || '12', 10);
const SCAN_TOKEN_GAP_MS = parseInt(process.env.SOLANA_SCAN_TOKEN_GAP_MS || '1200', 10);
const WATCH_INTERVAL_SEC = parseInt(process.env.WATCH_INTERVAL_SECONDS || '60', 10);
const WATCH_BATCH_SIZE = Math.min(6, Math.max(2, parseInt(process.env.WATCH_BATCH_SIZE || '3', 10)));
const WATCH_BATCH_DELAY_MS = Math.min(1200, Math.max(200, parseInt(process.env.WATCH_BATCH_DELAY_MS || '400', 10)));

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tanımlı değil.');
  console.error('   Scan bot servisi: BOT_TOKEN = BotFather token');
  console.error('   DEX servisi: BOT_TOKEN KOYMA — Variables → MINIAPP_ONLY=1');
  console.error('   (TELEGRAM_BOT_TOKEN da kabul edilir)');
  process.exit(1);
}

const ALLOWED_UPDATES = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'callback_query',
  'my_chat_member',
  'chat_member',
];

const POLLING_PARAMS = {
  allowed_updates: ALLOWED_UPDATES,
};

/** Polling başlamadan önce oluşturulur; main() içinde startPolling() çağrılır (409 / webhook çakışması önlemi). */
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const BOT_BOOT_TIME = Date.now();
const CHANNEL_LEFT_GRACE_MS = Math.max(
  60_000,
  parseInt(process.env.CHANNEL_LEFT_GRACE_MS || '180000', 10),
);

let polling409Streak = 0;

function isPollingConflictError(err) {
  const msg = String(err?.message || err?.response?.body?.description || err || '');
  const code = err?.response?.statusCode || err?.code;
  return code === 409 || /409|Conflict|terminated by other getUpdates|another bot instance/i.test(msg);
}

/** Telegram bazen yalnızca my_chat_member dinler (mesajlar gelmez) — boş webhook ile sıfırla */
async function resetBotAllowedUpdates() {
  try {
    const base = `https://api.telegram.org/bot${BOT_TOKEN}`;
    await fetch(`${base}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: '',
        allowed_updates: ALLOWED_UPDATES,
        drop_pending_updates: false,
      }),
    });
    await fetch(`${base}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const wh = await bot.getWebHookInfo().catch(() => null);
    const au = wh?.allowed_updates || [];
    const hasMessage = au.includes('message');
    console.log(`[bot] allowed_updates: ${hasMessage ? 'message OK' : 'UYARI ' + JSON.stringify(au)}`);
  } catch (e) {
    console.warn('[bot] allowed_updates reset:', e?.message || e);
  }
}

async function prepareTelegramConnection() {
  await resetBotAllowedUpdates();
  try {
    await bot.deleteWebHook({ drop_pending_updates: false });
  } catch (e) {
    console.warn('[bot] deleteWebHook:', e?.message || e);
  }
  const wh = await bot.getWebHookInfo().catch(() => null);
  if (wh?.url) {
    console.warn(`[bot] Önceki webhook kaldırıldı: ${wh.url}`);
  }
}

async function startBotPolling() {
  await prepareTelegramConnection();
  // getUpdates ile kuyruk temizleme YAPMA — /start ve DM mesajları siliniyordu
  await bot.startPolling({ params: POLLING_PARAMS });
  console.log('[bot] long polling başladı (mesajlar dinleniyor)');
}

function handlePollingError(err) {
  const msg = err?.message || String(err);
  console.error('Polling error:', msg);
  if (!isPollingConflictError(err)) return;

  polling409Streak += 1;
  console.error('❌ 409 Conflict — aynı BOT_TOKEN başka bir yerde de dinleniyor.');
  console.error('   • PC\'de `npm run dev` / `npm start` çalışıyorsa KAPATIN (sadece Railway kalsın).');
  console.error('   • Railway\'de bu token ile ikinci servis/replica olmamalı (Replicas = 1).');
  console.error('   • TON bot token\'ı ile Solana token\'ı karıştırmayın — her bot ayrı BOT_TOKEN.');
  console.error('   • BotFather → /mybots → bot → API Token = Railway BOT_TOKEN ile aynı olmalı.');

  if (polling409Streak >= 5) {
    console.error('[bot] 5x 409 → polling durduruluyor (çift instance).');
    bot.stopPolling().finally(() => process.exit(1));
  }
}

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

function hasUserbotCredentials() {
  return !!(
    process.env.TG_API_ID
    && process.env.TG_API_HASH
    && String(process.env.TG_SESSION || '').trim()
  );
}

/** Userbot tercih edilir; yalnızca STRICT + geçerli session yoksa kanala post engellenir. */
function isChannelUserbotStrict() {
  const v = (process.env.CHANNEL_USERBOT_REQUIRED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

function preferUserbotForChannel() {
  if (!hasUserbotCredentials()) return false;
  if (isChannelUserbotStrict()) return true;
  return hasUserbotCredentials();
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

function prepareCardHtml(text, chain, hasPhoto) {
  if (hasPhoto) {
    const { text: trimmed, trimmed: wasTrimmed, visible } = trimForCaption(text, chain);
    if (wasTrimmed) {
      console.warn(`[card] caption kırpıldı (~${visible} görünür karakter)`);
    }
    return trimmed;
  }
  return wrapEmojis(text, chain);
}

async function sendCardToChannel(ch, opts) {
  const ubStrict = isChannelUserbotStrict();
  const wantUserbot = preferUserbotForChannel() && ch?.settings?.userbotEnabled !== false;
  const useUserbot = wantUserbot && userbot.isEnabled();
  const silent = opts.silent === true;
  const text = opts.text || '';
  const photoFileId = opts.photoFileId || null;
  const photoLocalPath = opts.photoLocalPath || null;
  const hasPhoto = !!(photoFileId || photoLocalPath);
  const chain = opts.chain || 'solana';
  const html = prepareCardHtml(text, chain, hasPhoto);
  const sendAsChannel = process.env.USERBOT_SEND_AS_CHANNEL === '1';

  if (ubStrict && !hasUserbotCredentials()) {
    return {
      ok: false,
      error: 'Userbot gerekli: Railway\'de TG_API_ID, TG_API_HASH ve TG_SESSION tanımlayın (veya CHANNEL_USERBOT_REQUIRED=0).',
      via: 'none',
    };
  }

  if (wantUserbot && !userbot.isEnabled()) {
    console.warn('[post] Userbot bağlı değil → Bot API (premium emoji düz metin olabilir). TG_SESSION kontrol edin.');
  }

  if (useUserbot) {
    try {
      if (hasPhoto) {
        const buf = await _resolvePhotoBuffer(photoFileId, photoLocalPath);
        if (buf) {
          const r = await userbot.sendFile(ch.id, buf, html, { silent, sendAsChannel });
          if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot' };
        }
      }
      const r = await userbot.sendMessage(ch.id, html, { silent, sendAsChannel });
      if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot' };
    } catch (e) {
      if (ubStrict) {
        console.warn('[post] Userbot gönderim hatası, Bot API deneniyor:', e.message);
      }
    }
  }

  try {
    if (hasPhoto) {
      const photoArg = photoLocalPath || photoFileId;
      const msg = await bot.sendPhoto(ch.id, photoArg, {
        caption: html,
        parse_mode: 'HTML',
        disable_notification: silent,
        ...telegramLocalPhotoFileOpts(photoArg),
      });
      return { ok: true, messageId: msg.message_id, via: 'bot' };
    }
    const msg = await bot.sendMessage(ch.id, html, {
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

  const prepared = prepareCardHtml(caption || fullText || '', chain, hasPhoto);

  if (via === 'userbot' && userbot.isEnabled()) {
    try {
      if (hasPhoto && (photoFileId || photoLocalPath)) {
        const buf = await _resolvePhotoBuffer(photoFileId, photoLocalPath);
        if (buf) {
          const r = await userbot.editMessageMedia(msg.chatId, msg.messageId, buf, prepared);
          if (r.ok) return { ok: true, via: 'userbot' };
        }
      } else {
        const r = await userbot.editMessage(msg.chatId, msg.messageId, prepared);
        if (r.ok) return { ok: true, via: 'userbot' };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  try {
    if (hasPhoto) {
      await bot.editMessageCaption(prepared, {
        chat_id: msg.chatId,
        message_id: msg.messageId,
        parse_mode: 'HTML',
      });
    } else {
      await bot.editMessageText(prepared, {
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

const linkedDiscussionCache = new Map();

async function getLinkedDiscussionChatId(channelChatId) {
  const key = String(channelChatId);
  if (linkedDiscussionCache.has(key)) return linkedDiscussionCache.get(key);
  try {
    const info = await bot.getChat(channelChatId);
    const linked = info.linked_chat_id || null;
    linkedDiscussionCache.set(key, linked);
    return linked;
  } catch (e) {
    linkedDiscussionCache.set(key, null);
    return null;
  }
}

/** Kanal postunun tartışma grubundaki karşılığı (yorum için). */
async function resolveDiscussionReplyTarget(channelChatId, channelPostMessageId) {
  try {
    const dm = await bot._request('getDiscussionMessage', {
      form: { chat_id: channelChatId, message_id: channelPostMessageId },
    });
    if (dm?.chat?.id && dm?.message?.message_id) {
      return { chatId: dm.chat.id, messageId: dm.message.message_id, mode: 'discussion' };
    }
  } catch (_) { /* tartışma yok veya API */ }

  const linked = await getLinkedDiscussionChatId(channelChatId);
  if (linked) {
    return {
      chatId: linked,
      messageId: channelPostMessageId,
      mode: 'reply_parameters',
      channelChatId,
    };
  }
  return null;
}

async function sendTextToChat(chatId, text, opts = {}) {
  const chain = opts.chain || 'solana';
  const silent = opts.silent === true;
  const wrapped = wrapEmojis(text, chain);
  const replyTo = opts.replyTo;
  const replyParameters = opts.replyParameters;

  const tryUserbot = opts.useUserbot !== false && userbot.isEnabled();
  if (tryUserbot) {
    const r = await userbot.sendMessage(chatId, wrapped, {
      silent,
      replyTo: Number.isInteger(replyTo) ? replyTo : undefined,
    });
    if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot' };
  }

  try {
    const form = {
      chat_id: chatId,
      text: wrapped,
      parse_mode: 'HTML',
      disable_notification: silent,
      disable_web_page_preview: true,
    };
    if (replyParameters) {
      form.reply_parameters = JSON.stringify(replyParameters);
    } else if (replyTo) {
      form.reply_to_message_id = replyTo;
    }
    if (opts.reply_markup) {
      form.reply_markup = JSON.stringify(opts.reply_markup);
    }
    const msg = await bot._request('sendMessage', { form });
    return { ok: true, messageId: msg.message_id, via: 'bot' };
  } catch (e) {
    return { ok: false, error: e.message, via: 'bot' };
  }
}

/** Bot analizi — tartışma grubunda (premium emoji için önce userbot). */
async function sendAnalysisAsChannelComment(ch, channelPostMessageId, text, opts = {}) {
  const target = await resolveDiscussionReplyTarget(ch.id, channelPostMessageId);
  if (!target) return { ok: false, error: 'no_discussion', asComment: false };

  const chain = opts.chain || 'solana';
  const silent = opts.silent === true;
  const html = wrapEmojis(text, chain);
  const useUb = userbot.isEnabled()
    && preferUserbotForChannel()
    && ch?.settings?.userbotEnabled !== false
    && !opts.reply_markup
    && opts.forceBot !== true;

  const replyTo = target.mode === 'discussion' ? target.messageId : undefined;

  if (useUb) {
    const r = await userbot.sendMessage(target.chatId, html, { silent, replyTo });
    if (r.ok) return { ok: true, messageId: r.messageId, via: 'userbot', asComment: true };
    console.warn('[comment] userbot gönderilemedi:', r.error);
  }

  if (target.mode === 'reply_parameters') {
    const r = await sendTextToChat(target.chatId, text, {
      ...opts,
      useUserbot: false,
      forceBot: opts.forceBot,
      reply_markup: opts.reply_markup,
      replyParameters: {
        message_id: target.messageId,
        chat_id: target.channelChatId,
      },
    });
    return { ...r, asComment: !!r.ok };
  }

  const r = await sendTextToChat(target.chatId, text, {
    ...opts,
    useUserbot: false,
    forceBot: opts.forceBot,
    reply_markup: opts.reply_markup,
    replyTo: target.messageId,
  });
  return { ...r, asComment: !!r.ok };
}

async function sendBotAnalysisFollowup(ch, cmEntry, token, audit, lang, cardLevel = 'green', opts = {}) {
  if (!ch || !cmEntry || !token || !audit) return;
  const sym = token.tokenSymbol || '?';
  let body;
  try {
    body = formatTrustTeaserComment(token, audit, lang, cardLevel);
  } catch (e) {
    console.error('[followup] formatTrustTeaser:', sym, e?.message);
    return;
  }
  if (!String(body || '').trim()) {
    console.warn('[followup] boş yorum gövdesi, atlandı:', sym);
    return;
  }
  if (!cmEntry.messageId) {
    console.warn('[followup] kart messageId yok:', sym);
    return;
  }

  let reportId = opts.reportId || null;
  let replyMarkup;
  const { isOfficialFeedChannel } = require('./channelFeedPolicy');
  const includeMiniApp = opts.includeMiniApp !== undefined
    ? !!opts.includeMiniApp
    : isOfficialFeedChannel(ch?.id);
  try {
    if (includeMiniApp) {
      if (!reportId) {
        const { publishToDexFirst } = require('./publishPipeline');
        const listing = await publishToDexFirst(token, audit, lang, cardLevel);
        reportId = listing.reportId;
      } else {
        console.log(`[report] mevcut id=${reportId} sembol=${sym}`);
      }
      if (!opts.reportId) {
        const { recordMiniAppShare } = require('./recordMiniAppShare');
        recordMiniAppShare(ch, token, audit, lang, cardLevel, reportId);
      }
      const webAppUrl = opts.dexAppUrl || buildWebAppUrl(reportId);
      if (webAppUrl && /^https:\/\//i.test(webAppUrl)) {
        replyMarkup = {
          inline_keyboard: [[{
            text: t('comment.openFullReport', lang),
            web_app: { url: webAppUrl },
          }]],
        };
      } else if (webAppUrl) {
        body += `\n\n🔗 <a href="${webAppUrl}">${t('comment.openFullReport', lang)}</a>`;
      }
    }
  } catch (e) {
    console.warn('[followup] report save:', e.message);
  }

  let text = `<b>$${sym}</b>\n${body}`;
  if (text.length > 4080) text = `${text.slice(0, 4056)}\n<i>…</i>`;

  let ar = await sendAnalysisAsChannelComment(ch, cmEntry.messageId, text, {
    silent: true,
    chain: 'solana',
    reply_markup: replyMarkup,
    forceBot: !!replyMarkup,
  });
  if (!ar?.ok) {
    console.warn('[followup] tartışma yorumu yok (%s) → metin yedek (kanal):', ar?.error || '?', sym);
    ar = await sendTextToChat(ch.id, text, { silent: true, chain: 'solana', useUserbot: true });
  }
  if (ar?.ok && ar.messageId) {
    cmEntry.analysisMessageId = ar.messageId;
    cmEntry.analysisVia = ar.via;
    cmEntry.analysisAsComment = ar.asComment === true;
  } else {
    console.error('[followup] analiz gönderilemedi:', sym, ar?.error);
  }
}

const scanDeps = {
  chainsRegistry,
  channels,
  storage,
  sendCardToChannel,
  sendBotAnalysisFollowup,
  ensureShareEnrichment,
  applyTokenBadges,
  MAX_TOKENS_PER_SCAN,
  getScanPoolLimit: scanPoolLimit,
  SCAN_TOKEN_GAP_MS,
};
const { runScan } = createScanRunner(scanDeps);

const { checkWatchedTokens } = createWatchRunner({
  bot,
  chainsRegistry,
  channels,
  storage,
  formatTokenCardForChain,
  formatRiskBannerForChain: require('./chainRuntime').formatRiskBannerForChain,
  bannerSourceForChain,
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
/** Ayarlar → Manuel Paylaş sonrası mint/link bekleme (TON ile aynı). */
const pendingManualInput = new Map();
const MANUAL_INPUT_TIMEOUT_MS = 5 * 60 * 1000;

function setPendingManualInput(userId) {
  pendingManualInput.set(String(userId), {
    expiresAt: Date.now() + MANUAL_INPUT_TIMEOUT_MS,
    bannerFileId: null,
  });
}
function getPendingManualInput(userId) {
  const s = pendingManualInput.get(String(userId));
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    pendingManualInput.delete(String(userId));
    return null;
  }
  return s;
}
function attachPendingManualBanner(userId, fileId) {
  const s = getPendingManualInput(userId);
  if (!s) return false;
  s.bannerFileId = fileId;
  s.expiresAt = Date.now() + MANUAL_INPUT_TIMEOUT_MS;
  pendingManualInput.set(String(userId), s);
  return true;
}
function consumePendingManualInput(userId) {
  const s = pendingManualInput.get(String(userId));
  if (!s) return null;
  pendingManualInput.delete(String(userId));
  if (s.expiresAt < Date.now()) return null;
  return s;
}
/** Kanal butonundan geldi; dil seçilince bu kanalın ayar paneli açılır (TON akışı). */
const pendingChannelAfterLang = new Map();
const pendingBroadcast = new Map();
const BROADCAST_TTL_MS = 10 * 60 * 1000;

function touchSubscriber(from, source) {
  if (!from?.id) return;
  try {
    botSubscribers.touch(from, { source });
  } catch (e) {
    console.warn('[subscribers] touch:', e.message);
  }
}

function setPendingBroadcast(userId) {
  pendingBroadcast.set(String(userId), { expiresAt: Date.now() + BROADCAST_TTL_MS });
}

function consumePendingBroadcast(userId) {
  const s = pendingBroadcast.get(String(userId));
  if (!s) return false;
  if (Date.now() > s.expiresAt) {
    pendingBroadcast.delete(String(userId));
    return false;
  }
  pendingBroadcast.delete(String(userId));
  return true;
}

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

const ADMIN_IDS = (ADMIN_USER_ID || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().replace(/^["']|["']$/g, ''))
  .filter(Boolean);

function isBotAdmin(userId) {
  if (!ADMIN_IDS.length) return true;
  return ADMIN_IDS.includes(String(userId));
}

function formatRailwayChannelEnv(chatId) {
  return `TELEGRAM_CHANNEL_IDS=${chatId}`;
}

/** Telegram start= payload'da eksi sorunlu olabilir → -100123… sadece rakam kısmı */
function channelIdToStartToken(chatId) {
  const id = String(chatId);
  if (id.startsWith('-100')) return id.slice(4);
  if (id.startsWith('-')) return id.slice(1);
  return id;
}

function startTokenToChannelId(token) {
  const s = String(token || '').trim();
  if (!s) return null;
  if (s.startsWith('-100')) return s;
  if (s.startsWith('-')) return s;
  if (/^\d+$/.test(s)) return `-100${s}`;
  return s;
}

/** Kanal DB'de yoksa Telegram'dan çekip kaydeder */
async function ensureChannelRegistered(chatId) {
  const raw = String(chatId).trim();
  const id = raw.startsWith('-100') || raw.startsWith('-')
    ? raw
    : (startTokenToChannelId(raw) || raw);
  let ch = channels.get(id);
  if (ch) return ch;
  try {
    const chat = await bot.getChat(id);
    channels.add(chat, 'ensure');
    return channels.get(id);
  } catch (e) {
    console.warn('[channels] ensure kayıt:', id, e.message);
    return null;
  }
}

async function notifyAdminsChannelBackup(chatId, title, { isNew = false } = {}) {
  if (!ADMIN_IDS.length || !isNew) return;
  const { isPersistentDataDir } = require('./data-path');
  if (isPersistentDataDir()) return;
  const name = title || String(chatId);
  const text = `✅ Yeni kanal: <b>${escapeHtmlLite(name)}</b> (<code>${chatId}</code>)\n\n`
    + 'Çok kanallı kullanım: Railway’de bir kez <b>Volume /data</b> ekleyin; '
    + 'kanal sahipleri Railway’e dokunmaz.\n'
    + `<i>Ops yedek:</i> <code>${formatRailwayChannelEnv(chatId)}</code>`;
  for (const adminId of ADMIN_IDS) {
    await bot.sendMessage(adminId, text, { parse_mode: 'HTML' }).catch(() => {});
  }
}

function formatEmptyChannelsHelp() {
  const { getOfficialFeedChannelIds } = require('./channelFeedPolicy');
  const official = getOfficialFeedChannelIds();
  const envIds = String(
    process.env.TELEGRAM_CHANNEL_IDS || process.env.TELEGRAM_CHANNEL_ID || '',
  ).trim();
  const webApp = String(process.env.WEB_APP_URL || '').trim();

  let block = '';
  if (envIds || official.length) {
    const want = official.length ? official.join(', ') : envIds;
    block =
      '<b>Variables’da kanal ID var ama kayıt yok</b> — bot o kanalda <b>admin değil</b> '
      + 'veya yanlış <code>BOT_TOKEN</code> kullanılıyor.\n\n'
      + `Beklenen ID: <code>${escapeHtmlLite(want)}</code>\n`
      + '1) Resmi kanala <b>bu botu</b> admin ekleyin (mesaj gönderme yetkisi)\n'
      + '2) Kanalda <code>/channelid</code> — ID aynı mı kontrol\n'
      + '3) Railway <code>BOT_TOKEN</code> = BotFather’daki bot\n'
      + '4) Redeploy → log: <code>env-sync: 1/1</code> veya <code>resmi kanal kayıt</code>\n\n';
  } else {
    block =
      'Henüz kanal kaydı yok. Kanala botu <b>admin</b> yapınca otomatik kayıt + hoş geldin gelir.\n\n';
  }

  return (
    '⚠️ <b>Sunucu notu</b> (sadece bot sahibi — kanalda görünmez)\n\n'
    + block
    + '<b>Railway (tek sefer):</b>\n'
    + '• Volume → mount <code>/app/data</code> → <code>DATA_DIR=/app/data</code>\n'
    + '• <code>TELEGRAM_CHANNEL_IDS</code> + <code>MINI_APP_FEED_CHANNEL_IDS</code> '
    + '(resmi ◎ Solana kanal, örn. <code>-1003992932638</code>)\n'
    + '• <code>WEB_APP_URL</code> = public domain (Mini App)\n\n'
    + (webApp ? `Mini App: <code>${escapeHtmlLite(webApp)}</code>\n` : '')
    + 'Kanalda hoş geldin yoksa: <code>/welcome</code>'
  );
}

async function registerChannelFromForward(msg) {
  const src = msg.forward_from_chat;
  if (!src?.id) return false;
  if (!['channel', 'supergroup', 'group'].includes(src.type)) return false;
  const chat = {
    id: src.id,
    title: src.title,
    username: src.username,
    type: src.type,
  };
  const { added } = channels.add(chat, 'forward');
  const line = formatRailwayChannelEnv(src.id);
  const lang = langForMsg(msg);
  const text = lang === 'tr'
    ? `✅ Kanal: <b>${escapeHtmlLite(src.title || src.id)}</b>\n\nRailway Variables:\n<code>${line}</code>`
    : `✅ Channel saved.\n<code>${line}</code>`;
  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  await notifyAdminsChannelBackup(src.id, src.title, { isNew: added });
  return true;
}

async function isChatAdmin(chatId, userId) {
  if (userId == null || userId === '') return false;
  const cidCandidates = [chatId, Number(chatId)].filter(
    (c) => c !== '' && c != null && !Number.isNaN(c),
  );
  for (const cid of cidCandidates) {
    try {
      const m = await bot.getChatMember(cid, userId);
      if (['creator', 'administrator'].includes(m.status)) return true;
    } catch (e) {
      console.warn('[admin] getChatMember', cid, userId, e.message);
    }
  }
  return false;
}

/** DM ayarları / pickchat — kanal yöneticisi veya Railway ADMIN_USER_ID */
async function canManageChannel(chatId, userId) {
  if (userId != null && userId !== '' && isBotAdmin(userId)) return true;
  return isChatAdmin(chatId, userId);
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
  if (uid && isBotAdmin(uid)) return true;
  if (chat.type === 'channel') {
    if (uid) return canManageChannel(chat.id, uid);
    return true;
  }
  if (uid) return canManageChannel(chat.id, uid);
  return false;
}

const { buildSniperDexWebAppButton, sniperDexMenuButton } = require('./dexAppButton');
const { isDexUserFacingBot } = require('./botMode');
const { applyTelegramBotProfile } = require('./botProfile');
const {
  sendDexWelcomeMessage,
  sendDexLangPickMessage,
  editDexWelcomeMessage,
  buildDexStartKeyboard,
  buildDexLangPickKeyboard,
} = require('./dexWelcome');
const {
  sendChannelWelcome,
  ensureOfficialChannelDefaults,
  bootstrapOfficialChannels,
} = require('./channelWelcome');

function welcomeStartKey(lang) {
  return isDexUserFacingBot() ? 'welcome.dexStart' : 'welcome.start';
}

function welcomeLangPickKey() {
  return isDexUserFacingBot() ? 'welcome.dexLangPick' : 'welcome.langPick';
}

function buildStartKeyboard(lang) {
  if (isDexUserFacingBot()) return buildDexStartKeyboard(lang);
  const rows = [];
  const dexBtn = buildSniperDexWebAppButton(lang);
  if (dexBtn) rows.push([dexBtn]);
  rows.push([
    { text: t('settings.titleDM', lang), callback_data: 'startcmd:settings' },
    { text: '🏓 Ping', callback_data: 'startcmd:ping' },
  ]);
  return { inline_keyboard: rows };
}

function buildLangPickKeyboard() {
  if (isDexUserFacingBot()) return buildDexLangPickKeyboard();
  const rows = [];
  const dexBtn = buildSniperDexWebAppButton('tr');
  if (dexBtn) rows.push([dexBtn]);
  rows.push([
    { text: '🇬🇧 English', callback_data: 'startlang:en' },
    { text: '🇹🇷 Türkçe', callback_data: 'startlang:tr' },
    { text: '🇷🇺 Русский', callback_data: 'startlang:ru' },
  ]);
  return { inline_keyboard: rows };
}

/** Hem DM/grup message hem kanal channel_post için komut bağla */
function bindTextCommand(regex, handler) {
  const run = async (msg, match) => {
    try {
      if (process.env.BOT_DEBUG === '1') {
        console.log('[cmd]', msg?.text, 'chat', msg?.chat?.id);
      }
      await handler(msg, match);
    } catch (e) {
      console.error('[cmd]', regex, msg?.text, e?.message, e?.stack);
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

function langForMsg(msgOrCb) {
  if (!msgOrCb) return DEFAULT_LANG;
  const msg = msgOrCb.message || msgOrCb;
  const from = msgOrCb.from || msg?.from;
  if (!msg?.chat) return DEFAULT_LANG;
  if (from?.id) return users.getLang(from.id);
  return DEFAULT_LANG;
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
  const chainId = token.chain || 'solana';
  storage.watch(token.poolId, {
    chain: chainId,
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
  const chainId = token.chain || channels.primaryChain(ch.id) || 'solana';
  const chLang = channels.resolveCardLang(ch);
  const isCritical = audit.isCritical === true;
  const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
  const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
  const bannerLevel = cardLevel === 'yellow' ? 'yellow' : (isCritical ? 'critical' : 'green');
  const message = formatTokenCardForChain(chainId, token, audit, chLang, cardLevel, { slim: true });
  const silent = ch.settings?.silentNotification === true;
  const banner = opts.customBannerFileId
    ? { photoFileId: opts.customBannerFileId }
    : bannerSourceForChain(chainId, bannerLevel);
  const { publishToDexAndChannel } = require('./publishPipeline');
  const pub = await publishToDexAndChannel({
    ch,
    token,
    audit,
    chLang,
    cardLevel,
    message,
    banner,
    silent,
    chain: chainId,
    sendCardToChannel,
    sendBotAnalysisFollowup,
  });
  if (!pub.ok) return { ok: false, error: pub.error, dexOk: pub.dexOk };

  if (pub.cmEntry) registerWatch(token, audit, [pub.cmEntry]);
  channels.recordSuccess(ch.id);
  return {
    ok: true,
    cmEntry: pub.cmEntry,
    dexAppUrl: pub.listing?.dexAppUrl,
    reportId: pub.listing?.reportId,
  };
}

async function processManualPost(chatId, userId, arg, lang, customBannerFileId = null) {
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

  let resolveChain = 'solana';
  const dmTargetId = getDmTarget(userId);
  if (dmTargetId) {
    const targetCh = channels.get(dmTargetId);
    const chList = targetCh?.settings?.chains;
    if (Array.isArray(chList) && chList.length === 1) {
      resolveChain = chList[0];
    } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(arg).trim())) {
      resolveChain = 'solana';
    } else if (/0x[a-fA-F0-9]{40}/.test(arg)) {
      resolveChain = 'bsc';
    } else if (Array.isArray(chList) && chList.length) {
      resolveChain = chList[0];
    }
  } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(arg).trim())) {
    resolveChain = 'solana';
  } else if (/0x[a-fA-F0-9]{40}/.test(arg)) {
    resolveChain = 'bsc';
  } else {
    resolveChain = 'ton';
  }

  const chainMod = chainsRegistry.getChain(resolveChain);
  let token;
  let audit;
  try {
    token = await chainMod.resolveTokenFromInput(arg);
    if (token) {
      token.chain = resolveChain;
      token.initialLiquidity = token.liquidityUsd || 0;
      await ensureShareEnrichment(token, resolveChain);
      applyTokenBadges(token);
      audit = chainMod.auditToken(token);
    }
  } catch (err) {
    if (err.code === 'WRONG_CHAIN') {
      return bot.sendMessage(
        chatId,
        t('post.wrongChain', lang, { chain: err.foreignChain || '?' }),
        { parse_mode: 'HTML' },
      );
    }
    console.error(`[post:${resolveChain}]`, err.message);
    return bot.sendMessage(chatId, t('post.notFound', lang), { parse_mode: 'HTML' });
  }
  if (!token || !audit) {
    return bot.sendMessage(chatId, t('post.notFound', lang), { parse_mode: 'HTML' });
  }

  setPendingPost(userId, { token, audit, customBannerFileId: customBannerFileId || null, chain: resolveChain });

  const isCritical = audit.isCritical === true;
  const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
  const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
  let preview = wrapEmojis(formatTokenCardForChain(resolveChain, token, audit, lang, cardLevel, { slim: true }), resolveChain);
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
  const uid = actorUserId(msg);
  const lang = langForMsg(msg);
  const lines = [lang === 'tr' ? '🏓 pong — bot çalışıyor' : '🏓 pong'];

  if (uid) {
    const botAdmin = isBotAdmin(uid);
    lines.push(`ID: <code>${uid}</code>`);
    lines.push(
      lang === 'tr'
        ? `bot-admin (ADMIN_USER_ID): ${botAdmin ? 'evet' : 'hayır'}`
        : `bot-admin: ${botAdmin ? 'yes' : 'no'}`,
    );
    if (!botAdmin && ADMIN_IDS.length) {
      lines.push(
        lang === 'tr'
          ? `<i>Railway ADMIN_USER_ID: ${escapeHtmlLite(ADMIN_IDS.join(', '))} — sizinki farklıysa ekle/güncelle.</i>`
          : `<i>Railway ADMIN_USER_ID: ${escapeHtmlLite(ADMIN_IDS.join(', '))}</i>`,
      );
    }
  }

  const chat = msg.chat;
  if (chat?.type !== 'private' && chat?.id) {
    const cid = String(chat.id);
    const reg = channels.get(cid);
    lines.push(
      lang === 'tr'
        ? `Bu sohbet kayıtlı: ${reg ? 'evet' : 'hayır'} · chat_id: <code>${cid}</code>`
        : `Registered: ${reg ? 'yes' : 'no'} · chat_id: <code>${cid}</code>`,
    );
    if (uid) {
      const ca = await isChatAdmin(chat.id, uid);
      lines.push(lang === 'tr' ? `kanal-admin: ${ca ? 'evet' : 'hayır'}` : `channel-admin: ${ca ? 'yes' : 'no'}`);
    }
    if (!reg) {
      lines.push(
        lang === 'tr'
          ? '<i>Botu kanala admin yapın, sonra /channelid veya /welcome</i>'
          : '<i>Add bot as admin, then /channelid or /welcome</i>',
      );
    }
  } else if (chat?.type === 'private' && uid) {
    const sub = botSubscribers.countStats();
    lines.push(
      lang === 'tr'
        ? `Bot aboneleri: ${sub.active} aktif / ${sub.total} kayıt`
        : `Bot subscribers: ${sub.active} active / ${sub.total} total`,
    );
    const listed = channels.list();
    lines.push(lang === 'tr' ? `Kayıtlı kanal: ${listed.length}` : `Channels registered: ${listed.length}`);
    for (const ch of listed.slice(0, 8)) {
      const ok = await canManageChannel(ch.id, uid);
      lines.push(`${ok ? '✅' : '⛔'} ${escapeHtmlLite(ch.title || ch.id)} <code>${ch.id}</code>`);
    }
    if (!listed.length) {
      const envIds = String(
        process.env.TELEGRAM_CHANNEL_IDS || process.env.TELEGRAM_CHANNEL_ID || '',
      ).trim();
      if (envIds) {
        lines.push(`TELEGRAM_CHANNEL_IDS: <code>${escapeHtmlLite(envIds)}</code>`);
      }
      lines.push(
        lang === 'tr'
          ? '<i>Bot kanalda admin değil veya yanlış BOT_TOKEN. Kanala admin ekle → /channelid</i>'
          : '<i>Bot not admin in channel or wrong BOT_TOKEN.</i>',
      );
    }
  }

  await bot.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'HTML' });
});

async function openDmChannelSettings(dmChatId, userId, channelId) {
  const targetId = startTokenToChannelId(channelId) || String(channelId);
  const ch = await ensureChannelRegistered(targetId);
  const lang = users.getLang(userId) || ch?.settings?.lang || DEFAULT_LANG;
  if (!ch) {
    return bot.sendMessage(
      dmChatId,
      `${t('cmd.channelNotFound', lang)}\n\n`
      + (lang === 'tr'
        ? 'Kanalda /channelid yazın veya kanaldan bir postu bota iletin.'
        : 'Use /channelid in the channel or forward a post to the bot.'),
    );
  }
  if (!(await canManageChannel(targetId, userId))) {
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

  if (isDexUserFacingBot() && msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, t('dex.appOnlyHint', lang), {
      parse_mode: 'Markdown',
      reply_markup: buildDexStartKeyboard(lang),
    });
  }

  if (msg.chat.type !== 'private') {
    return bot.sendMessage(msg.chat.id, t('settings.dmOnly', lang), { parse_mode: 'Markdown' });
  }

  if (!uid) {
    return bot.sendMessage(msg.chat.id, t('cmd.adminOnly', lang));
  }

  const adminChannels = [];
  for (const ch of channels.list()) {
    if (await canManageChannel(ch.id, uid)) adminChannels.push(ch);
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

/** Kanalda hoş geldin mesajını yeniden gönder (yönetici). */
bindTextCommand(/^\/welcome(@\w+)?$/i, async (msg) => {
  if (!isBroadcastChat(msg.chat)) {
    return bot.sendMessage(msg.chat.id, t('welcome.channelCmd', langForMsg(msg)), { parse_mode: 'Markdown' });
  }
  if (!(await canManageChat(msg))) {
    return bot.sendMessage(msg.chat.id, t('cmd.notChannelAdmin', langForMsg(msg)));
  }
  const uid = actorUserId(msg);
  channels.add(msg.chat, 'welcome-cmd', uid || 'channel-cmd');
  ensureOfficialChannelDefaults(msg.chat.id);
  const oldId = channels.get(msg.chat.id)?.settings?.welcomeMessageId;
  if (oldId) {
    await bot.deleteMessage(msg.chat.id, oldId).catch(() => {});
    channels.updateSetting(msg.chat.id, 'welcomeMessageId', null);
  }
  const ok = await sendChannelWelcome(bot, msg.chat, { userId: uid, force: true });
  if (!ok) {
    return bot.sendMessage(msg.chat.id, '❌ Hoş geldin gönderilemedi (bot kanalda admin mi?).');
  }
});

bindTextCommand(/^\/dex(@\w+)?$/i, async (msg) => {
  if (msg.chat.type === 'private' && msg.from) touchSubscriber(msg.from, 'dex');
  const lang = langForMsg(msg);
  const dexBtn = buildSniperDexWebAppButton(lang);
  if (!dexBtn) {
    return bot.sendMessage(
      msg.chat.id,
      lang === 'tr'
        ? '❌ Sniper DEX henüz yapılandırılmadı. Railway → WEB_APP_URL (HTTPS) ayarlayın.'
        : '❌ Sniper DEX is not configured. Set WEB_APP_URL (HTTPS) on Railway.',
    );
  }
  if (isDexUserFacingBot()) {
    dexBtn.text = t('welcome.dexBtnLaunch', lang);
    return sendDexWelcomeMessage(bot, msg.chat.id, lang);
  }
  return bot.sendMessage(msg.chat.id, t('dex.openHint', lang), {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[dexBtn]] },
  });
});

bindTextCommand(/^\/channelid(@\w+)?$/i, async (msg) => {
  const lang = langForMsg(msg);
  if (msg.chat.type === 'private') {
    const ids = channels.getChannelIdsForEnv();
    const body = ids
      ? (lang === 'tr'
        ? `Kayıtlı kanal ID'leri:\n<code>${ids}</code>\n\nRailway → TELEGRAM_CHANNEL_IDS`
        : `Channel IDs:\n<code>${ids}</code>`)
      : (lang === 'tr' ? 'Henüz kayıtlı kanal yok.' : 'No channels registered.');
    return bot.sendMessage(msg.chat.id, body, { parse_mode: 'HTML' });
  }
  const id = msg.chat.id;
  channels.add(msg.chat, 'cmd');
  const line = formatRailwayChannelEnv(id);
  const text = lang === 'tr'
    ? `📌 Bu kanalın ID'si:\n<code>${id}</code>\n\nDeploy sonrası unutmasın diye Railway Variables'a ekleyin:\n<code>${line}</code>`
    : `📌 Channel ID:\n<code>${id}</code>\n\nAdd to Railway:\n<code>${line}</code>`;
  await notifyAdminsChannelBackup(id, msg.chat.title, { isNew: false });
  return bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

bindTextCommand(/^\/start(@\w+)?(\s+(.+))?$/, async (msg, match) => {
  if (msg.chat.type !== 'private') {
    channels.add(msg.chat, msg.from?.username || 'cmd');
  } else if (msg.from) {
    touchSubscriber(msg.from, 'start');
  }

  const param = (match && match[3] || '').trim();
  if (param.startsWith('settings_') && msg.chat.type === 'private') {
    const targetId = startTokenToChannelId(param.slice('settings_'.length).trim());
    if (targetId) {
      if (!users.hasChosenLang(msg.from.id)) {
        pendingChannelAfterLang.set(String(msg.from.id), targetId);
        if (isDexUserFacingBot()) {
          return sendDexLangPickMessage(bot, msg.chat.id, 'en');
        }
        return bot.sendMessage(msg.chat.id, t(welcomeLangPickKey(), 'en'), {
          parse_mode: 'Markdown',
          reply_markup: buildLangPickKeyboard(),
        });
      }
      return openDmChannelSettings(msg.chat.id, msg.from.id, targetId);
    }
  }

  if (msg.chat.type === 'private' && !users.hasChosenLang(msg.from.id)) {
    if (isDexUserFacingBot()) {
      return sendDexLangPickMessage(bot, msg.chat.id, 'en');
    }
    return bot.sendMessage(msg.chat.id, t(welcomeLangPickKey(), 'en'), {
      parse_mode: 'Markdown',
      reply_markup: buildLangPickKeyboard(),
    });
  }

  const lang = langForMsg(msg);
  if (isDexUserFacingBot() && msg.chat.type === 'private') {
    return sendDexWelcomeMessage(bot, msg.chat.id, lang);
  }
  await bot.sendMessage(msg.chat.id, t(welcomeStartKey(lang), lang), {
    parse_mode: 'Markdown',
    reply_markup: buildStartKeyboard(lang),
  });
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
  const parts = [];
  if (TON_SCAN_ENABLED) {
    const r = await runScan('manual', 'ton');
    parts.push(`TON: ${r.tokensShared || 0} paylaşım`);
  }
  if (BSC_SCAN_ENABLED) {
    const r = await runScan('manual', 'bsc');
    parts.push(`BSC: ${r.tokensShared || 0} paylaşım`);
  }
  if (SOLANA_SCAN_ENABLED) {
    const r = await runScan('manual', 'solana');
    parts.push(`Solana: ${r.tokensShared || 0} paylaşım`);
  }
  if (!parts.length) parts.push('Tüm taramalar kapalı (TON_SCAN_ENABLED / BSC_SCAN_ENABLED / SOLANA_SCAN_ENABLED)');
  await bot.sendMessage(msg.chat.id, `✅ ${parts.join(' · ')}`, { parse_mode: 'HTML' });
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

bot.on('message', async (msg) => {
  if (msg.chat.type === 'private' && msg.forward_from_chat?.id) {
    try {
      await registerChannelFromForward(msg);
    } catch (e) {
      console.warn('[forward]', e.message);
    }
    return;
  }
  if (msg.chat.type !== 'private' || !msg.from?.id || !msg.text) return;
  if (msg.text.startsWith('/')) return;
  touchSubscriber(msg.from, 'dm');
  if (isBotAdmin(msg.from.id) && consumePendingBroadcast(msg.from.id)) {
    const lang = langForMsg(msg);
    const st = botSubscribers.countStats();
    if (!st.active) {
      return bot.sendMessage(
        msg.chat.id,
        lang === 'tr' ? 'Henüz kayıtlı abone yok.' : 'No subscribers yet.',
      );
    }
    await bot.sendMessage(
      msg.chat.id,
      lang === 'tr' ? `⏳ ${st.active} kişiye gönderiliyor…` : `⏳ Sending to ${st.active}…`,
    );
    const result = await botSubscribers.broadcastToAll(bot, msg.text.trim(), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    const summary = lang === 'tr'
      ? `✅ Duyuru bitti\n• Gönderildi: ${result.sent}\n• Engelli: ${result.blocked}\n• Hata: ${result.failed}`
      : `✅ Sent: ${result.sent} · blocked: ${result.blocked} · failed: ${result.failed}`;
    return bot.sendMessage(msg.chat.id, summary);
  }
  const state = consumePendingManualInput(msg.from.id);
  if (!state) return;
  const lang = langForMsg(msg);
  return processManualPost(msg.chat.id, msg.from.id, msg.text.trim(), lang, state.bannerFileId || null);
});

bindTextCommand(/^\/(subscribers|aboneler)(@\w+)?$/i, async (msg) => {
  const uid = actorUserId(msg);
  const lang = langForMsg(msg);
  if (!uid || !isBotAdmin(uid)) {
    return bot.sendMessage(msg.chat.id, lang === 'tr' ? '⛔ Sadece bot admin.' : '⛔ Admin only.');
  }
  const st = botSubscribers.countStats();
  const body = lang === 'tr'
    ? `👥 <b>Bot aboneleri</b> (Start / DEX — kanal şart değil)\n\n`
      + `• Aktif: <b>${st.active}</b>\n`
      + `• Engellemiş / pasif: <b>${st.blocked}</b>\n`
      + `• Toplam kayıt: <b>${st.total}</b>\n\n`
      + `<i>Duyuru: /broadcast metin</i>`
    : `👥 <b>Bot subscribers</b>\n\n`
      + `• Active: <b>${st.active}</b>\n`
      + `• Blocked: <b>${st.blocked}</b>\n`
      + `• Total: <b>${st.total}</b>\n\n`
      + `<i>Broadcast: /broadcast text</i>`;
  return bot.sendMessage(msg.chat.id, body, { parse_mode: 'HTML' });
});

bindTextCommand(/^\/broadcast(@\w+)?(?:\s+([\s\S]+))?$/i, async (msg, match) => {
  const uid = actorUserId(msg);
  const lang = langForMsg(msg);
  if (!uid || !isBotAdmin(uid)) {
    return bot.sendMessage(msg.chat.id, lang === 'tr' ? '⛔ Sadece bot admin.' : '⛔ Admin only.');
  }
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(
      msg.chat.id,
      lang === 'tr' ? 'Duyuruyu bota özelden gönderin.' : 'Send broadcast from private chat with the bot.',
    );
  }
  const text = (match[2] || '').trim();
  if (!text) {
    setPendingBroadcast(uid);
    const hint = lang === 'tr'
      ? '📢 <b>Duyuru modu</b>\n\nŞimdi göndermek istediğiniz metni yazın (HTML desteklenir).\nİptal: /start'
      : '📢 <b>Broadcast mode</b>\n\nSend the message text now (HTML supported).\nCancel: /start';
    return bot.sendMessage(msg.chat.id, hint, { parse_mode: 'HTML' });
  }
  const st = botSubscribers.countStats();
  if (!st.active) {
    return bot.sendMessage(
      msg.chat.id,
      lang === 'tr' ? 'Henüz kayıtlı abone yok (/start veya DEX).' : 'No subscribers yet.',
    );
  }
  await bot.sendMessage(
    msg.chat.id,
    lang === 'tr'
      ? `⏳ ${st.active} kişiye gönderiliyor…`
      : `⏳ Sending to ${st.active} users…`,
  );
  const result = await botSubscribers.broadcastToAll(bot, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  const summary = lang === 'tr'
    ? `✅ Duyuru bitti\n• Gönderildi: ${result.sent}\n• Engelli: ${result.blocked}\n• Hata: ${result.failed}\n• Hedef: ${result.total}`
    : `✅ Done\n• Sent: ${result.sent}\n• Blocked: ${result.blocked}\n• Failed: ${result.failed}\n• Target: ${result.total}`;
  return bot.sendMessage(msg.chat.id, summary);
});

bindTextCommand(/^\/stats(@\w+)?$/i, (msg) => {
  const lang = langForMsg(msg);
  const ch = channels.count();
  const bundle = storage.getStatsBundle();
  const body = statsReport.formatSubscriberStats(bundle, lang);
  const tail = `\n\n📢 Kanal: ${ch.total} (${ch.enabled} aktif) · ⏱ ${formatUptime(process.uptime())}`;
  bot.sendMessage(msg.chat.id, body + tail, { parse_mode: 'HTML', disable_web_page_preview: true });
});

function isBroadcastChat(chat) {
  return chat && ['channel', 'supergroup', 'group'].includes(chat.type);
}

/** Atılma, kanal silinmesi veya admin düşürülmesi — leaveChat + kayıt sil. */
async function handleChannelDeparted(chat, reason) {
  if (!chat?.id || !isBroadcastChat(chat)) return;
  try {
    await bot.leaveChat(chat.id);
    console.log(`[channels] leaveChat: ${chat.title || chat.id} (${reason})`);
  } catch (e) {
    const msg = String(e?.message || '');
    if (!/not a member|already|kicked|not found|forbidden|deactivated/i.test(msg)) {
      console.warn(`[channels] leaveChat ${chat.id}:`, msg);
    }
  }
  channels.purge(chat.id, reason);
}

bot.on('my_chat_member', async (upd) => {
  try {
  const chat = upd.chat;
  const newStatus = upd.new_chat_member?.status;
  const oldStatus = upd.old_chat_member?.status;

  if (chat.type === 'private' && upd.from?.id) {
    if (['kicked', 'left'].includes(newStatus)) {
      botSubscribers.markInactive(upd.from.id, newStatus);
    } else if (newStatus === 'member') {
      touchSubscriber(upd.from, 'rejoin');
    }
    return;
  }

  // Gerçek kanala giriş veya üye → admin yükseltme.
  const joinedChannel = ['administrator', 'member'].includes(newStatus)
    && ['left', 'kicked'].includes(oldStatus);
  const promotedToAdmin = newStatus === 'administrator'
    && ['member', 'restricted'].includes(oldStatus);

  if (joinedChannel || promotedToAdmin) {
    const { added, channel: chRec } = channels.add(chat, upd.from?.username || 'auto', upd.from?.id);
    console.log(`➕ ${chat.title || chat.id} (${chat.type}) — Toplam: ${channels.count().total}${added ? '' : ' (zaten kayıtlı)'}`);
    ensureOfficialChannelDefaults(chat.id);
    if (added) await notifyAdminsChannelBackup(chat.id, chat.title, { isNew: true });

    if (newStatus === 'administrator' && chat.type !== 'private') {
      await sendChannelWelcome(bot, chat, {
        userId: upd.from?.id,
        addedBy: 'my_chat_member',
      });
    }
    return;
  }

  // Restart sonrası Telegram güncellemesi: kanalı kaydet ama hoş geldin / chains sıfırlama yok
  if (['administrator', 'member'].includes(newStatus) && (oldStatus == null || oldStatus === '')) {
    const existed = Boolean(channels.get(chat.id));
    const { added } = channels.add(chat, 'boot-sync');
    ensureOfficialChannelDefaults(chat.id);
    if (!existed || added) {
      console.log(`[channels] deploy sync: ${chat.title || chat.id} (◎ Solana otomatik)`);
    }
    if (added) await notifyAdminsChannelBackup(chat.id, chat.title, { isNew: true });
    if (newStatus === 'administrator' && chat.type !== 'private') {
      await sendChannelWelcome(bot, chat, { addedBy: 'boot-sync' });
    }
    return;
  }

  // Admin yetkisi kaldırıldı — kanalda kalmayıp kaydı sil
  const demotedFromAdmin = oldStatus === 'administrator'
    && ['member', 'restricted'].includes(newStatus);
  if (demotedFromAdmin && isBroadcastChat(chat)) {
    if (Date.now() - BOT_BOOT_TIME < CHANNEL_LEFT_GRACE_MS) {
      console.log(`[channels] admin düşürme atlandı (deploy grace): ${chat.id}`);
      return;
    }
    console.log(`[channels] admin yetkisi kaldırıldı: ${chat.title || chat.id}`);
    await handleChannelDeparted(chat, 'admin_removed');
    return;
  }

  if (['left', 'kicked'].includes(newStatus)) {
    if (Date.now() - BOT_BOOT_TIME < CHANNEL_LEFT_GRACE_MS) {
      console.log(`[channels] left atlandı (deploy grace ${CHANNEL_LEFT_GRACE_MS / 1000}s): ${chat.id}`);
      return;
    }
    const wasInChannel = ['administrator', 'member', 'restricted', 'creator'].includes(oldStatus);
    if (!wasInChannel) {
      console.log(`[channels] left atlandı (zaten kanalda değildi: ${oldStatus}): ${chat.id}`);
      return;
    }
    await handleChannelDeparted(chat, newStatus);
  }
  } catch (e) {
    console.error('[my_chat_member]', e?.message, e?.stack);
  }
});

bot.on('photo', async (msg) => {
  if (!msg.from || !msg.photo?.length) return;
  const userId = msg.from.id;
  if (msg.chat.type === 'private' && getPendingManualInput(userId)) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    attachPendingManualBanner(userId, fileId);
    const lang = langForMsg(msg);
    const okMsg = lang === 'tr'
      ? '🖼 Banner kaydedildi. Şimdi Solana mint veya DexScreener linki gönderin.'
      : lang === 'ru'
        ? '🖼 Баннер сохранён. Отправьте mint Solana или ссылку DexScreener.'
        : '🖼 Banner saved. Now send a Solana mint or DexScreener link.';
    await bot.sendMessage(msg.chat.id, okMsg).catch(() => {});
    return;
  }
  const targetChatId = msg.chat.type === 'private' ? getDmTarget(userId) : msg.chat.id;
  if (!targetChatId || !consumePendingBanner(targetChatId, userId)) return;
  if (!(await isChatAdmin(targetChatId, userId))) return;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  channels.updateSetting(targetChatId, 'bannerFileId', fileId);
  await bot.sendMessage(msg.chat.id, t('cmd.bannerSaved', langForMsg(msg))).catch(() => {});
});

bot.on('callback_query', async (cb) => {
  try {
  if (!cb?.from?.id || !cb.message?.chat?.id) {
    return bot.answerCallbackQuery(cb?.id).catch(() => {});
  }
  const userId = cb.from.id;
  const fromChatId = cb.message.chat.id;
  const isDM = cb.message.chat.type === 'private';
  const cbLang = users.getLang(userId);

  if (cb.data === 'startcmd:settings') {
    await bot.answerCallbackQuery(cb.id).catch(() => {});
    return handleSettings({ chat: cb.message.chat, from: cb.from, text: '/settings' });
  }
  if (cb.data === 'startcmd:ping') {
    await bot.answerCallbackQuery(cb.id).catch(() => {});
    return bot.sendMessage(fromChatId, '🏓 pong');
  }
  if (cb.data === 'startcmd:lang' && isDexUserFacingBot()) {
    await bot.answerCallbackQuery(cb.id).catch(() => {});
    return sendDexLangPickMessage(bot, fromChatId, cbLang);
  }

  if (isDM && cb.from) touchSubscriber(cb.from, 'callback');

  if (cb.data?.startsWith('startlang:')) {
    const code = channels.applyGlobalLang(userId, cb.data.slice('startlang:'.length));
    const pendingCh = pendingChannelAfterLang.get(String(userId));
    if (pendingCh) {
      pendingChannelAfterLang.delete(String(userId));
      await bot.editMessageText(t('welcome.langSet', code), {
        chat_id: fromChatId,
        message_id: cb.message.message_id,
      }).catch(() => {});
      await bot.answerCallbackQuery(cb.id, { text: t('welcome.langSet', code) });
      return openDmChannelSettings(fromChatId, userId, pendingCh);
    }
    if (isDexUserFacingBot()) {
      const edited = await editDexWelcomeMessage(bot, fromChatId, cb.message.message_id, code);
      if (!edited) {
        await sendDexWelcomeMessage(bot, fromChatId, code);
      }
      return bot.answerCallbackQuery(cb.id, { text: t('welcome.langSet', code) });
    }
    const newText = `${t('welcome.langSet', code)}\n\n${t(welcomeStartKey(code), code)}`;
    const markup = buildStartKeyboard(code);
    const edited = await bot.editMessageText(newText, {
      chat_id: fromChatId,
      message_id: cb.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: markup,
    }).catch(() => null);
    if (!edited) {
      await bot.sendMessage(fromChatId, newText, {
        parse_mode: 'Markdown',
        reply_markup: markup,
      });
    }
    return bot.answerCallbackQuery(cb.id, { text: t('welcome.langSet', code) });
  }

  if (cb.data?.startsWith('pickchat:')) {
    const targetId = cb.data.slice('pickchat:'.length).trim();
    const ch = channels.get(targetId);
    if (!ch) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.channelNotFound', cbLang), show_alert: true });
    }
    if (!(await canManageChannel(targetId, userId))) {
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
    if (!ch || !(await canManageChannel(ch.id, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: 'Yetki yok' });
    }
    /* Manuel /post — kanal filtresi yok (otomatik tarama filtreli kalır) */
    const r = await shareTokenToChannel(ch, pending.token, pending.audit, {
      customBannerFileId: pending.customBannerFileId || null,
    });
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
    if (isDM && !getDmTarget(userId)) {
      return bot.answerCallbackQuery(cb.id, {
        text: t('cmd.noChannelPicked', cbLang),
        show_alert: true,
      });
    }
    const manualChId = isDM ? getDmTarget(userId) : fromChatId;
    if (manualChId && !channels.hasChainSelected(manualChId)) {
      return bot.answerCallbackQuery(cb.id, {
        text: t('settings.chain.pickFirstAlert', cbLang),
        show_alert: true,
      });
    }
    if (isDM) {
      const tgt = getDmTarget(userId);
      if (!(await canManageChannel(tgt, userId))) {
        return bot.answerCallbackQuery(cb.id, { text: t('cmd.notChannelAdmin', cbLang), show_alert: true });
      }
    }
    setPendingManualInput(userId);
    const prompt = cbLang === 'tr'
      ? '📤 <b>Manuel Paylaş</b>\n\n<b>1)</b> İstersen önce özel banner fotoğrafı gönder (opsiyonel).\n<b>2)</b> Sonra gönder:\n• Solana mint\n• DexScreener <b>solana</b> linki\n• <code>pump.fun/coin/MINT</code>\n• Solscan token linki\n\n<i>5 dakika içinde.</i>'
      : cbLang === 'ru'
        ? '📤 <b>Ручной пост</b>\n\n<b>1)</b> По желанию сначала фото-баннер.\n<b>2)</b> Затем mint Solana или ссылка DexScreener.\n\n<i>5 минут.</i>'
        : '📤 <b>Manual post</b>\n\n<b>1)</b> Optional custom banner photo first.\n<b>2)</b> Then send a Solana mint or DexScreener link.\n\n<i>Within 5 minutes.</i>';
    await bot.sendMessage(fromChatId, prompt, { parse_mode: 'HTML' }).catch(() => {});
    return bot.answerCallbackQuery(cb.id);
  }

  if (cb.data === 'close') {
    await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
    return bot.answerCallbackQuery(cb.id, { text: t('cmd.closed', cbLang) });
  }

  if (cb.data?.startsWith('menu:') || cb.data?.startsWith('set:') || cb.data?.startsWith('dex:')
    || cb.data?.startsWith('tgl:') || cb.data?.startsWith('tgf:') || cb.data?.startsWith('profile:')
    || cb.data?.startsWith('rst:') || cb.data?.startsWith('banner:') || cb.data === 'reset') {
    const targetChatId = isDM ? getDmTarget(userId) : fromChatId;
    if (!targetChatId || !channels.get(targetChatId)) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.noChannelPicked', cbLang), show_alert: true });
    }
    if (!(await canManageChannel(targetChatId, userId))) {
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.notChannelAdmin', cbLang), show_alert: true });
    }
    if (cb.data?.startsWith('set:lang:')) {
      channels.applyGlobalLang(userId, cb.data.slice('set:lang:'.length));
    }
    const targetLang = users.getLang(userId);
    const result = settingsUI.handleCallback(cb.data, targetChatId);
    if (result?.chainBlocked) {
      if (result.menu) {
        const { text, keyboard } = settingsUI.renderMenu(result.menu, targetChatId);
        const markup = inlineKeyboard(keyboard);
        const editOpts = {
          chat_id: fromChatId,
          message_id: cb.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: markup,
        };
        const isPhoto = !!cb.message?.photo;
        if (isPhoto) await bot.editMessageCaption(text, editOpts).catch(() => {});
        else await bot.editMessageText(text, editOpts).catch(() => {});
      }
      return bot.answerCallbackQuery(cb.id, {
        text: result.toast || t('settings.chain.pickFirstAlert', cbLang),
        show_alert: true,
      });
    }
    if (result?.close) {
      await bot.deleteMessage(fromChatId, cb.message.message_id).catch(() => {});
      return bot.answerCallbackQuery(cb.id, { text: t('cmd.closed', cbLang) });
    }
    if (result?.awaitBannerUpload) {
      setPendingBanner(targetChatId, userId);
    }
    if (result?.previewBanner) {
      const s = channels.getSettings(targetChatId);
      if (s?.bannerFileId) {
        await bot.sendPhoto(fromChatId, s.bannerFileId, {
          caption: t('cmd.bannerPreview', targetLang),
        }).catch((err) => {
          bot.sendMessage(fromChatId, t('cmd.bannerSendFailed', targetLang, { err: err.message })).catch(() => {});
        });
      } else {
        await bot.sendMessage(fromChatId, t('settings.banner.none', targetLang) || '—').catch(() => {});
      }
    }
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
  } catch (e) {
    console.error('[callback_query]', cb?.data, e?.message, e?.stack);
    bot.answerCallbackQuery(cb?.id, { text: '⚠️' }).catch(() => {});
  }
});

bot.on('polling_error', handlePollingError);
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.message || e));

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n👋 ${signal} — bot kapatılıyor (Railway yeni deploy / restart ise normaldir)`);
  try {
    await bot.stopPolling();
  } catch (_) { /* yoksay */ }
  try {
    await userbot.disconnect();
  } catch (_) { /* yoksay */ }
  process.exit(0);
}
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });

async function main() {
  const { initPersistence } = require('./persistence');
  await initPersistence();
  startMiniAppServer();

  const me = await bot.getMe().catch(() => ({ username: 'bot', id: '?' }));
  process.env.BOT_USERNAME = me.username ? `@${me.username}` : '';
  const dexFace = isDexUserFacingBot();
  console.log(`✅ Telegram bot: @${me.username} (id=${me.id}) — ${dexFace ? 'DEX kullanıcı' : 'Kanal tarama'}`);

  await startBotPolling();
  console.log(
    `   ADMIN_USER_ID: ${ADMIN_IDS.length ? ADMIN_IDS.join(', ') : '(yok — herkes bot admin sayılır)'}`,
  );
  console.log('   Bu token yalnızca TEK yerde çalışmalı (Railway XOR yerel PC).');
  console.log(`   TON tarama: ${TON_SCAN_ENABLED ? `AÇIK (${scanIntervalMin('ton')} dk)` : 'KAPALI'}`);
  console.log(`   BSC tarama: ${BSC_SCAN_ENABLED ? `AÇIK (${scanIntervalMin('bsc')} dk)` : 'KAPALI'}`);
  console.log(`   Solana tarama: ${SOLANA_SCAN_ENABLED ? `AÇIK (${scanIntervalMin('solana')} dk)` : 'KAPALI'}`);
  console.log(`   İzleme: ${WATCH_INTERVAL_SEC} sn`);
  try {
    const botFeedStore = require('./botFeedStore');
    const { DATA_DIR } = require('./data-path');
    const { getWebAppBaseUrl, getBotApiBaseUrl, warnMiniAppFeedWebAppAlign } = require('./miniAppServer');
    console.log(`   Bot↔DEX: WEB_APP_URL=${getWebAppBaseUrl()}`);
    if (getBotApiBaseUrl()) console.log(`   DEX→Bot API: BOT_API_URL=${getBotApiBaseUrl()}`);
    const localFeedN = await botFeedStore.feedCountAsync();
    console.log(`   Mini App feed: ${localFeedN} kayıt (DATA_DIR=${DATA_DIR})`);
    if (localFeedN === 0) {
      console.warn(
        '   Settings → Sniper DEX boş liste: resmi kanala paylaşım veya bot servisinde DATABASE_URL (eski DEX Postgres).',
      );
    }
    warnMiniAppFeedWebAppAlign().catch(() => {});
    const { getOfficialFeedChannelIds } = require('./channelFeedPolicy');
    const feedCh = getOfficialFeedChannelIds();
    if (feedCh.length) {
      console.log(`   Mini App feed kanalları (resmi): ${feedCh.join(', ')}`);
    }
  } catch (_) { /* */ }

  const webEntry = getWebAppEntryUrl();
  if (/^https:\/\//i.test(webEntry)) {
    await bot.setChatMenuButton({
      menu_button: sniperDexMenuButton(),
    }).catch((e) => console.warn('setChatMenuButton:', e?.message));
    console.log(`   Mini App menü URL: ${webEntry}`);
  }

  await applyTelegramBotProfile(bot);

  try {
    const sub = botSubscribers.countStats();
    console.log(`   Bot aboneleri: ${sub.active} aktif / ${sub.total} kayıt (Start & DEX)`);
  } catch (_) { /* */ }

  const dataPath = require('./data-path');
  const pg = require('./pgClient');
  console.log(
    `[data] DATA_DIR=${dataPath.DATA_DIR} · kalıcı=${dataPath.isPersistentDataDir() ? 'EVET' : 'HAYIR'} · depo=${pg.enabled() ? 'PostgreSQL' : 'dosya'}`,
  );
  try {
    const reportStore = require('./reportStore');
    const n = await reportStore.reportCountAsync();
    console.log(`[report] store: ${n} rapor · TTL 14 gun`);
  } catch (_) { /* yoksay */ }

  await userbot.getClient();

  const ubOn = userbot.isEnabled();
  const ubStrict = isChannelUserbotStrict();
  if (ubOn) {
    console.log('   Userbot: AÇIK (premium emoji kanal postları)');
  } else if (ubStrict && !hasUserbotCredentials()) {
    console.warn('   ⚠️ CHANNEL_USERBOT_REQUIRED=1 ama TG_API_ID/HASH/SESSION yok → kanala post GİTMEZ');
  } else if (ubStrict && hasUserbotCredentials()) {
    console.warn('   ⚠️ TG_SESSION var ama userbot bağlanamadı → kanala post GİTMEZ (CHANNEL_USERBOT_REQUIRED=0 yapın veya session yenileyin)');
  } else if (!ubOn && hasUserbotCredentials()) {
    console.warn('   ⚠️ Userbot kapalı (TG_SESSION hatalı/çift) → Bot API ile post (CHANNEL_USERBOT_REQUIRED=0 olmalı)');
  } else {
    console.log('   Userbot: kapalı → Bot API');
  }
  const rediscover = await channels.rediscoverAllChannels(bot, channels);
  if (rediscover.added > 0) {
    console.log(`[channels] açılış keşfi: +${rediscover.added} kanal (${rediscover.before} → ${rediscover.after})`);
  }
  const bootOfficial = await bootstrapOfficialChannels(bot);
  if (bootOfficial.welcomed > 0) {
    console.log(`[channels] resmi kanal hoş geldin: ${bootOfficial.welcomed}`);
  }
  const { getOfficialFeedChannelIds } = require('./channelFeedPolicy');
  if (getOfficialFeedChannelIds().length && channels.count().total === 0) {
    console.warn(
      '[channels] Resmi kanal ID env’de var ama kayıt 0 — bot kanalda admin mi? BOT_TOKEN bu kanaldaki bot mu?',
    );
  }
  channels.logBootSummary();
  const chTotal = channels.count().total;
  if (chTotal === 0 && ADMIN_IDS.length) {
    const help = formatEmptyChannelsHelp();
    for (const adminId of ADMIN_IDS) {
      bot.sendMessage(adminId, help, { parse_mode: 'HTML' }).catch(() => {});
    }
  } else if (chTotal > 0 && !require('./data-path').isPersistentDataDir()) {
    const ids = channels.getChannelIdsForEnv();
    const hasEnvBackup = String(
      process.env.TELEGRAM_CHANNEL_IDS || process.env.TELEGRAM_CHANNEL_ID || '',
    ).trim();
    if (ids && !hasEnvBackup && ADMIN_IDS.length) {
      for (const adminId of ADMIN_IDS) {
        bot.sendMessage(
          adminId,
          `📋 Kanal deploy'da silinmesin diye Railway'e ekleyin:\n<code>TELEGRAM_CHANNEL_IDS=${ids}</code>\n\nKalıcı çözüm: Volume mount <code>/data</code>`,
          { parse_mode: 'HTML' },
        ).catch(() => {});
      }
    }
  }
  const enabledCh = channels.listEnabled().filter((c) => channels.hasChainSelected(c.id));
  const tonN = enabledCh.filter((c) => (c.settings?.chains || [])[0] === 'ton').length;
  const bscN = enabledCh.filter((c) => (c.settings?.chains || [])[0] === 'bsc').length;
  const solN = enabledCh.filter((c) => (c.settings?.chains || [])[0] === 'solana').length;
  console.log(`   Özet: ${enabledCh.length} kanal (🔷 TON=${tonN} · 🟡 BSC=${bscN} · ◎ Solana=${solN})`);

  await require('./envBootstrap').verifyHeliusRpc().catch(() => {});

  if (TON_SCAN_ENABLED) {
    try {
      const { getInstance } = require('./poolDiscovery');
      const discovery = getInstance();
      const hasActiveTonChannel = () => channels.listEnabled().some((c) => {
        const chList = c.settings?.chains;
        return Array.isArray(chList) && chList.includes('ton');
      });
      const tickDiscovery = () => {
        const should = hasActiveTonChannel();
        if (should && !discovery.started) {
          discovery.start();
          console.log('🟢 TON on-chain discovery BAŞLATILDI');
        } else if (!should && discovery.started) {
          discovery.stop();
          console.log('⚪ TON on-chain discovery DURDURULDU');
        }
      };
      setTimeout(tickDiscovery, 8_000);
      setInterval(tickDiscovery, 60_000);
    } catch (e) {
      console.error('Pool discovery init:', e.message);
    }
    setTimeout(() => runScan('cron', 'ton'), 5_000);
    setInterval(() => runScan('cron', 'ton'), scanIntervalMin('ton') * 60 * 1000);
  }

  if (BSC_SCAN_ENABLED) {
    setTimeout(() => runScan('cron', 'bsc'), 30_000);
    setInterval(() => runScan('cron', 'bsc'), scanIntervalMin('bsc') * 60 * 1000);
  }

  if (SOLANA_SCAN_ENABLED) {
    setTimeout(() => runScan('cron', 'solana'), 15_000);
    setInterval(() => runScan('cron', 'solana'), scanIntervalMin('solana') * 60 * 1000);
  }
  setInterval(() => {
    checkWatchedTokens().catch((e) => console.error('[watch]', e.message));
  }, WATCH_INTERVAL_SEC * 1000);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
