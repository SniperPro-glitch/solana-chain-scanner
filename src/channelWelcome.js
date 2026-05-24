// Kanal hoş geldin + resmi kanal varsayılanları (◎ Solana, ayar butonu, Mini App).

const channels = require('./channels');
const { t } = require('./i18n');
const { buildSniperDexWebAppButton } = require('./dexAppButton');
const {
  getOfficialFeedChannelIds,
  isOfficialFeedChannel,
} = require('./channelFeedPolicy');

function channelIdToStartToken(chatId) {
  const id = String(chatId);
  if (id.startsWith('-100')) return id.slice(4);
  if (id.startsWith('-')) return id.slice(1);
  return id;
}

function buildWelcomeKeyboard(lang, botUsername, chatId) {
  const username = botUsername || 'bot';
  const deeplink = `https://t.me/${username}?start=settings_${channelIdToStartToken(chatId)}`;
  const rows = [[{ text: t('settings.open', lang), url: deeplink }]];
  const dexBtn = buildSniperDexWebAppButton(lang);
  if (dexBtn) rows.push([dexBtn]);
  return { inline_keyboard: rows };
}

/**
 * Kanal/grup: admin eklendiğinde hoş geldin (spam yok — welcomeMessageId varsa atla).
 * @returns {Promise<boolean>} gönderildi mi
 */
async function sendChannelWelcome(bot, chat, opts = {}) {
  if (!bot || !chat?.id) return false;
  if (chat.type === 'private') return false;

  const chatId = String(chat.id);
  const ch = channels.get(chatId) || channels.add(chat, opts.addedBy || 'welcome', opts.userId)?.channel;
  if (!ch) return false;

  if (!opts.force && ch.settings?.welcomeMessageId) {
    return false;
  }

  if (!opts.skipAdminCheck) {
    try {
      const me = await bot.getMe();
      const member = await bot.getChatMember(chatId, me.id);
      if (!['administrator', 'creator'].includes(member.status)) {
        console.warn(`[welcome] atlandı (bot admin değil): ${chatId}`);
        return false;
      }
    } catch (e) {
      console.warn(`[welcome] getChatMember: ${chatId}`, e.message);
      return false;
    }
  }

  const lang = channels.resolveCardLang(ch, { userId: opts.userId });
  const me = await bot.getMe().catch(() => null);
  const channelName = chat.title || 'Channel';
  const welcomeMsg = t('welcome.added', lang, { name: channelName });
  const replyMarkup = buildWelcomeKeyboard(lang, me?.username, chatId);

  const sent = await bot.sendMessage(chatId, welcomeMsg, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  }).catch((e) => {
    console.warn('[welcome] channel msg fail:', e.message);
    if (replyMarkup.inline_keyboard.length > 1) {
      return bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [replyMarkup.inline_keyboard[0]] },
      }).catch((e2) => {
        console.warn('[welcome] fallback (settings only):', e2.message);
        return null;
      });
    }
    return null;
  });

  if (sent?.message_id) {
    channels.updateSetting(chatId, 'welcomeMessageId', sent.message_id);
    console.log(`[welcome] gönderildi: ${channelName} (${chatId})`);
    return true;
  }
  return false;
}

/** Resmi feed kanalları: ağ ◎ Solana + enabled. */
function ensureOfficialChannelDefaults(chatId) {
  const id = String(chatId);
  if (!isOfficialFeedChannel(id)) return;
  const ch = channels.get(id);
  if (!ch) return;
  const chList = ch.settings?.chains;
  if (!Array.isArray(chList) || chList.length === 0) {
    channels.updateSetting(id, 'chains', ['solana']);
    console.log(`[channels] resmi kanal ◎ Solana otomatik: ${id}`);
  }
  if (ch.settings?.enabled === false) {
    channels.updateSetting(id, 'enabled', true);
  }
}

/** Açılış / env-sync: resmi kanalları kaydet, varsayılanları uygula, hoş geldin (gerekirse). */
async function bootstrapOfficialChannels(bot) {
  if (!bot) return { synced: 0, welcomed: 0 };
  const ids = getOfficialFeedChannelIds();
  if (!ids.length) return { synced: 0, welcomed: 0 };

  let welcomed = 0;
  for (const id of ids) {
    try {
      const chat = await bot.getChat(id);
      const { added } = channels.add(chat, 'official-bootstrap', null);
      if (added) console.log(`[channels] resmi kanal kayıt: ${chat.title || id}`);
      ensureOfficialChannelDefaults(id);
      const ch = channels.get(id);
      if (!ch?.settings?.welcomeMessageId) {
        const ok = await sendChannelWelcome(bot, chat, {
          userId: ch?.adderUserId,
          addedBy: 'official-bootstrap',
          skipAdminCheck: false,
        });
        if (ok) welcomed += 1;
      }
    } catch (e) {
      console.warn(`[channels] resmi kanal bootstrap ${id}:`, e.message);
    }
  }
  return { synced: ids.length, welcomed };
}

module.exports = {
  buildWelcomeKeyboard,
  sendChannelWelcome,
  ensureOfficialChannelDefaults,
  bootstrapOfficialChannels,
  channelIdToStartToken,
};
