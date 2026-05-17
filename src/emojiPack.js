// Solana Chain Scanner — premium custom emoji (Telegram).
// Kanal postlarında animasyon için userbot (TG_SESSION) gerekli.
// wrapEmojis() unicode emoji'leri <tg-emoji emoji-id="..."> ile sarar.
// Yeni ID: SOLANA_CUSTOM_EMOJI_JSON env veya SOLANA_EMOJI_MAP içinde güncelle.

const EMOJI_MAP = {
  '⚡': '5258203794772085854',
  '⭐': '6190262606251430342',
  '🪄': '5260426225599405269',
  '🎄': '5415593953665771519',
  '🎉': '5415593910716096435',
  '🎊': '5415581549800218825',
  '🤩': '5415660718932385203',
  '🙃': '5327976491978349308',
  '🤔': '5435953928304870894',
  // '😈': '5444981176466953291',  // YANLIŞ — kedi gösteriyor
  '🤖': '5767368031659368530',  // Bot analiz — TonChainscanner ayı logosu
  '👉': '5471978009449731768',
  '⏳': '5391343181038106387',
  // '❓': '5235711188418838685', // KALDIRILDI — DOCUMENT_INVALID (silinmiş/geçersiz)
  '💬': '5465300082628763143',
  '✉️': '5406631276042002796',
  '☁️': '5199545888812329919',
  '👇': '5470177992950946662',
  '🔍': '5999337011998104831',
  '💰': '6046155226426121683',
  '📊': '6048891472780992240',
  // Geçmiş sohbetten kurtarılan ID'ler
  '🔥': '5424972470023104089', // Popüler satırı (user custom)
  '🏅': '5814173103487456712', // Gümüş madalya — BİLİNEN PROJE satırı
  '🚀': '5363909133269481082', // Momentum bölümü
  '🟡': '5431822693752122387',
  '🟢': '5893499826594649402',
  '🔎': '5278456597092264192',
  '🦅': '5280877378099227736',
  '🦎': '5292232906557635306',
  '🆕': '5190801313922847501',   // Yeni Token kart başlığı
  // Turn 28-31'den çıkarılan ID'ler
  '💎': '5384398064301651592',  // TON orijinal logo (kristal)
  '🔐': '5377705435807619775',  // Anahtarlı kağıt — Contract
  '⚡': '5363909133269481082',         // Elektrik (canlı sohbette doğrulanan)
  '⚡️': '5445358072732064475',   // Elektrik (variation) — Bot analiz sembolü
  '🧠': '5767368031659368530',  // Beyin — Bot Analizi başlığı (ayı logosu)
  '🐻': '5767368031659368530',  // Ayı — TonChainscanner logosu
  '🟣': '5998906604735437913',  // Mor yuvarlak (SNIPER trending)
  '✅': '5244556102397336171',         // Yeşil tik (kimlik doğrulama)
  '⚖️': '5314613581705132533',  // Terazi — Alıcı/satıcı dengesi
  '📈': '5406756195165810055',   // Yükselen grafik — Hacim/Likidite
  '🗄': '5262529363710060188',   // Arşiv kutusu — Likidite seviyesi
  '🗄️': '5262529363710060188',
  '❗️': '6120510039556884835',  // Sarı ünlem — SARI uyarılar
  '❗': '6120510039556884835',
  '🛰': '6012792650615230712',  // Uydu — Tarama
  '🛰️': '6012792650615230712',
  '🌡': '5372980108493596586',  // Termometre
  '🌡️': '5372980108493596586',
  '⭕️': '5949785441728205181',  // SCAM tabelası
  '⭕': '5949785441728205181',
  '🚫': '5949785441728205181',  // No-entry → SCAM tabelası
  '⚠️': '5463021280355705884',  // Tehlikeli/danger üçgen
  '⚠': '5463021280355705884',
  '🚨': '5274002784725771629',  // Kırmızı tepe lambası — SCAM/risk alert
  '💲': '5208449313067258557',  // Dolar işareti
  '🏦': '5264895611517300926',  // Banka — Market Cap
  '👥': '5996963995322424988',  // Çoklu kişi — Holders count
  // Manuel whitelist rozeti (popüler / bilinen proje) — yeşil tik yerine
  '🛡': '5424972470023104089',
  // ─ Görsel ikame eslesmeler (gercek IDsi yok; benzer animasyonlu ile sarılır) ─
  '💧': '5384398064301651592',  // Likidite → TON kristali
  '💸': '6046155226426121683',  // Uçan para → kanatlı dolar
  '📦': '5264895611517300926',  // MCap kutu → banka
  '➡️': '5471978009449731768',   // Sağ ok → işaret parmağı
  '⏱': '5391343181038106387',         // Yaş / kronometre (kum saati animasyonlu)
  '⏱️': '5391343181038106387',
  '🕒': '5391343181038106387',        // SCAM auto-delete notu → aynı saat paketi
  '🕐': '5391343181038106387',
  '⏰': '5391343181038106387',
  '🏛': '5384398064301651592',  // DEX bina → TON kristali
  '📛': '5471978009449731768',  // Etiket → parmak (token adı satırı)
  '🟠': '5431822693752122387',  // Turuncu → sarı yuvarlak
  '🔴': '5305696237461189630',  // Alıcı-satıcı dengesizliği
  '❌': '5949785441728205181',  // Kırmızı çarpı → yasak işareti (animasyonlu)
  '🚨': '5217769508063697338',  // Siren → ateş/tehlike
  // '📉': '5444981176466953291',  // KAPALI — ID kedi gösteriyor
};

