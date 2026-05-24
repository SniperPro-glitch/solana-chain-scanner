// LP Burn / Lock Detector
// TON DEX pool'larında (DeDust v2 / STON.fi v2.2) LP token'ların ne kadarının
// "burn" ya da "lock" adreslerine gittiğini hesaplar.
//
// Veri kaynağı: TonAPI (ücretsiz, 1 RPS anonim).
// Çağrı/token: 1-2 (jetton holders).
//
// Mantık: Pool kontratının kendisi LP jetton master'ı (DeDust v2 & STON.fi v2.2'de bu doğru).
// /v2/jettons/{poolAddr}/holders ile en büyük holder'ların adreslerine bakarız.
// Burn / lock adresine giden LP miktarının yüzdesini döneriz.

const { http, TONAPI_BASE, toRaw } = require('./dexAdapters/_common');

// ─────────────────────────────────────────────────────────────
// Bilinen burn ve lock adresleri (raw 0:hex format)
// ─────────────────────────────────────────────────────────────

// Burn adresleri — LP buralara giderse kalıcı imha
const BURN_ADDRESSES_RAW = new Set([
  // Zero address — TON null sink
  '0:0000000000000000000000000000000000000000000000000000000000000000',
  // System addr (-1 workchain alternatif)
  '-1:0000000000000000000000000000000000000000000000000000000000000000',
].map((a) => a.toLowerCase()));

// Bilinen lock kontratları (whitelist) — kullanıcı bunlara güveniyorsa LP kilitli sayılır
// Not: TON ekosisteminde standartlaşmış bir "ton lock" servisi henüz yok.
// İleride eklenebilir (TonLock, SafePad gibi servisler çıktığında).
const LOCK_CONTRACTS_RAW = new Set([
  // Şimdilik boş — burn'e odaklanıyoruz
].map((a) => a.toLowerCase()));

function isBurnAddress(addr) {
  if (!addr) return false;
  const raw = toRaw(addr);
  return BURN_ADDRESSES_RAW.has(raw);
}

function isLockAddress(addr) {
  if (!addr) return false;
  const raw = toRaw(addr);
  return LOCK_CONTRACTS_RAW.has(raw);
}

// ─────────────────────────────────────────────────────────────
// Cache (ECO mod): 30dk içinde tekrar sorgulamayız
// ─────────────────────────────────────────────────────────────
const cache = new Map(); // poolAddrRaw -> { result, ts }
const CACHE_TTL_MS = 30 * 60 * 1000;

function fromCache(poolAddr) {
  const key = toRaw(poolAddr);
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return e.result;
}

function toCache(poolAddr, result) {
  const key = toRaw(poolAddr);
  cache.set(key, { result, ts: Date.now() });
}

// ─────────────────────────────────────────────────────────────
// Pool LP token holders'ı çek
// ─────────────────────────────────────────────────────────────
async function fetchLpHolders(poolAddress, limit = 20) {
  try {
    const { data } = await http.get(
      `${TONAPI_BASE}/jettons/${encodeURIComponent(poolAddress)}/holders`,
      { params: { limit } },
    );
    // TonAPI yanıt: { addresses: [{ address, owner: { address }, balance }], total }
    return {
      total: BigInt(data?.total || 0),
      addresses: (data?.addresses || []).map((a) => ({
        address: a.address || a.owner?.address || null,
        balance: BigInt(a.balance || 0),
      })),
    };
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`[lpBurn] holders fetch hata (${poolAddress}):`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Ana fonksiyon: pool LP'sinin ne kadarı burn / lock'ta?
// ─────────────────────────────────────────────────────────────
/**
 * @param {string} poolAddress - DEX pool kontratı (= LP jetton master)
 * @returns {Promise<{burnedPct:number, lockedPct:number, lpLocked:boolean, top1Pct:number, source:'cache'|'fresh'|'unknown'}>}
 *   burnedPct + lockedPct = "kalıcı çıkarılmış" toplam yüzde.
 *   lpLocked = (burnedPct + lockedPct) >= 95
 *   top1Pct  = en büyük holder'ın payı (ek bilgi)
 *   source   = 'unknown' ise veri çekilemedi, filtre olarak kullanma
 */
async function analyzePool(poolAddress) {
  if (!poolAddress) {
    return { burnedPct: 0, lockedPct: 0, lpLocked: false, top1Pct: 0, source: 'unknown' };
  }

  const cached = fromCache(poolAddress);
  if (cached) return { ...cached, source: 'cache' };

  const data = await fetchLpHolders(poolAddress, 20);
  if (!data || data.total === 0n) {
    // Veri yok ya da pool henüz LP mint etmemiş → bilinmiyor
    const unknown = { burnedPct: 0, lockedPct: 0, lpLocked: false, top1Pct: 0 };
    toCache(poolAddress, unknown);
    return { ...unknown, source: 'unknown' };
  }

  let burnedRaw = 0n;
  let lockedRaw = 0n;
  let top1 = 0n;

  for (const h of data.addresses) {
    if (h.balance > top1) top1 = h.balance;
    if (isBurnAddress(h.address)) burnedRaw += h.balance;
    else if (isLockAddress(h.address)) lockedRaw += h.balance;
  }

  // BigInt → percentage (0-100, 2 decimal)
  const pct = (numerator) => {
    if (data.total === 0n) return 0;
    // %0.01 hassasiyet
    const x = Number((numerator * 10000n) / data.total) / 100;
    return Math.max(0, Math.min(100, x));
  };

  const burnedPct = pct(burnedRaw);
  const lockedPct = pct(lockedRaw);
  const top1Pct = pct(top1);

  // %95+ kalıcı çıkarılmış → "LP locked" kabul
  const lpLocked = (burnedPct + lockedPct) >= 95;

  const result = { burnedPct, lockedPct, lpLocked, top1Pct };
  toCache(poolAddress, result);
  return { ...result, source: 'fresh' };
}

// Cache'i temizle (test için)
function clearCache() {
  cache.clear();
}

module.exports = {
  analyzePool,
  isBurnAddress,
  isLockAddress,
  clearCache,
  BURN_ADDRESSES_RAW,
  LOCK_CONTRACTS_RAW,
};
