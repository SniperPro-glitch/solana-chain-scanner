// Sybil / Wallet Cluster Detector
// Bir pool'un ilk alıcılarını analiz eder. Aynı kaynaktan beslenen cüzdanlar
// "cluster" olarak işaretlenir → rug / pump-and-dump sinyali.
//
// Mantık:
//   1) Pool'a gelen ilk N swap'ı çek → alıcı cüzdanları topla
//   2) Her alıcının TON cüzdanı için ilk işlemleri (initial funding) çek
//   3) Aynı "funder" adresinden TON alanları say
//   4) clusterRatio = en kalabalık cluster büyüklüğü / N
//
// Veri kaynağı: TonAPI (ücretsiz, anonim)
// Maliyet/token: ~5-7 API çağrısı (cache ile düşer)

const { http, TONAPI_BASE, toRaw } = require('./dexAdapters/_common');

// ─────────────────────────────────────────────────────────────
// Cache (ECO mod): 30dk
// ─────────────────────────────────────────────────────────────
const poolCache = new Map();   // poolAddr -> { result, ts }
const funderCache = new Map(); // walletAddr -> { funder, ts }
const TTL_MS = 30 * 60 * 1000;

function fromCache(map, key) {
  const k = toRaw(key);
  const e = map.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) { map.delete(k); return null; }
  return e;
}

function toCache(map, key, value) {
  map.set(toRaw(key), { ...value, ts: Date.now() });
}

// Bilinen "altyapı" adresleri — bunlardan TON alan cüzdanlar kümeleme dışı tutulur
// (DEX router'ları, fee receiver'lar, vb. her cüzdana TON gönderebilir)
const INFRA_ADDRESSES_RAW = new Set([
  // STON.fi router v1/v2
  '0:779dcc815138d9500e449c5291e7f12738c23d575b5310000f6a253bd607384e',
  // DeDust factory
  '0:5f0564fb5f60478f0db5703a73ce1d168d4d4d6da6de76d3622b4b9098edf980',
  // Common burn (zero)
  '0:0000000000000000000000000000000000000000000000000000000000000000',
].map((a) => a.toLowerCase()));