// ────────────────────────────────────────────────────────────────────
// BSC (Binance Smart Chain) — zincire özel custom emoji ID'leri.
// Bu map'teki karakterler BSC kartlarında <tg-emoji> ile sarılır.
// ────────────────────────────────────────────────────────────────────
const BSC_EMOJI_MAP = {
  // ─ İlk 5 BSC custom emoji (User'dan toplandı 13 May 2026) ─
  '🛒': '5323475344777294878',   // BSC flaması (chain badge — kart başlığı, TON'da 💎 yerine)
  '🔍': '4981381367154607055',   // BscScan logo (Explorer linki için, TON'da TonViewer arama ikonu yerine)
  '✅': '5129631509224883014',   // Sarı tik (Verified contract — TON'da yeşil tik yerine)
  '⚡': '5195279659142506222',   // Sarı elektrik (Power/Speed — TON'da elektrik yerine)
  '⚡️': '5195279659142506222',
  '➡️': '5382082333899769147',   // Sarı sağ ok (CTA/aksiyon — TON'da işaret parmağı yerine)
  '👉': '5382082333899769147',   // Aynı sağ ok
  '📛': '5382082333899769147',   // Etiket (token adı satırı — formatter'da 📛 alias) → sarı ok
  // Chain badge için 💎 → 🛒 swap (BSC kartında TON kristali yerine BSC flaması)
  '💎': '5323475344777294878',
  // BscScan / arama alias’ları — 🔎 (büyük büyteç) de BscScan logosu yap
  '🔎': '4981381367154607055',
  // Sarı ünlem (☘️ pack'te) — yellow level uyarılarında
  '❗️': '5339425788162748336',
  '❗': '5339425788162748336',
  // BNB logo (🪙) — token badge, DEX, hacim, chain emoji
  '🪙': '5814447916969890525',
  '🏛': '5814447916969890525',   // DEX kolonu (🏛 "bina") → BNB logo
  '🏛️': '5814447916969890525',
  '💧': '5814447916969890525',   // Likidite (💧 damla) → BNB logo (sarı yuvarlak ile uyumlu)
  // Binance logo (🤡) — sadece çıplak 🤡 emoji basıldığında; FDV/MCap artık TON pack'i kullanıyor (user isteği)
  '🤡': '4915758209651704618',
  // PancakeSwap logosu (🥞) — DEX satırında
  '🥞': '5830115502399166320',
  // NEW (🆕) — "Yeni Token" satırı başında BSC versiyonu
  '🆕': '5237902107134147475',
  // BscScan link emojisi — "BscScan" linkinin başında (Risk’teki 🔎’den farklı)
  // 🌐 yerel network/explorer ikonu olarak BSC'ye bağlanıyor
  '🌐': '5379738385562738946',
  // "B" etiketli rombi — Kontrat: satırının başı (BINANCE'ın ilk parçası)
  '🏷️': '5136853028581671956',
  '🏷': '5136853028581671956',
  // CoinMarketCap logosu — "MCap:" satırının başında
  'Ⓜ️': '5345803067272994307',
  'Ⓜ': '5345803067272994307',
  '🏦': '5345803067272994307',  // MCap satırı (🏦 banka) → CoinMarketCap logosu (BSC özel)
  '📦': '5345803067272994307',  // MCap kutusu → CoinMarketCap logosu (BSC özel)
  // Whitelist rozeti — TON ile aynı ateş arma (user custom emoji)
  '🛡': '5424972470023104089',
  '🔥': '5424972470023104089',
  '🏅': '5814173103487456712',
  '🚀': '5195279659142506222',
  '🐻': '5767368031659368530',
  '🤖': '5767368031659368530',
  '👥': '5996963995322424988',
  '💬': '5465300082628763143',
  '📊': '6048891472780992240',
  // Kart alanları (TON pack yedeği — BSC’de özel ID yoksa animasyonlu kalır)
  '🦅': '5280877378099227736',
  '🦎': '5292232906557635306',
  '🔐': '5377705435807619775',
  '💲': '5208449313067258557',
  '💰': '6046155226426121683',
  '📛': '5382082333899769147',
  '⏱': '5391343181038106387',
  '⏱️': '5391343181038106387',
  '🕒': '5391343181038106387',
  '🕐': '5391343181038106387',
  '⏰': '5391343181038106387',
  '🟢': '5893499826594649402',
  '🟡': '5431822693752122387',
  '🟠': '5431822693752122387',
  '🔴': '5305696237461189630',
  '🔒': '5377705435807619775',
  '🔓': '5377705435807619775',
  '🌡': '5372980108493596586',
  '🌡️': '5372980108493596586',
  '⚠️': '5463021280355705884',
  '⚠': '5463021280355705884',
  '🚨': '5274002784725771629',
  '🔎': '4981381367154607055',
  '📈': '5406756195165810055',
  '⚖️': '5314613581705132533',
};

