// Botun eklendiği tüm kanal/grupları otomatik kaydeden depo + kanal-bazlı ayarlar.

const fs = require('fs');
const path = require('path');
const { t, normalizeLang } = require('./i18n');
const { DATA_DIR, ensureDataDir, isPersistentDataDir } = require('./data-path');

const VALID_CHAIN_IDS = new Set(['solana']);
/** Kanal ayarları panelinde bir kez gösterilecek uyarı (normalize sonrası). */
const chainsSanitizeNotices = new Map();

/**
 * Tek kanal = tek zincir. channels.json'da ['ton','bsc'] veya geçersiz karışım varsa düzeltir.
 * @returns {{ chains: string[]|null, changed: boolean, reason: 'multi'|'cleaned'|'invalid_type'|null, dropped?: string[] }}
 */
function normalizeChainsSetting(raw) {
  if (raw == null) {
    return { chains: null, changed: false, reason: null };
  }
  if (!Array.isArray(raw)) {
    return { chains: null, changed: true, reason: 'invalid_type' };
  }
  const orderedUnique = [];
  const seen = new Set();
  for (const item of raw) {
    const c = typeof item === 'string' ? item.toLowerCase().trim() : '';
    if (!VALID_CHAIN_IDS.has(c)) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    orderedUnique.push(c);
  }
  if (orderedUnique.length === 0) {
    const hadEntries = raw.length > 0;
    return { chains: null, changed: hadEntries, reason: hadEntries ? 'cleaned' : null };
  }
  if (orderedUnique.length === 1) {
    const chains = [orderedUnique[0]];
    const changed = JSON.stringify(raw) !== JSON.stringify(chains);
    return { chains, changed, reason: changed ? 'cleaned' : null };
  }
  const chains = [orderedUnique[0]];
  const dropped = orderedUnique.slice(1);
  return { chains, changed: true, reason: 'multi', dropped };
}

function queueChainsSanitizeNotice(channelId, lang, norm) {
  if (!norm || norm.reason !== 'multi' || !norm.chains || !norm.chains[0]) return;
  const L = normalizeLang(lang);
  const removed = (norm.dropped && norm.dropped.length ? norm.dropped.join(', ') : '?');
  const msg = t('settings.chain.sanitizedMulti', L, { kept: norm.chains[0], removed });
  chainsSanitizeNotices.set(String(channelId), msg);
}

function consumeChainsSanitizeNotice(chatId) {
  const id = String(chatId);
  const msg = chainsSanitizeNotices.get(id);
  if (!msg) return null;
  chainsSanitizeNotices.delete(id);
  return msg;
}

const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const CHANNEL_IDS_FILE = path.join(DATA_DIR, 'channel_ids.txt');

/** Deploy sonrası yeniden kayıtta ◎ Solana otomatik seçilsin (env-sync / userbot / boot). */
function shouldAutoSelectSolanaOnAdd(addedBy, existed) {
  if (existed) return false;
  if (['env-sync', 'userbot-sync', 'boot-sync'].includes(addedBy)) return true;
  return ['1', 'true', 'on', 'yes'].includes(
    String(process.env.AUTO_SELECT_SOLANA_ON_SYNC || '1').trim().toLowerCase(),
  );
}

