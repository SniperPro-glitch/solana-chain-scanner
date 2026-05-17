// Userbot (MTProto) — kanal mesajlarını Premium hesap üzerinden gönderir.
// Bot API ile kanala post: custom emoji / premium emoji genelde düz metne düşer.
// index.sendCardToChannel varsayılan olarak sendAsChannel KAPALI tutar: mesaj userbot
// kullanıcı kimliğiyle gider (premium emoji korunur). Kanal adına imzalamak için
// ortamda USERBOT_SEND_AS_CHANNEL=1 (GramJS sendAs = kanal entity).
//
// Env değişkenleri:
//   TG_API_ID, TG_API_HASH, TG_SESSION
// Eksikse veya kanal "userbotEnabled" değilse Bot API fallback kullanılır.

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

let _client = null;
let _ready = false;
let _disabled = false;
let _connecting = null;
let _userId = null;

async function _connect() {
  const apiId = parseInt(process.env.TG_API_ID || '0', 10);
  const apiHash = process.env.TG_API_HASH;
  const sessionStr = process.env.TG_SESSION;
  if (!apiId || !apiHash || !sessionStr) {
    _disabled = true;
    console.log('🔕 Userbot: TG_API_ID/TG_API_HASH/TG_SESSION eksik — devre dışı, Bot API fallback kullanılacak');
    return null;
  }
  try {
    const session = new StringSession(sessionStr);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      autoReconnect: true,
    });
    // gramjs verbose log'larını kapat
    try { client.setLogLevel?.('error'); } catch (_) { /* yoksay */ }
    await client.connect();
    const me = await client.getMe();
    console.log(`✅ Userbot bağlandı: ${me.firstName || ''} ${me.lastName || ''} (@${me.username || '-'}, id=${me.id})`);
    _client = client;
    _ready = true;
    _userId = String(me.id);
    return client;
  } catch (e) {
    console.error('❌ Userbot bağlantı hatası:', e.message);
    _disabled = true;
    return null;
  }
}

async function getClient() {
  if (_disabled) return null;
  if (_ready && _client) return _client;
  if (_connecting) return _connecting;
  _connecting = _connect().finally(() => { _connecting = null; });
  return _connecting;
}

function isEnabled() {
  return !_disabled;
}

/**
 * Kanala metin gönderir (HTML, animasyonlu custom emoji destekli).
 * @param {string|number} chatId - @username veya numeric chatId
 * @param {string} html
 * @param {object} opts - { silent }
 * @returns {Promise<{ok:boolean, messageId?:number, error?:string}>}
 */