// ── Solana premium emoji — SENİN TARİFİN (alt açıklama = yorum bloğu) ──
//
// KART (üst foto caption):
//   🪙 5843946791740905640 → Sol kontrat satırı, risk yazısı, likidite satırı (+ başlık Solana rozeti)
//   🆕 5190801313922847501 → “Yeni Token” / New olan yerler
//   ❤️ 5424733863114980704 → dikkat emojileri (sarı kart, uyarı listesi)
//   💬 5420465103709423748 → yalnızca “bot yorumu işareti” (↓ yorumu oku ipucu)
//   💊/💰/☄️ → kart DEX satırı (Pump / Raydium / Meteora)
//
// YORUM (alt açıklama — formatChannelComment):
//   🟢/❤️/🔴 → YEŞİL/SARI/KIRMIZI rating bloğu
//   🪙 → “Bot analizi” altı: risk, likidite, yaş (kartla aynı mantık)
//   🤔 4940452364638225625 → tik / onay işaretleri (kontrat güvenliği + analiz maddeleri)
//   ❤️ → dikkat / holder / mint uyarıları
//   🪙 5280476129369543392 → yalnızca Solscan linki (solscanEmojiHtml)
//   💊 → Pump.fun logosu + pump DEX; 💰 Raydium; ☄️ Meteora; 👻 Phantom al/sat
//   🔥 5424972470023104089 → /wl bilinen token: POPÜLER satırı (kart + yorum)
//   🏅 5814173103487456712 → /wl bilinen token: BİLİNEN PROJE satırı (kart + yorum)
//   🤑 5251414920355931519 → (mesajında yer belirtilmedi — ID kayıtlı)
const SOLANA_EMOJI_BASE = {
  '◎': '5998906604735437913',
  '🪐': '5998906604735437913',
  '💎': '5998906604735437913',
  '🪙': '5843946791740905640',   // Solana: logo, kontrat, risk, likidite
  '🤑': '5251414920355931519',
  '🟣': '5998906604735437913',
  '🔍': '5999337011998104831',
  '🔎': '5278456597092264192',
  '🌐': '5278456597092264192',
  '🦅': '5280877378099227736',
  '🦎': '5292232906557635306',
  '🔐': '5377705435807619775',
  '💲': '5208449313067258557',
  '💰': '5328025123893029024',   // Raydium logosu (DEX satırı)
  '💧': '6046155226426121683',
  '💱': '6046155226426121683',
  '💸': '6046155226426121683',
  '📦': '5264895611517300926',
  '🏦': '5264895611517300926',
  '🏛': '5998906604735437913',
  '🏛️': '5998906604735437913',
  '📊': '6048891472780992240',
  '📈': '5406756195165810055',
  '🗄': '5262529363710060188',
  '🗄️': '5262529363710060188',
  '✅': '5244556102397336171',
  '⚡': '5445358072732064475',
  '⚡️': '5445358072732064475',
  '➡️': '5471978009449731768',
  '👉': '5471978009449731768',
  '👇': '5470177992950946662',
  '📛': '5471978009449731768',
  '🆕': '5190801313922847501',   // Yeni Token kart başlığı
  '❤️': '5424733863114980704',   // Dikkat / risk uyarısı
  '❤': '5424733863114980704',
  '🛡': '5424972470023104089',
  '🔥': '5424972470023104089',
  '🏅': '5814173103487456712',
  '🚀': '5363909133269481082',
  '🧠': '5767368031659368530',
  '🤖': '5767368031659368530',
  '👥': '5996963995322424988',
  '💬': '5420465103709423748',   // Kart: bot yorumu işareti (↓ yorumu oku)
  '🤔': '4940452364638225625',   // Onay / olumlu tik (✅ yerine)
  '⏱': '5391343181038106387',
  '⏱️': '5391343181038106387',
  '⏳': '5391343181038106387',
  '🕒': '5391343181038106387',
  '🕐': '5391343181038106387',
  '⏰': '5391343181038106387',
  '❗': '6120510039556884835',
  '❗️': '6120510039556884835',
  '🛰': '6012792650615230712',
  '🛰️': '6012792650615230712',
  '🟢': '5893499826594649402',
  '🟡': '5431822693752122387',
  '🟠': '5431822693752122387',
  '🔴': '5305696237461189630',
  '⭕': '5949785441728205181',
  '❌': '5949785441728205181',
  '🚫': '5949785441728205181',
  '⚠️': '5463021280355705884',
  '⚠': '5463021280355705884',
  '🚨': '5274002784725771629',
  '🌡': '5372980108493596586',
  '🌡️': '5372980108493596586',
  '⚖️': '5314613581705132533',
  '🔒': '5377705435807619775',
  '🔓': '5377705435807619775',
  '⭐': '6190262606251430342',
  '🎉': '5415593910716096435',
  '🛒': '6046155226426121683',   // Satın al
  '💊': '5440882540715986311',   // Pump.fun logosu
  '👻': '5289552365928589580',   // Phantom cüzdan (al/sat)
  '☄️': '5382292151642114303',   // Meteora logosu (DEX satırı)
  '☄': '5382292151642114303',
};