// ─────────────────────────────────────────────────────────────
// Pool'a gelen ilk N swap'tan alıcı cüzdanlarını çek
// ─────────────────────────────────────────────────────────────
async function fetchPoolEarlyBuyers(poolAddress, limit = 10) {
  try {
    const { data } = await http.get(
      `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(poolAddress)}/transactions`,
      { params: { limit: 50 } }, // çok tx çek, içinden swap'ları süzeceğiz
    );
    const txs = data?.transactions || [];

    // TON pool'larında "swap" tx'i in_msg ile kullanıcıdan gelir.
    // Source = end-user wallet. Pool'un kendisi out_msg gönderir.
    const buyers = [];
    const seen = new Set();
    // Tx'ler genelde "en yeni" sırada gelir, ters çevirip eskiden başla
    const reversed = [...txs].reverse();
    for (const tx of reversed) {
      const src = tx?.in_msg?.source?.address;
      if (!src) continue;
      const srcRaw = toRaw(src);
      if (INFRA_ADDRESSES_RAW.has(srcRaw)) continue;
      if (seen.has(srcRaw)) continue;
      seen.add(srcRaw);
      buyers.push(src);
      if (buyers.length >= limit) break;
    }
    return buyers;
  } catch (err) {
    if (err.response?.status === 404) return [];
    console.warn(`[sybil] pool buyers fetch hata (${poolAddress}):`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Bir cüzdanın ilk TON kaynağını (initial funder) bul
// ─────────────────────────────────────────────────────────────
async function findInitialFunder(walletAddress) {
  const cached = fromCache(funderCache, walletAddress);
  if (cached) return cached.funder;

  try {
    // Cüzdanın TUM tx'lerini al (en eski 50)
    const { data } = await http.get(
      `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(walletAddress)}/transactions`,
      { params: { limit: 50 } },
    );
    const txs = data?.transactions || [];
    if (txs.length === 0) {
      toCache(funderCache, walletAddress, { funder: null });
      return null;
    }
    // En eski tx (genelde son indeksde — TonAPI yeniden eski sıralayabilir)
    const sortedByLt = [...txs].sort((a, b) => Number(BigInt(a.lt) - BigInt(b.lt)));

    // İlk gelen in_msg (incoming TON transfer) = initial funder
    for (const tx of sortedByLt) {
      const src = tx?.in_msg?.source?.address;
      const value = tx?.in_msg?.value;
      if (src && value && Number(value) > 0) {
        const srcRaw = toRaw(src);
        if (!INFRA_ADDRESSES_RAW.has(srcRaw)) {
          toCache(funderCache, walletAddress, { funder: srcRaw });
          return srcRaw;
        }
      }
    }
    toCache(funderCache, walletAddress, { funder: null });
    return null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`[sybil] funder fetch hata (${walletAddress}):`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Ana fonksiyon: pool sybil analizi
// ─────────────────────────────────────────────────────────────
/**
 * @param {string} poolAddress
 * @param {number} sampleSize - kaç ilk alıcı incelensin (default 8)
 * @returns {Promise<{
 *   buyersAnalyzed:number,
 *   largestClusterSize:number,
 *   clusterRatio:number,        // 0-1, en büyük cluster / sampleSize
 *   sharedFunder:string|null,   // varsa ortak funder adresi (raw)
 *   sybilDetected:boolean,      // clusterRatio >= 0.5
 *   source:'cache'|'fresh'|'unknown'
 * }>}
 */
async function analyzePool(poolAddress, sampleSize = 8) {
  if (!poolAddress) {
    return { buyersAnalyzed: 0, largestClusterSize: 0, clusterRatio: 0, sharedFunder: null, sybilDetected: false, source: 'unknown' };
  }

  const cached = fromCache(poolCache, poolAddress);
  if (cached) return { ...cached.result, source: 'cache' };

  const buyers = await fetchPoolEarlyBuyers(poolAddress, sampleSize);
  if (buyers.length < 3) {
    // Yetersiz veri → karar verme
    const unknown = { buyersAnalyzed: buyers.length, largestClusterSize: 0, clusterRatio: 0, sharedFunder: null, sybilDetected: false };
    toCache(poolCache, poolAddress, { result: unknown });
    return { ...unknown, source: 'unknown' };
  }

  // Her alıcının funder'ını paralel olarak bul (rate limit'e karşı küçük gecikme)
  const funders = [];
  for (const w of buyers) {
    const f = await findInitialFunder(w);
    funders.push(f);
    // Nazik bekleme — TonAPI 1 RPS limiti
    await new Promise((r) => setTimeout(r, 250));
  }

  // Cluster sayımı (null funder'ları sayma)
  const counts = new Map();
  for (const f of funders) {
    if (!f) continue;
    counts.set(f, (counts.get(f) || 0) + 1);
  }

  let largestClusterSize = 0;
  let sharedFunder = null;
  for (const [f, c] of counts.entries()) {
    if (c > largestClusterSize) {
      largestClusterSize = c;
      sharedFunder = f;
    }
  }

  // Yalnız bir adet sayım = cluster değil
  if (largestClusterSize < 2) {
    largestClusterSize = 0;
    sharedFunder = null;
  }

  const clusterRatio = buyers.length > 0 ? largestClusterSize / buyers.length : 0;
  const sybilDetected = clusterRatio >= 0.5; // %50+ ortak funder → sybil

  const result = {
    buyersAnalyzed: buyers.length,
    largestClusterSize,
    clusterRatio,
    sharedFunder,
    sybilDetected,
  };
  toCache(poolCache, poolAddress, { result });
  return { ...result, source: 'fresh' };
}

function clearCache() {
  poolCache.clear();
  funderCache.clear();
}

module.exports = {
  analyzePool,
  findInitialFunder,
  fetchPoolEarlyBuyers,
  clearCache,
};