async function sendMessage(chatId, html, opts = {}) {
  const client = await getClient();
  if (!client) return { ok: false, error: 'userbot disabled' };
  try {
    const entity = await client.getEntity(chatId);
    const sendAs = opts.sendAsChannel === true ? entity : undefined;
    const sendOpts = {
      message: html,
      parseMode: 'html',
      silent: opts.silent === true,
      linkPreview: false,
      sendAs,
    };
    // Reply support: replyTo → mevcut posta cevap olarak gönder
    if (opts.replyTo && Number.isInteger(opts.replyTo)) {
      sendOpts.replyTo = opts.replyTo;
    }
    const result = await client.sendMessage(entity, sendOpts);
    return { ok: true, messageId: result.id };
  } catch (e) {
    console.error('Userbot sendMessage hatası:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Kanala dosya (foto vs.) + caption gönderir.
 * fileSource: URL, Buffer, veya local path. Bot API file_id ÇALIŞMAZ — bot ile indir, buffer geçir.
 */
async function sendFile(chatId, fileSource, html, opts = {}) {
  const client = await getClient();
  if (!client) return { ok: false, error: 'userbot disabled' };
  try {
    const entity = await client.getEntity(chatId);
    const sendAs = opts.sendAsChannel === true ? entity : undefined;

    // Buffer ise CustomFile ile uzantı ver — yoksa Telegram document sanıyor (foto görünmüyor)
    let fileToSend = fileSource;
    if (Buffer.isBuffer(fileSource)) {
      const { CustomFile } = require('telegram/client/uploads');
      fileToSend = new CustomFile('banner.jpg', fileSource.length, '', fileSource);
    }

    const sendFileOpts = {
      file: fileToSend,
      caption: html,
      parseMode: 'html',
      silent: opts.silent === true,
      linkPreview: false,
      forceDocument: false,
      sendAs,
    };
    if (opts.replyTo && Number.isInteger(opts.replyTo)) {
      sendFileOpts.replyTo = opts.replyTo;
    }
    const result = await client.sendFile(entity, sendFileOpts);
    return { ok: true, messageId: result.id };
  } catch (e) {
    console.error('Userbot sendFile hatası:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Mevcut bir text mesajını düzenler (HTML, custom emoji destekli).
 */
async function editMessage(chatId, messageId, html, opts = {}) {
  const client = await getClient();
  if (!client) return { ok: false, error: 'userbot disabled' };
  try {
    const entity = await client.getEntity(chatId);
    await client.editMessage(entity, {
      message: messageId,
      text: html,
      parseMode: 'html',
      linkPreview: false,
    });
    return { ok: true };
  } catch (e) {
    console.error('Userbot editMessage hatası:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Bir foto mesajının media'ını ve caption'ını değiştirir.
 * fileSource: Buffer ya da local path. Bot API file_id ÇALIŞMAZ.
 */
async function editMessageMedia(chatId, messageId, fileSource, html, opts = {}) {
  const client = await getClient();
  if (!client) return { ok: false, error: 'userbot disabled' };
  try {
    const entity = await client.getEntity(chatId);
    let fileToSend = fileSource;
    if (Buffer.isBuffer(fileSource)) {
      const { CustomFile } = require('telegram/client/uploads');
      fileToSend = new CustomFile('banner.jpg', fileSource.length, '', fileSource);
    }
    await client.editMessage(entity, {
      message: messageId,
      file: fileToSend,
      text: html,
      parseMode: 'html',
      linkPreview: false,
      forceDocument: false,
    });
    return { ok: true };
  } catch (e) {
    console.error('Userbot editMessageMedia hatası:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Birden fazla mesajı toplu siler. Kanal admin/owner gerekir.
 * @param {string|number} chatId
 * @param {number[]} messageIds
 */
async function deleteMessages(chatId, messageIds) {
  const client = await getClient();
  if (!client) return { ok: false, error: 'userbot disabled' };
  try {
    const entity = await client.getEntity(chatId);
    // 100'erli batch
    const batches = [];
    for (let i = 0; i < messageIds.length; i += 100) {
      batches.push(messageIds.slice(i, i + 100));
    }
    let deleted = 0;
    for (const batch of batches) {
      await client.deleteMessages(entity, batch, { revoke: true });
      deleted += batch.length;
    }
    return { ok: true, deleted };
  } catch (e) {
    console.error('Userbot deleteMessages hatası:', e.message);
    return { ok: false, error: e.message };
  }
}

async function disconnect() {
  if (_client && _ready) {
    try { await _client.disconnect(); } catch (_) { /* yoksay */ }
  }
  _ready = false;
  _client = null;
}

function getUserId() {
  return _userId || null;
}

function entityToBotChatId(entity) {
  if (!entity) return null;
  const cn = entity.className;
  if (cn === 'Channel') return `-100${entity.id}`;
  if (cn === 'Chat') return `-${entity.id}`;
  return String(entity.id);
}

/**
 * Userbot hesabının admin olduğu kanal/süpergrupları yeniden kaydeder (deploy sonrası liste boşsa).
 * @param {{ add: Function }} channelsMod
 * @param {import('node-telegram-bot-api')} [bot] — bot üye mi doğrulaması
 */
async function syncAdminChannels(channelsMod, bot = null) {
  const client = await getClient();
  if (!client || !channelsMod?.add) return { synced: 0, scanned: 0 };

  let meBot = null;
  if (bot?.getMe) {
    try { meBot = await bot.getMe(); } catch (_) { /* yoksay */ }
  }

  let synced = 0;
  let scanned = 0;
  try {
    const dialogs = await client.getDialogs({ limit: 300 });
    for (const d of dialogs) {
      const ent = d.entity;
      if (!ent) continue;
      if (ent.className !== 'Channel' && ent.className !== 'Chat') continue;
      if (ent.className === 'Channel' && !ent.broadcast && !ent.megagroup) continue;

      scanned += 1;
      const chatId = entityToBotChatId(ent);
      if (!chatId) continue;

      if (meBot && bot?.getChatMember) {
        try {
          const m = await bot.getChatMember(chatId, meBot.id);
          if (['left', 'kicked'].includes(m.status)) continue;
        } catch {
          continue;
        }
      }

      try {
        const perms = await client.getPermissions(ent, 'me');
        if (!perms?.isAdmin && !perms?.isCreator) continue;
      } catch {
        continue;
      }

      const chat = {
        id: chatId,
        title: ent.title || d.name || ent.username || chatId,
        username: ent.username || null,
        type: ent.broadcast ? 'channel' : 'supergroup',
      };
      const { added } = channelsMod.add(chat, 'userbot-sync');
      if (added) synced += 1;
    }
    console.log(`[userbot] kanal sync: ${scanned} tarandı, ${synced} yeni kayıt`);
  } catch (e) {
    console.warn('[userbot] kanal sync hatası:', e.message);
  }
  return { synced, scanned };
}

module.exports = {
  getClient,
  isEnabled,
  getUserId,
  deleteMessages,
  sendMessage,
  sendFile,
  editMessage,
  editMessageMedia,
  disconnect,
  syncAdminChannels,
};