function loadSolanaEmojiOverrides() {
  const raw = String(process.env.SOLANA_CUSTOM_EMOJI_JSON || '').trim();
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    console.warn('[emoji] SOLANA_CUSTOM_EMOJI_JSON:', e.message);
    return {};
  }
}

const SOLANA_EMOJI_MAP = { ...SOLANA_EMOJI_BASE, ...loadSolanaEmojiOverrides() };

/** Solscan linki — 🪙 (karttaki 🪙 ile aynı karakter, ayrı ID) */
const SOLSCAN_LINK_EMOJI_ID = '5280476129369543392';

/** Raydium DEX satırı — 💰 (FDV / market cap satırında kullanılmaz) */
const RAYDIUM_DEX_EMOJI_ID = '5328025123893029024';

/** Meteora DEX satırı — ☄️ */
const METEORA_DEX_EMOJI_ID = '5382292151642114303';

/**
 * @param {string} emoji
 * @param {'solana'|'bsc'|'ton'} chain
 */
function getEmojiId(emoji, chain = 'solana') {
  if (chain === 'solana') return SOLANA_EMOJI_MAP[emoji] || null;
  if (chain === 'bsc') return BSC_EMOJI_MAP[emoji] || EMOJI_MAP[emoji];
  return EMOJI_MAP[emoji];
}

