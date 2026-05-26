/**
 * API’deki en/tr/ru (ve isteğe bağlı varsayılan) description kayıtlarını siler.
 * BotFather Description tekrar yansır (özellikle Rusça Telegram kullanıcıları).
 *
 *   node scripts/clear-api-bot-descriptions.js
 *   node scripts/clear-api-bot-descriptions.js --all   (varsayılan dahil)
 */

require('dotenv').config();
const { clearApiLocalizedBotTexts, telegramGet, LOCALIZED_LANGS } = require('../src/botApiDescriptionClear');

const TOKEN = String(process.env.BOT_TOKEN || '').trim();
const includeDefault = process.argv.includes('--all');

if (!TOKEN) {
  console.error('BOT_TOKEN yok — .env veya ortam değişkeni ver.');
  process.exit(1);
}

(async () => {
  const me = await telegramGet(TOKEN, 'getMe');
  if (!me.ok) {
    console.error('getMe:', me.description || me);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username}\n`);

  for (const lang of LOCALIZED_LANGS) {
    const r = await telegramGet(TOKEN, 'getMyDescription', { language_code: lang });
    const t = r?.result?.description || '';
    console.log(`[${lang}] önce: ${t ? t.slice(0, 100) + '…' : '(boş)'}`);
  }

  const { cleared, errors } = await clearApiLocalizedBotTexts(TOKEN, { includeDefault });
  console.log(`\nTemizlendi: ${cleared} çağrı`);
  if (errors.length) console.warn('Hatalar:', errors.join('\n'));

  console.log('\nBotFather → Edit Description → kaydet. Telegram Rusça olsa bile artık API ru kilidi yok.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
