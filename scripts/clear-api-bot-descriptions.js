/**
 * Eski deploy setMyDescription ile en/tr/ru yazdıysa BotFather metni yansımaz.
 * Bu script API’deki description + short description’ı siler (BotFather’daki kalır).
 *
 *   node scripts/clear-api-bot-descriptions.js
 *   (BOT_TOKEN = @dexscannerappbot token, .env veya ortam)
 */

require('dotenv').config();
const https = require('https');

const TOKEN = String(process.env.BOT_TOKEN || '').trim();
if (!TOKEN) {
  console.error('BOT_TOKEN yok — .env veya ortam değişkeni ver.');
  process.exit(1);
}

const LANGS = ['', 'en', 'tr', 'ru'];

function api(method, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const path = `/bot${TOKEN}/${method}${q.size ? `?${q}` : ''}`;
  return new Promise((resolve, reject) => {
    https
      .get(`https://api.telegram.org${path}`, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(body || e.message));
          }
        });
      })
      .on('error', reject);
  });
}

async function clearField(methodGet, methodSet, fieldName) {
  console.log(`\n── ${fieldName} ──`);
  for (const lang of LANGS) {
    const label = lang || '(varsayılan)';
    const getParams = lang ? { language_code: lang } : {};
    const before = await api(methodGet, getParams);
    const text = before?.result?.[fieldName] || before?.result?.description || '';
    console.log(`  [${label}] önce: ${text ? `${text.slice(0, 80)}…` : '(boş)'}`);

    const setParams = { [fieldName]: '' };
    if (lang) setParams.language_code = lang;
    const cleared = await api(methodSet, setParams);
    if (!cleared.ok) {
      console.warn(`  [${label}] silinemedi:`, cleared.description || cleared);
      continue;
    }
    const after = await api(methodGet, getParams);
    const afterText = after?.result?.[fieldName] || after?.result?.description || '';
    console.log(`  [${label}] sonra: ${afterText ? 'HALA VAR' : 'boş ✓'}`);
  }
}

(async () => {
  const me = await api('getMe');
  if (!me.ok) {
    console.error('getMe:', me.description || me);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username} (${me.result.first_name})`);
  console.log('API açıklamaları siliniyor — ardından BotFather’da Description’ı tekrar kaydet.\n');

  await clearField('getMyDescription', 'setMyDescription', 'description');
  await clearField('getMyShortDescription', 'setMyShortDescription', 'short_description');

  console.log('\nBitti. Telegram’da botu kapat/aç; BotFather → Edit Description → metni tekrar kaydet.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