function getWrapMap(chain = 'solana') {
  if (chain === 'solana') return { ...SOLANA_EMOJI_MAP };
  if (chain === 'bsc') return { ...EMOJI_MAP, ...BSC_EMOJI_MAP };
  return EMOJI_MAP;
}

// TON yazısı (3 mavi kristal harf) — sadece HTML olarak inline kullanılır
const TON_LETTERS = {
  T: '6330237978429889879',
  O: '6330274116284717850',
  N: '6330353371316230786',
};

// BSC yazısı → BINANCE (5 parça sarı rombus animasyonlu) — Cryptach0 pack'inden
const BSC_LETTERS = {
  B: '5136853028581671956',  // "B" etiketli BNB rombi
  I: '4974273093200512268',  // "I"
  N: '4974725945962267860',  // "N"
  A: '4974297067707958345',  // "A"
  NCE: '4974564631285597715', // "NCE"
};

const TON_LOGO_IDS = {};

// TON yazısını animasyonlu 3 kristal harf olarak üret
function tonLogoHtml() {
  return (
    `<tg-emoji emoji-id="${TON_LETTERS.T}">💎</tg-emoji>` +
    `<tg-emoji emoji-id="${TON_LETTERS.O}">💎</tg-emoji>` +
    `<tg-emoji emoji-id="${TON_LETTERS.N}">💎</tg-emoji>`
  );
}

// BSC (BINANCE) yazısını animasyonlu 5 parça olarak üret
function bscLogoHtml() {
  return (
    `<tg-emoji emoji-id="${BSC_LETTERS.B}">🏷️</tg-emoji>` +
    `<tg-emoji emoji-id="${BSC_LETTERS.I}">🔸</tg-emoji>` +
    `<tg-emoji emoji-id="${BSC_LETTERS.N}">🔸</tg-emoji>` +
    `<tg-emoji emoji-id="${BSC_LETTERS.A}">🔸</tg-emoji>` +
    `<tg-emoji emoji-id="${BSC_LETTERS.NCE}">🔸</tg-emoji>`
  );
}

// Chain-aware logo helper
function solanaLogoHtml() {
  return customEmojiHtml('🪙', 'solana');
}

function chainLogoHtml(chain = 'solana') {
  if (chain === 'bsc') return bscLogoHtml();
  return solanaLogoHtml();
}

/** Manuel whitelist satırı — animasyonlu ateş rozeti (✅ yerine). */
const WHITELIST_BADGE_EMOJI_ID = SOLANA_EMOJI_BASE['🔥'];
const KNOWN_PROJECT_COIN_EMOJI_ID = SOLANA_EMOJI_BASE['🏅'];
const KNOWN_PROJECT_COIN_CHAR = '🏅';

function whitelistBadgeHtml(chain = 'solana') {
  const id = chain === 'solana'
    ? (SOLANA_EMOJI_MAP['🔥'] || WHITELIST_BADGE_EMOJI_ID)
    : chain === 'bsc'
      ? (BSC_EMOJI_MAP['🔥'] || WHITELIST_BADGE_EMOJI_ID)
      : (EMOJI_MAP['🔥'] || WHITELIST_BADGE_EMOJI_ID);
  return `<tg-emoji emoji-id="${id}">🔥</tg-emoji>`;
}

/** Gümüş madalya — "BİLİNEN PROJE" satırının başı ve sonu. */
function knownProjectCoinHtml(chain = 'solana') {
  const id = chain === 'solana'
    ? (SOLANA_EMOJI_MAP[KNOWN_PROJECT_COIN_CHAR] || KNOWN_PROJECT_COIN_EMOJI_ID)
    : chain === 'bsc'
      ? (BSC_EMOJI_MAP[KNOWN_PROJECT_COIN_CHAR] || KNOWN_PROJECT_COIN_EMOJI_ID)
      : (EMOJI_MAP[KNOWN_PROJECT_COIN_CHAR] || KNOWN_PROJECT_COIN_EMOJI_ID);
  return `<tg-emoji emoji-id="${id}">${KNOWN_PROJECT_COIN_CHAR}</tg-emoji>`;
}

