// Userbot session string üretici
// Kullanım:
//   1) cd ton-chain-scanner
//   2) npm install telegram input
//   3) node scripts/generate-session.js
//   4) Telefon numarası gir (örn: +905XXXXXXXXX)
//   5) Telegram'a gelen SMS kodunu gir
//   6) 2FA şifren varsa onu da gir
//   7) Çıkan SESSION STRING'i kopyala, .env veya Railway'e TG_SESSION olarak koy

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const apiId = parseInt(process.env.TG_API_ID || '', 10);
const apiHash = (process.env.TG_API_HASH || '').trim();
if (!apiId || !apiHash) {
  console.error('❌ .env içinde TG_API_ID ve TG_API_HASH tanımlı olmalı (https://my.telegram.org/apps)');
  process.exit(1);
}
const stringSession = new StringSession(''); // boş başlat

(async () => {
  console.log('🔐 Userbot session üretici başlıyor...\n');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('📱 Telefon numarası (örn +905...): '),
    password: async () => await input.text('🔑 2FA şifresi (yoksa boş bırak): '),
    phoneCode: async () => await input.text('💬 Telegram\'a gelen kodu gir: '),
    onError: (err) => console.error('Hata:', err),
  });

  console.log('\n✅ Başarılı! Aşağıdaki SESSION STRING\'i Railway env\'e TG_SESSION olarak koy:\n');
  console.log('────────────────────────────────────────');
  console.log(client.session.save());
  console.log('────────────────────────────────────────\n');
  console.log('⚠️  Bu string\'i kimseyle paylaşma — hesabını kontrol etme yetkisi verir.\n');

  await client.disconnect();
  process.exit(0);
})();
