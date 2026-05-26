/**
 * Start öncesi profil ekranındaki metin = Bot API description (BotFather + API dil kayıtları).
 * Ne göründüğünü kontrol: node scripts/show-bot-descriptions.js
 */

require('dotenv').config();
const https = require('https');

const TOKEN = String(process.env.BOT_TOKEN || '').trim();
if (!TOKEN) {
  console.error('BOT_TOKEN gerekli (.env)');
  process.exit(1);
}

function api(method, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const path = `/bot${TOKEN}/${method}?${q}`;
  return new Promise((resolve, reject) => {
    https
      .get(`https://api.telegram.org${path}`, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(body));
          }
        });
      })
      .on('error', reject);
  });
}

const LANGS = ['', 'en', 'tr', 'ru'];

(async () => {
  const me = await api('getMe');
  if (!me.ok) {
    console.error(me);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username}\n`);
  console.log('=== Description (Start öncesi profil metni) ===');
  for (const lang of LANGS) {
    const p = lang ? { language_code: lang } : {};
    const r = await api('getMyDescription', p);
    const t = r?.result?.description || '';
    console.log(`[${lang || 'varsayılan'}]\n${t || '(boş — BotFather varsayılanı geçerli)'}\n`);
  }
  console.log('=== Short description ===');
  for (const lang of LANGS) {
    const p = lang ? { language_code: lang } : {};
    const r = await api('getMyShortDescription', p);
    const t = r?.result?.short_description || '';
    console.log(`[${lang || 'varsayılan'}] ${t || '(boş)'}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