/** Kanal yorumu zincir rozeti (BSC/TON). Solana analiz başlığı için botCommentTitleHtml kullan. */
function botLogoHtml(chain = 'solana') {
  if (chain === 'solana') return solanaLogoHtml();
  const id = chain === 'bsc'
    ? (BSC_EMOJI_MAP['🐻'] || BSC_EMOJI_MAP['🤖'] || '5767368031659368530')
    : (EMOJI_MAP['🐻'] || EMOJI_MAP['🤖'] || '5767368031659368530');
  return `<tg-emoji emoji-id="${id}">🐻</tg-emoji>`;
}

/** Yorum — “Bot analizi” başlık ikonu (💬). */
function botCommentTitleHtml(chain = 'solana') {
  if (chain !== 'solana') return botLogoHtml(chain);
  return customEmojiHtml('💬', 'solana');
}

function customEmojiHtml(emoji, chain = 'solana') {
  const id = getEmojiId(emoji, chain);
  if (!id) return emoji;
  return `<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`;
}

function solscanEmojiHtml(chain = 'solana') {
  if (chain !== 'solana') return '🔍';
  return `<tg-emoji emoji-id="${SOLSCAN_LINK_EMOJI_ID}">🪙</tg-emoji>`;
}

function phantomEmojiHtml(chain = 'solana') {
  if (chain !== 'solana') return '👻';
  return customEmojiHtml('👻', 'solana');
}

function raydiumEmojiHtml(chain = 'solana') {
  if (chain !== 'solana') return '💰';
  return `<tg-emoji emoji-id="${RAYDIUM_DEX_EMOJI_ID}">💰</tg-emoji>`;
}

function meteoraEmojiHtml(chain = 'solana') {
  if (chain !== 'solana') return '☄️';
  return `<tg-emoji emoji-id="${METEORA_DEX_EMOJI_ID}">☄️</tg-emoji>`;
}

/** DEX satırı — kart + yorum (Pump 💊, Raydium 💰, Meteora ☄️, diğer 🪐). */
function dexEmojiCharFor(tokenOrDex) {
  const d = String(
    typeof tokenOrDex === 'object' ? tokenOrDex?.dex : tokenOrDex,
  ).toLowerCase();
  if (!d) return '🪐';
  if (d === 'pumpfun' || d === 'pump' || d === 'pumpswap') return '💊';
  if (d === 'raydium' || d.startsWith('raydium')) return '💰';
  if (d === 'meteora' || d.startsWith('meteora')) return '☄️';
  return '🪐';
}