// ─────────────────────────────────────────────────────────────
// Varsayılan kanal ayarları (her kanal kendi tercihini saklar)
// ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  enabled: true,
  minLiquidityUsd: 0,
  minVolume24hUsd: 0,
  minAgeMinutes: 0,            // 0 = sınır yok
  maxAgeMinutes: 0,            // 0 = sınır yok (24 saat = 1440)
  maxRiskLevel: 'HIGH',        // 'LOW' / 'MEDIUM' / 'HIGH' (skip levels above)
  allowedDexes: [],            // empty = all; ['dedust', 'stonfi']
  silentNotification: false,   // true = silent (no sound/vibration)
  maxTokensPerScan: 10,
  bannerFileId: null,          // Telegram file_id (channel owner uploads) — null = no banner
  welcomeMessageId: null,      // Welcome message id when bot added
  lang: 'en',                  // 'en' / 'tr' / 'ru'
  // ─ Chain (ağ) seçimi — her kanal tek ağ dinler. null = seçilmedi (bot mesaj atmaz) ─
  chains: null,                // null = DM'de ◎ Solana seçilene kadar paylaşım yok (TON ile aynı)
  // ─ Yeni filtreler ─
  minHolders: 0,               // 0 = sınır yok; 30/50/100 önerilir
  minAuditScore: 0,            // 0 = sınır yok; 60/70/80 (skor 0-100)
  watchDelayMinutes: 0,        // 0 = anında paylaş; 15/30 = sessiz bekleme odası (rug filter)
  userbotEnabled: true,        // true = Premium userbot ile gönder (animasyonlu emoji); kanalda userbot admin/owner olmalı. Fallback: Bot API
  // ─ V2 filtreler (mid-tier paketi sonrası) ─
  minMarketCapUsd: 0,          // 0 = sınır yok; çok küçük cap'i atla
  maxMarketCapUsd: 0,          // 0 = sınır yok; çok büyük cap'i atla (moonshot ya da bozuk veri filtresi)
  requireLpLocked: false,      // true = sadece top1 holder ≤ 30% (LP/holder konsantrasyon proxy)
  activeHoursEnabled: false,   // true = sadece belirli saatlerde paylaş (kanal lang TZ varsayılan: Europe/Istanbul UTC+3)
  activeHoursStart: 10,        // 0-23
  activeHoursEnd: 23,          // 0-23 (start < end)
  // ─ V3: Sybil filtre ─
  maxSybilRatio: 0,            // 0 = kapalı; 0.5 = %50 ortak funder ele, 0.75 = sadece ağır sybil ele
  // ─ Pump.fun mezuniyet (bonding %100 → PumpSwap) ─
  pumpGraduationMode: 'off',   // off | graduated_only | curve_only
};

// Risk seviye sıralaması (canonical kodlar)
const RISK_ORDER = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH'];

// Eski TR risk değerlerini canonical'a çeviren map (geriye dönük uyum)
const LEGACY_RISK_MAP = {
  'ÇOK DÜŞÜK': 'VERY_LOW', 'DÜŞÜK': 'LOW', 'ORTA': 'MEDIUM', 'YÜKSEK': 'HIGH',
  'VERY LOW': 'VERY_LOW', 'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH',
};

function normalizeRisk(r) {
  if (!r) return 'HIGH';
  return LEGACY_RISK_MAP[r] || LEGACY_RISK_MAP[String(r).toUpperCase()] || 'HIGH';
}

function ensureDir() {
  ensureDataDir();
}

function stubChannelRecord(id, addedBy, title = null) {
  return {
    id,
    title: title || `Kanal ${id}`,
    username: null,
    type: 'channel',
    addedAt: new Date().toISOString(),
    addedBy,
    lastError: null,
    archivedAt: null,
    settings: { ...DEFAULT_SETTINGS, chains: ['solana'] },
  };
}

function isChannelArchived(ch) {
  return Boolean(ch?.archivedAt);
}

function mergeChannelIdsFile(state) {
  if (!fs.existsSync(CHANNEL_IDS_FILE)) return state;
  try {
    const ids = fs.readFileSync(CHANNEL_IDS_FILE, 'utf8')
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const id of ids) {
      if (state.channels[id]) {
        delete state.channels[id].archivedAt;
        continue;
      }
      state.channels[id] = stubChannelRecord(id, 'ids-file');
    }
  } catch (e) {
    console.warn('[channels] channel_ids.txt okunamadı:', e.message);
  }
  return state;
}

/** Railway TELEGRAM_CHANNEL_IDS — deploy sonrası dosya silinse bile env'den geri gelir. */
function mergeEnvChannelIds(state) {
  const ids = new Set([
    ...parseChannelIdList(process.env.TELEGRAM_CHANNEL_ID),
    ...parseChannelIdList(process.env.TELEGRAM_CHANNEL_IDS || process.env.CHANNEL_IDS),
  ]);
  for (const id of ids) {
    if (state.channels[id]) {
      delete state.channels[id].archivedAt;
      if (!state.channels[id].settings?.chains?.includes('solana')) {
        state.channels[id].settings = state.channels[id].settings || { ...DEFAULT_SETTINGS };
        state.channels[id].settings.chains = ['solana'];
      }
      continue;
    }
    state.channels[id] = stubChannelRecord(id, 'env-file');
  }
  return state;
}

