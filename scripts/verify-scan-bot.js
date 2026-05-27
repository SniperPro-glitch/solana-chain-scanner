/**
 * @sniperscanbot token doğrulama (Railway öncesi)
 *   node scripts/verify-scan-bot.js
 * .env → BOT_TOKEN = sniperscanbot token
 */

require('dotenv').config();
const https = require('https');
const { DEFAULT_SCAN_BOT_USERNAME } = require('../src/botMode');

const TOKEN = String(process.env.BOT_TOKEN || '').trim();
if (!TOKEN) {
  console.error('BOT_TOKEN yok (.env)');
  process.exit(1);
}

https.get(`https://api.telegram.org/bot${TOKEN}/getMe`, (res) => {
  let body = '';
  res.on('data', (c) => { body += c; });
  res.on('end', () => {
    const j = JSON.parse(body);
    if (!j.ok) {
      console.error('getMe FAIL:', j.description);
      process.exit(1);
    }
    const u = j.result.username;
    const ok = u === DEFAULT_SCAN_BOT_USERNAME;
    console.log(`Bot: @${u} (${j.result.first_name})`);
    console.log(ok ? `OK — @${DEFAULT_SCAN_BOT_USERNAME}` : `UYARI — beklenen @${DEFAULT_SCAN_BOT_USERNAME}`);
    process.exit(ok ? 0 : 2);
  });
}).on('error', (e) => {
  console.error(e);
  process.exit(1);
});