/** Kart caption sınırı için whitelist etiketi. */
function truncateWhitelistLabel(label, maxLen = 28) {
  const s = String(label || 'Whitelist').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/** Başlık satırı: " —🔥 Popüler · Etiket" (sarı/kırmızı kart; yeşil whitelist başlığı ayrı). */
function whitelistTitleSuffix(wl, lang, chain, translate, htmlEscape) {
  if (!wl) return '';
  const wlLabel = truncateWhitelistLabel(wl.label || wl.symbol || 'Whitelist');
  return ` —${whitelistBadgeHtml(chain)} <b>${translate('card.trustedWhitelist', lang, { label: htmlEscape(wlLabel) })}</b>`;
}

/**
 * /wl bilinen token — kart + yorum (manuel paylaşım dahil):
 *   🔥 POPÜLER · $SYM
 *   🔥 Popüler · {özel etiket}  (varsa, yeşil dışı veya özel isim)
 *   🏅 BİLİNEN PROJE 🏅
 */
function formatWhitelistKnownProjectBlock(token, lang, chain, translate, htmlEscape) {
  const wl = token?.trustedWhitelist;
  if (!wl) return '';
  const L = normalizeLang(lang);
  const he = htmlEscape || escapeHtml;
  const sym = he(token?.tokenSymbol || '?');
  const lines = [
    `${whitelistBadgeHtml(chain)} <b>${translate('card.popularLine', L)}</b> $${sym}`,
  ];
  const label = truncateWhitelistLabel(wl.label || wl.symbol || '');
  const skipDup = /^(whitelist|bilinen proje|known project)$/i.test(label);
  if (label && !skipDup) {
    lines.push(`${whitelistBadgeHtml(chain)} <b>${translate('card.trustedWhitelist', L, { label: he(label) })}</b>`);
  }
  const coin = knownProjectCoinHtml(chain);
  lines.push(`${coin} <b>${translate('card.knownProjectBadge', L)}</b> ${coin}`);
  return lines.join('\n');
}

/** Yeşil kart başlığı — whitelist varsa Yeni Token yerine. */
function formatTrustedGreenTitle(token, lang, chain, translate, htmlEscape) {
  const block = formatWhitelistKnownProjectBlock(token, lang, chain, translate, htmlEscape);
  return block || null;
}

// Bot API entity inşası (eski yapı — kanal mesajlarında stripleniyor, sadece DM/grup için fallback).
function buildCustomEmojiEntities(text) {
  const entities = [];
  for (const [emoji, id] of Object.entries(EMOJI_MAP)) {
    let idx = 0;
    while ((idx = text.indexOf(emoji, idx)) !== -1) {
      entities.push({
        type: 'custom_emoji',
        offset: idx,
        length: emoji.length,
        custom_emoji_id: id,
      });
      idx += emoji.length;
    }
  }
  entities.sort((a, b) => a.offset - b.offset);
  return entities;
}

// HTML escape (tg-emoji tag'inin içine güvenli emoji koyabilmek için).
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * HTML metnindeki bilinen unicode emoji'leri <tg-emoji emoji-id="..."> tag'i ile sarar.
 * Userbot (MTProto) ile gönderilince animasyonlu görünür.
 * Zaten <tg-emoji> içindekiler tekrar sarılmaz.
 */
function wrapEmojis(html, chain = 'solana') {
  if (!html) return html;

  if (chain === 'solana') {
    html = html.replace(/<tg-emoji\s+emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/g, (full, inner) => {
      const emoji = inner.trim();
      const sid = SOLANA_EMOJI_MAP[emoji];
      if (sid) return `<tg-emoji emoji-id="${sid}">${inner}</tg-emoji>`;
      return full;
    });
  }

  // BSC (legacy):
  if (chain === 'bsc') {
    html = html.replace(/<tg-emoji\s+emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/g, (full, inner) => {
      const emoji = inner.trim();
      const bscId = BSC_EMOJI_MAP[emoji];
      if (bscId) return `<tg-emoji emoji-id="${bscId}">${inner}</tg-emoji>`;
      return full;
    });
  }

  // Mevcut <tg-emoji>...</tg-emoji> bloklarını koru.
  const placeholders = [];
  let working = html.replace(/<tg-emoji[^>]*>[\s\S]*?<\/tg-emoji>/g, (m) => {
    placeholders.push(m);
    return `\u0000TGE${placeholders.length - 1}\u0000`;
  });

  const primaryMap = getWrapMap(chain);

  const entries = Object.entries(primaryMap).filter(([e, id]) => e && id);
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [emoji, id] of entries) {
    const parts = working.split(emoji);
    if (parts.length > 1) {
      working = parts.join(`<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`);
    }
  }

  // Placeholder'ları geri koy.
  working = working.replace(/\u0000TGE(\d+)\u0000/g, (_, i) => placeholders[parseInt(i, 10)]);
  return working;
}

module.exports = {
  EMOJI_MAP,
  BSC_EMOJI_MAP,
  SOLANA_EMOJI_BASE,
  SOLANA_EMOJI_MAP,
  solanaLogoHtml,
  getEmojiId,
  getWrapMap,
  buildCustomEmojiEntities,
  wrapEmojis,
  tonLogoHtml,
  bscLogoHtml,
  chainLogoHtml,
  whitelistBadgeHtml,
  knownProjectCoinHtml,
  KNOWN_PROJECT_COIN_EMOJI_ID,
  botLogoHtml,
  botCommentTitleHtml,
  customEmojiHtml,
  solscanEmojiHtml,
  phantomEmojiHtml,
  raydiumEmojiHtml,
  meteoraEmojiHtml,
  dexEmojiCharFor,
  SOLSCAN_LINK_EMOJI_ID,
  RAYDIUM_DEX_EMOJI_ID,
  METEORA_DEX_EMOJI_ID,
  whitelistTitleSuffix,
  formatTrustedGreenTitle,
  formatWhitelistKnownProjectBlock,
  truncateWhitelistLabel,
  WHITELIST_BADGE_EMOJI_ID,
  TON_LOGO_IDS,
  escapeHtml,
};