function writeChannelIdsBackup(state) {
  try {
    ensureDir();
    const ids = Object.keys(state.channels || {});
    fs.writeFileSync(CHANNEL_IDS_FILE, `${ids.join('\n')}\n`, 'utf8');
  } catch (e) {
    console.warn('[channels] channel_ids.txt yazılamadı:', e.message);
  }
}

function getChannelIdsForEnv() {
  return Object.values(cache.channels || {})
    .filter((c) => !isChannelArchived(c))
    .map((c) => c.id)
    .join(',');
}

function logEnvBackupHint() {
  const ids = getChannelIdsForEnv();
  if (!ids) return;
  if (isPersistentDataDir()) return;
  console.warn('[channels] 📋 Railway Variables yedek (deploy sonrası kanal kaybolmasın):');
  console.warn(`[channels] TELEGRAM_CHANNEL_IDS=${ids}`);
}

function load() {
  try {
    ensureDir();
    let state = { channels: {} };
    if (fs.existsSync(CHANNELS_FILE)) {
      state = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
    }
    state = mergeChannelIdsFile(state);
    state = mergeEnvChannelIds(state);
    return state;
  } catch (err) {
    console.error('channels.json okuma hatası:', err.message);
    return mergeEnvChannelIds(mergeChannelIdsFile({ channels: {} }));
  }
}

function save(state) {
  try {
    ensureDir();
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(state, null, 2));
    writeChannelIdsBackup(state);
  } catch (err) {
    console.error('channels.json yazma hatası:', err.message);
  }
}

let cache = load();

