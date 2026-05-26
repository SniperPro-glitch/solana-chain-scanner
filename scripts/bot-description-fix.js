/**
 * BotFather Description yansımıyorsa: eski deploy API’ye en/tr/ru yazmış olabilir.
 * Bu script deploy’da ÇALIŞMAZ — sen bir kez elle çalıştırırsın.
 *
 *   node scripts/bot-description-fix.js check
 *   node scripts/bot-description-fix.js clear
 *
 * .env → BOT_TOKEN = @dexscannerappbot (DEX), scan bot değil.
 */

require('dotenv').config();
const https = require('https');

const TOKEN = String(process.env.BOT_TOKEN || '').trim();
const CMD = (process.argv[2] || 'check').toLowerCase();
const LANGS = ['', 'en', 'tr', 'ru'];

function call(method, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const url = `https://api.telegram.org/bot${TOKEN}/${method}?${q}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(body || e.message));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  if (!TOKEN) {
    console.error('BOT_TOKEN yok (.env)');
    process.exit(1);
  }
  if (!['check', 'clear'].includes(CMD)) {
    console.error('Kullanım: node scripts/bot-description-fix.js check|clear');
    process.exit(1);
  }

  const me = await call('getMe');
  if (!me.ok) {
    console.error('getMe:', me.description || me);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username} (${me.result.first_name})\n`);

  if (CMD === 'check') {
    console.log('=== Telegram API’de kayıtlı Description (BotFather’dan bağımsız) ===\n');
    let blocked = false;
    for (const lang of LANGS) {
      const p = lang ? { language_code: lang } : {};
      const r = await call('getMyDescription', p);
      const text = r?.result?.description || '';
      const label = lang || 'varsayılan';
      if (text) {
        blocked = true;
        console.log(`[${label}] API METNİ VAR (${text.length} karakter):`);
        console.log(text.slice(0, 200) + (text.length > 200 ? '…' : ''));
      } else {
        console.log(`[${label}] (boş — BotFather varsayılanı kullanılır)`);
      }
      console.log('');
    }
    if (blocked) {
      console.log('→ Rusça Telegram [ru] doluysa BotFather değişikliği görünmez.');
      console.log('→ Çözüm: node scripts/bot-description-fix.js clear');
      console.log('→ Sonra BotFather → Edit Description → tekrar kaydet.\n');
    } else {
      console.log('API kilidi yok. BotFather doğru bot mu (@dexscannerappbot)? Telegram önbelleğini yenile.\n');
    }
    return;
  }

  console.log('en / tr / ru API kayıtları siliniyor (BotFather varsayılanına döner)…\n');
  for (const lang of ['en', 'tr', 'ru']) {
    const r = await call('setMyDescription', { description: '', language_code: lang });
    const short = await call('setMyShortDescription', { short_description: '', language_code: lang });
    console.log(`  [${lang}] description: ${r.ok ? 'ok' : r.description}`);
    console.log(`  [${lang}] short: ${short.ok ? 'ok' : short.description}`);
  }
  console.log('\nBitti. BotFather → Edit Description → metnini kaydet → profili yenile.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
