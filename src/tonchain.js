// TON blockchain'den direkt pool durumu okur — DEX-bağımsız.
// Mantık: Bütün TON DEX pool'ları (DeDust, STON.fi v1/v2, vb.) likiditenin
// TON tarafını kontrat balance'ında tutar. Pool aktif değilse status != 'active'.
// Likidite USD = balance(TON) * 2 * TON/USD fiyatı.

const axios = require('axios');

const TONAPI_BASE = 'https://tonapi.io/v2';
const http = axios.create({ timeout: 15000 });

// TON/USD fiyat cache (5 dk TTL)
let tonUsdCache = { price: 0, fetchedAt: 0 };
const PRICE_TTL_MS = 5 * 60 * 1000;

async function getTonUsdPrice() {
  const now = Date.now();
  if (tonUsdCache.price > 0 && (now - tonUsdCache.fetchedAt) < PRICE_TTL_MS) {
    return tonUsdCache.price;
  }
  // Birincil kaynak: CoinGecko
  try {
    const { data } = await http.get(
      'https://api.coingecko.com/api/v3/simple/price',
      { params: { ids: 'the-open-network', vs_currencies: 'usd' } },
    );
    const price = parseFloat(data?.['the-open-network']?.usd);
    if (price > 0) {
      tonUsdCache = { price, fetchedAt: now };
      return price;
    }
  } catch (_) { /* fallback */ }

  // Fallback: TonAPI rates
  try {
    const { data } = await http.get(`${TONAPI_BASE}/rates`, {
      params: { tokens: 'ton', currencies: 'usd' },
    });
    const price = parseFloat(data?.rates?.TON?.prices?.USD);
    if (price > 0) {
      tonUsdCache = { price, fetchedAt: now };
      return price;
    }
  } catch (_) { /* fallback */ }

  // Son çare: cache (boşsa makul varsayılan)
  return tonUsdCache.price > 0 ? tonUsdCache.price : 2.5;
}

// Lowercase/karma case EQ/UQ adreslerinin doğru case'ini DexScreener'dan alır.
// TonAPI checksum dahil case-sensitive validation yapıyor; lowercase'i reddediyor.
async function normalizeAddress(addr) {
  if (!addr) return addr;
  // 0:hex64 raw format zaten case-insensitive, dokunma
  if (/^0:[a-fA-F0-9]{64}$/.test(addr)) return addr;
  // EQ/UQ format: hem lowercase hem karma case'i destekle
  // Önce DexScreener'a sor (her case'i kabul ediyor, doğru case'i dönüyor)
  try {
    const { data } = await http.get(`https://api.dexscreener.com/latest/dex/pairs/ton/${addr}`);
    const pair = data?.pairs?.[0] || data?.pair;
    if (pair?.pairAddress) return pair.pairAddress;
  } catch (_) { /* fallback */ }
  return addr; // Olmazsa orijinali gönder, TonAPI ne derse o
}

/**
 * TON blockchain'den pool'un durumunu ve likiditesini çek.
 * @param {string} poolAddress - Pool kontrat adresi (EQ.../UQ.../0:hex)
 * @returns {Promise<{active:boolean, removed:boolean, liquidityUsd:number, balanceTon:number}|null>}
 */
async function getPoolState(poolAddress) {
  const normalized = await normalizeAddress(poolAddress);
  try {
    const { data } = await http.get(`${TONAPI_BASE}/accounts/${encodeURIComponent(normalized)}`);
    if (!data) return null;

    const status = data.status; // 'active' | 'frozen' | 'uninit' | 'nonexist'
    const balanceNano = parseInt(data.balance || 0, 10);
    const balanceTon = balanceNano / 1e9;

    // Pool inaktifse → rug
    if (status !== 'active') {
      return {
        active: false,
        removed: true,
        liquidityUsd: 0,
        balanceTon: 0,
        status,
      };
    }

    // Aktif pool: balance * 2 * TON/USD
    const tonUsd = await getTonUsdPrice();
    const liquidityUsd = balanceTon * 2 * tonUsd;

    return {
      active: true,
      removed: false,
      liquidityUsd,
      balanceTon,
      status,
      tonUsd,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      // Hesap hiç var olmamış → silinmiş kabul
      return { active: false, removed: true, liquidityUsd: 0, balanceTon: 0, status: 'nonexist' };
    }
    console.warn(`TonAPI pool state hatası (${poolAddress}):`, err.message);
    return null; // Geçici hata — caller "bilinmiyor" olarak ele alacak
  }
}

/**
 * Pool'un son aktivite zamanını ve son N işlemini döndürür.
 * Aktivite kontrolü için kullanılır (rug detection: işlem yoksa daha şüpheli).
 */
async function getPoolActivity(poolAddress, limit = 5) {
  try {
    const { data } = await http.get(
      `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(poolAddress)}/transactions`,
      { params: { limit } },
    );
    const txs = data?.transactions || [];
    return {
      lastActivityUtime: txs[0]?.utime || 0,
      txCount: txs.length,
      successCount: txs.filter((t) => t.success && !t.aborted).length,
    };
  } catch (err) {
    return { lastActivityUtime: 0, txCount: 0, successCount: 0 };
  }
}

module.exports = { getPoolState, getPoolActivity, getTonUsdPrice, normalizeAddress };