function parseChannelIdList(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Deploy sonrası env'deki kanal id'lerini Telegram'dan doğrular ve kayda ekler. */
async function syncFromBotApi(bot) {
  if (!bot?.getChat) return { synced: 0, ids: [] };
  const ids = new Set(parseChannelIdList(process.env.TELEGRAM_CHANNEL_ID));
  for (const id of parseChannelIdList(process.env.TELEGRAM_CHANNEL_IDS || process.env.CHANNEL_IDS)) {
    ids.add(id);
  }
  let synced = 0;
  const ok = [];
  for (const id of ids) {
    try {
      const chat = await bot.getChat(id);
      const { added } = addChannel(chat, 'env-sync');
      if (added) synced += 1;
      ok.push(id);
    } catch (e) {
      console.warn(`[channels] env-sync atlandı ${id}: ${e.message}`);
    }
  }
  if (ids.size) {
    console.log(`[channels] env-sync: ${ok.length}/${ids.size} kanal (${synced} yeni)`);
  }
  return { synced, ids: [...ok] };
}

function logBootSummary() {
  const list = Object.values(cache.channels || {});
  const fileExists = fs.existsSync(CHANNELS_FILE);
  const persist = isPersistentDataDir() ? 'KALICI' : 'GEÇİCİ (deploy sıfırlar)';
  console.log(`[channels] ${list.length} kanal · depo=${persist} · ${CHANNELS_FILE}`);
  if (!isPersistentDataDir()) {
    console.warn('[channels] ⚠️ Railway: Volume → Mount Path /app/data (veya TELEGRAM_CHANNEL_IDS yedek).');
  }
  if (!list.length) {
    console.log('[channels] (boş — TELEGRAM_CHANNEL_IDS env veya Volume /data gerekli)');
    logEnvBackupHint();
    return;
  }
  logEnvBackupHint();
  for (const ch of list) {
    const s = ch.settings || {};
    const net = Array.isArray(s.chains) && s.chains.includes('solana')
      ? 'solana'
      : (Array.isArray(s.chains) && s.chains.length ? s.chains.join(',') : 'AĞ-SEÇİLMEDİ');
    const filt = [
      `liq≥$${s.minLiquidityUsd || 0}`,
      `vol≥$${s.minVolume24hUsd || 0}`,
      `risk≤${s.maxRiskLevel || 'HIGH'}`,
      `holders≥${s.minHolders || 0}`,
      `audit≥${s.minAuditScore || 0}`,
      `mcap $${s.minMarketCapUsd || 0}-$${s.maxMarketCapUsd || '∞'}`,
    ].join(' ');
    const extra = [
      `pumpGrad=${s.pumpGraduationMode || 'off'}`,
      `sybil=${s.maxSybilRatio || 0}`,
      `dex=${(s.allowedDexes || []).length ? s.allowedDexes.join(',') : 'all'}`,
      `watch=${s.watchDelayMinutes || 0}m`,
      s.requireLpLocked ? 'lpLock' : null,
    ].filter(Boolean).join(' ');
    console.log(`[channels] · ${ch.title || ch.id} | ${net} | ${filt} | ${extra} | ${s.enabled !== false ? 'ON' : 'OFF'}`);
  }
}

// Eski yapılandırmadan TELEGRAM_CHANNEL_ID varsa ilk seferinde kayda al
if (process.env.TELEGRAM_CHANNEL_ID && Object.keys(cache.channels).length === 0) {
  const id = process.env.TELEGRAM_CHANNEL_ID;
  cache.channels[id] = {
    id,
    title: 'Initial channel (env)',
    type: 'channel',
    addedAt: new Date().toISOString(),
    addedBy: 'env',
    settings: { ...DEFAULT_SETTINGS },
  };
  save(cache);
}

// Eski kayıtları default settings ile migrate et + lang/maxRiskLevel canonical hale getir
let migrated = false;
for (const id of Object.keys(cache.channels)) {
  const ch = cache.channels[id];
  if (!ch.settings) {
    ch.settings = { ...DEFAULT_SETTINGS };
    migrated = true;
  } else {
    if (ch.settings.lang === undefined) {
      ch.settings.lang = 'en';
      migrated = true;
    }
    // Eski TR risk değerlerini canonical'a çevir
    const newMax = normalizeRisk(ch.settings.maxRiskLevel);
    if (ch.settings.maxRiskLevel !== newMax) {
      ch.settings.maxRiskLevel = newMax;
      migrated = true;
    }
    // chains alanı yoksa: eski kanal → varsayılan TON (geriye uyumluluk).
    // Sadece bu migration sırasında set edilir; yeni eklenen kanallarda null kalır.
    if (!('chains' in ch.settings)) {
      ch.settings.chains = null;
      migrated = true;
    }
  }
}

// Tek kanal = tek zincir: chains dizisini normalize et (elle json / script hataları)
let chainsMigrated = false;
for (const id of Object.keys(cache.channels)) {
  const ch = cache.channels[id];
  if (!ch.settings) continue;
  const before = JSON.stringify(ch.settings.chains);
  const n = normalizeChainsSetting(ch.settings.chains);
  if (!n.changed) continue;
  ch.settings.chains = n.chains;
  chainsMigrated = true;
  console.warn(`[channels] chains normalize ch=${id}: ${before} -> ${JSON.stringify(n.chains)} (${n.reason || ''})`);
  queueChainsSanitizeNotice(id, ch.settings.lang, n);
}
if (chainsMigrated) migrated = true;

if (migrated) save(cache);

// ─────────────────────────────────────────────────────────────
// Risk filtresi (tokenin riski kanalın izninden yüksek mi?)
// ─────────────────────────────────────────────────────────────
function shouldFilterByRisk(tokenRiskLevel, maxAllowedLevel) {
  const tokenIdx = RISK_ORDER.indexOf(normalizeRisk(tokenRiskLevel));
  const maxIdx = RISK_ORDER.indexOf(normalizeRisk(maxAllowedLevel));
  if (tokenIdx === -1 || maxIdx === -1) return false;
  return tokenIdx > maxIdx; // tokenin riski izinden büyükse ele
}

// ─────────────────────────────────────────────────────────────
// Token bir kanalın filtrelerinden geçer mi?
// ─────────────────────────────────────────────────────────────
function tokenPassesChannelFilters(token, audit, channel, opts = {}) {
  const s = channel.settings || DEFAULT_SETTINGS;
  if (!s.enabled) return { pass: false, reason: 'Channel disabled' };
  const chList = s.chains;
  if (!Array.isArray(chList) || chList.length === 0 || !chList.includes('solana')) {
    return { pass: false, reason: 'Network not selected (choose Solana in settings)' };
  }
  // Min likidite 0 = filtre yok. >0 ise geçerli sayı şart — aksi halde JS `undefined < 1500` false döner ve token yanlışlıkla geçer.
  const liqUsd = Number(token.liquidityUsd);
  if (s.minLiquidityUsd > 0) {
    if (!Number.isFinite(liqUsd)) {
      return { pass: false, reason: 'Liquidity data unavailable' };
    }
    if (liqUsd < s.minLiquidityUsd) {
      return { pass: false, reason: `Liquidity below $${s.minLiquidityUsd}` };
    }
  }
  if (s.minVolume24hUsd > 0) {
    const vol = Number(token.volume24h);
    if (!Number.isFinite(vol) || vol < s.minVolume24hUsd) {
      return { pass: false, reason: 'Volume too low' };
    }
  }
  // Manuel paylaşımda yaş filtresi atlanır (skipAge)
  if (!opts.skipAge && s.minAgeMinutes > 0 && (token.ageMinutes ?? 0) < s.minAgeMinutes) return { pass: false, reason: 'Token too new' };
  if (!opts.skipAge && s.maxAgeMinutes > 0 && (token.ageMinutes ?? 0) > s.maxAgeMinutes) return { pass: false, reason: 'Token too old' };
  if (shouldFilterByRisk(audit.risk.level, s.maxRiskLevel)) return { pass: false, reason: `Risk > ${s.maxRiskLevel}` };
  if (s.allowedDexes && s.allowedDexes.length > 0) {
    const dexBase = (token.dex || '').toLowerCase().replace(/-v\d+$/, '');
    if (!s.allowedDexes.map((d) => d.toLowerCase()).includes(dexBase)) {
      return { pass: false, reason: `DEX not allowed (${token.dex})` };
    }
  }
  const pumpMode = String(s.pumpGraduationMode || 'off').toLowerCase();
  if (pumpMode !== 'off') {
    const mint = token.tokenAddress || '';
    const isPump = token.isPumpFun || mint.endsWith('pump');
    if (isPump) {
      const graduated = token.pumpGraduated === true;
      if (pumpMode === 'graduated_only' && !graduated) {
        const pct = token.pumpBondingPct;
        const pctStr = pct != null ? `${pct}%` : '?';
        return { pass: false, reason: `Pump bonding incomplete (${pctStr}, need 100%)` };
      }
      if (pumpMode === 'curve_only' && graduated) {
        return { pass: false, reason: 'Pump already graduated (100%)' };
      }
    }
  }
  // Yeni filtreler — TON jetton: holdersCount; BSC risk.js: holders_count + token.holdersCount
  const holdersCount = Number(
    token.contract?.holdersCount ?? token.contract?.holders_count ?? token.holdersCount ?? 0,
  );
  if (s.minHolders > 0) {
    if (!Number.isFinite(holdersCount) || holdersCount < s.minHolders) {
      return { pass: false, reason: `Holders < ${s.minHolders}` };
    }
  }
  // audit.riskPercent: 0-100 (yüksek = riskli). Saflik skoru = 100 - riskPercent
  const safetyScore = 100 - (audit.riskPercent ?? 100);
  if (s.minAuditScore > 0 && safetyScore < s.minAuditScore) {
    return { pass: false, reason: `Safety score < ${s.minAuditScore}` };
  }
  // V2 filtreler — eşik 0 = kapalı. Eşik >0 iken veri yoksa: kullanıcı filtreyi istemiş, belirsizlikte geçirme.
  const mcapRaw = token.marketCapUsd ?? token.fdvUsd;
  const mcap = Number(mcapRaw);
  if (s.minMarketCapUsd > 0) {
    if (!Number.isFinite(mcap) || mcap <= 0) {
      return { pass: false, reason: `MCap unknown (min $${s.minMarketCapUsd} required)` };
    }
    if (mcap < s.minMarketCapUsd) {
      return { pass: false, reason: `MCap < $${s.minMarketCapUsd}` };
    }
  }
  if (s.maxMarketCapUsd > 0) {
    if (!Number.isFinite(mcap) || mcap <= 0) {
      return { pass: false, reason: `MCap unknown (max $${s.maxMarketCapUsd} set)` };
    }
    if (mcap > s.maxMarketCapUsd) {
      return { pass: false, reason: `MCap > $${s.maxMarketCapUsd}` };
    }
  }
  // LP Locked — gerçek on-chain burn analizi (lpBurnDetector tarafından doldurulur)
  // Fallback: lpBurnAnalysis yoksa eski proxy (top1 holder ≤ 30%) kullan.
  if (s.requireLpLocked) {
    const lp = token.lpBurnAnalysis;
    if (lp && lp.source !== 'unknown') {
      // Gerçek veri: burned + locked ≥ 95% kabul
      if (!lp.lpLocked) {
        const pctStr = `${(lp.burnedPct + lp.lockedPct).toFixed(0)}%`;
        return { pass: false, reason: `LP not locked (only ${pctStr} burned/locked)` };
      }
    } else {
      // Veri yok → proxy: top1 LP/token holder ≤ 30%
      const top1 = token.contract?.topHolderPct ?? 100;
      if (top1 > 30) {
        return { pass: false, reason: `LP lock unknown (top1=${top1.toFixed(0)}%)` };
      }
    }
  }
  // Sybil cluster filtresi: en kalabalık cluster oranı eşiği aşıyor mu?
  if (s.maxSybilRatio > 0 && token.sybilAnalysis && token.sybilAnalysis.source !== 'unknown') {
    if (token.sybilAnalysis.clusterRatio >= s.maxSybilRatio) {
      const pctStr = `${(token.sybilAnalysis.clusterRatio * 100).toFixed(0)}%`;
      return { pass: false, reason: `Sybil cluster ${pctStr} (≥${(s.maxSybilRatio * 100).toFixed(0)}%)` };
    }
  }
  // Aktif saatler (kanal TZ: lang=tr → Europe/Istanbul UTC+3, diğer dil → UTC)
  if (s.activeHoursEnabled) {
    const tzOffsetHours = s.lang === 'tr' ? 3 : 0;
    const nowUtcHour = new Date().getUTCHours();
    const localHour = (nowUtcHour + tzOffsetHours + 24) % 24;
    const start = s.activeHoursStart ?? 0;
    const end = s.activeHoursEnd ?? 23;
    const inWindow = start <= end
      ? (localHour >= start && localHour < end)
      : (localHour >= start || localHour < end); // gece sarmalı destek
    if (!inWindow) {
      return { pass: false, reason: `Outside active hours (${start}:00–${end}:00)` };
    }
  }
  return { pass: true };
}

// ─── Filter reason → kategori map (admin dashboard breakdown için) ───
// Eko: 10-12 sabit kategori, disk yazımı küçük.
function categorizeFilterReason(reason) {
  if (!reason) return 'other';
  const r = reason.toLowerCase();
  if (r.includes('liquidity')) return 'liquidity';
  if (r.includes('volume')) return 'volume';
  if (r.includes('too new') || r.includes('too old')) return 'age';
  if (r.includes('risk >')) return 'risk';
  if (r.includes('dex not allowed')) return 'dex';
  if (r.includes('holders <')) return 'holders';
  if (r.includes('safety score')) return 'audit';
  if (r.includes('mcap')) return 'mcap';
  if (r.includes('lp ')) return 'lp';
  if (r.includes('sybil')) return 'sybil';
  if (r.includes('active hours')) return 'hours';
  if (r.includes('pump bonding') || r.includes('pump already graduated')) return 'pump_grad';
  if (r.includes('disabled')) return 'disabled';
  return 'other';
}

function markChannelLeft(chatId, reason = 'left') {
  const id = String(chatId);
  if (!cache.channels[id]) return false;
  cache.channels[id].archivedAt = new Date().toISOString();
  cache.channels[id].leftReason = reason;
  if (cache.channels[id].settings) cache.channels[id].settings.enabled = false;
  save(cache);
  console.log(`[channels] arşivlendi (silinmedi): ${cache.channels[id].title || id} · ${reason}`);
  logEnvBackupHint();
  return true;
}

function addChannel(chat, addedBy = 'auto') {
  const id = String(chat.id);
  const existed = Boolean(cache.channels[id]);
  const prev = cache.channels[id];
  cache.channels[id] = {
    id,
    title: chat.title || chat.username || 'Bilinmiyor',
    username: chat.username || null,
    type: chat.type,
    addedAt: prev?.addedAt || new Date().toISOString(),
    addedBy,
    lastError: null,
    archivedAt: null,
    settings: prev?.settings || { ...DEFAULT_SETTINGS },
  };
  delete cache.channels[id].leftReason;
  const n = normalizeChainsSetting(cache.channels[id].settings.chains);
  if (n.changed) cache.channels[id].settings.chains = n.chains;
  if (!existed) {
    cache.channels[id].settings.chains = shouldAutoSelectSolanaOnAdd(addedBy, false)
      ? ['solana']
      : null;
  }
  save(cache);
  if (!existed) {
    console.log(`[channels] + ${cache.channels[id].title} (${id}) · ${addedBy}`);
    logEnvBackupHint();
  }
  return { added: !existed, channel: cache.channels[id] };
}

/** Bot + env + userbot ile tüm bilinen kanalları yeniden kaydeder. */
async function rediscoverAllChannels(bot, channelsMod) {
  const before = Object.keys(cache.channels).length;
  await syncFromBotApi(bot);
  try {
    const userbot = require('./userbot');
    await userbot.syncAdminChannels(channelsMod, bot);
  } catch (e) {
    console.warn('[channels] userbot sync:', e.message);
  }
  const after = Object.keys(cache.channels).length;
  return { before, after, added: Math.max(0, after - before) };
}

module.exports = {
  DEFAULT_SETTINGS,
  RISK_ORDER,
  normalizeRisk,
  categorizeFilterReason,
  logBootSummary,
  isSolanaSelected(chatId) {
    const chList = cache.channels[String(chatId)]?.settings?.chains;
    return Array.isArray(chList) && chList.includes('solana');
  },

  add: addChannel,

  remove(chatId) {
    return markChannelLeft(chatId, 'remove');
  },

  markLeft: markChannelLeft,

  setEnabled(chatId, enabled) {
    const id = String(chatId);
    if (!cache.channels[id]) return false;
    cache.channels[id].settings.enabled = enabled;
    save(cache);
    return true;
  },

  // Tek bir ayarı güncelle
  updateSetting(chatId, key, value) {
    const id = String(chatId);
    if (!cache.channels[id]) return false;
    if (!(key in DEFAULT_SETTINGS)) return false;
    if (key === 'chains') {
      const n = normalizeChainsSetting(value);
      cache.channels[id].settings.chains = n.chains;
      if (n.changed) {
        console.warn(`[channels] updateSetting chains ch=${id}: ${JSON.stringify(value)} -> ${JSON.stringify(n.chains)} (${n.reason || ''})`);
        queueChainsSanitizeNotice(id, cache.channels[id].settings.lang, n);
      }
      save(cache);
      return true;
    }
    cache.channels[id].settings[key] = value;
    save(cache);
    return true;
  },

  getSettings(chatId) {
    const id = String(chatId);
    const s = cache.channels[id]?.settings;
    if (!s) return { ...DEFAULT_SETTINGS };
    const n = normalizeChainsSetting(s.chains);
    if (n.changed) {
      s.chains = n.chains;
      save(cache);
      console.warn(`[channels] getSettings lazy-normalize ch=${id}: -> ${JSON.stringify(n.chains)} (${n.reason || ''})`);
      queueChainsSanitizeNotice(id, s.lang, n);
    }
    return s;
  },

  // Ayarları varsayılana sıfırla
  resetSettings(chatId) {
    const id = String(chatId);
    if (!cache.channels[id]) return false;
    cache.channels[id].settings = { ...DEFAULT_SETTINGS };
    const n = normalizeChainsSetting(cache.channels[id].settings.chains);
    if (n.changed) {
      cache.channels[id].settings.chains = n.chains;
    }
    save(cache);
    return true;
  },

  recordError(chatId, errMsg) {
    const id = String(chatId);
    if (!cache.channels[id]) return;
    cache.channels[id].lastError = errMsg;
    cache.channels[id].lastErrorAt = new Date().toISOString();
    save(cache);
  },

  recordSuccess(chatId) {
    const id = String(chatId);
    if (!cache.channels[id]) return;
    cache.channels[id].lastError = null;
    cache.channels[id].lastSuccessAt = new Date().toISOString();
    save(cache);
  },

  list() {
    return Object.values(cache.channels).filter((c) => !isChannelArchived(c));
  },

  listEnabled() {
    return Object.values(cache.channels).filter(
      (c) => !isChannelArchived(c) && c.settings?.enabled,
    );
  },

  count() {
    const active = Object.values(cache.channels).filter((c) => !isChannelArchived(c));
    return {
      total: active.length,
      enabled: active.filter((c) => c.settings?.enabled).length,
    };
  },

  get(chatId) {
    return cache.channels[String(chatId)] || null;
  },

  consumeChainsSanitizeNotice,
  syncFromBotApi,
  rediscoverAllChannels,
  getChannelIdsForEnv,

  tokenPassesChannelFilters,
};
