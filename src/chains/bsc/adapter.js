// ──────────────────────────────────────────────────────────────────────
// BSC Adapter — DexScreener BSC (birincil) + GeckoTerminal BSC (yedek)
//
// Bot içi ortak `Token` alanları (kanal filtreleri, kart, watch) ile uyumlu nesne üretir.
//
// ECO mod: sadece polling (60 sn), event subscription yok.
// ──────────────────────────────────────────────────────────────────────

const axios = require('axios');
const config = require('./config');
const { wrappedNative } = config;

const http = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json', 'User-Agent': 'multi-chain-scanner/bsc-adapter' },
});

// In-memory pool cache (60 sn) — aynı pool'u arka arkaya çağırınca tasarruf
const _poolCache = new Map(); // poolAddress -> { token, fetchedAt }
const POOL_CACHE_TTL_MS = 60_000;

// Watch / pair-resolve: 429 sonrası backoff + kısa önbellek (aynı turda tekrar istek azaltır)
const PAIR_BY_ADDR_CACHE_MS = 45_000;
const LIQ_SNAPSHOT_CACHE_MS = 35_000;
const _pairByAddrCache = new Map(); // poolLower -> { pair, at }
const _liqSnapCache = new Map(); // poolLower -> { data, at }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function is429Error(e) {
  const st = e?.response?.status;
  return st === 429 || /429|Too Many Requests/i.test(String(e?.message || ''));
}
let _lastPair429LogAt = 0;

// Son discovery sonucu (yedek fallback için)
let _lastDiscoveryAt = 0;
let _lastDiscoveryPools = [];

// ─────────────────────────────────────────────────────────────
// 1. DISCOVERY — DexScreener BSC pairs (birincil)
// ─────────────────────────────────────────────────────────────
// DexScreener "latest pairs" endpoint: 60 sn'de yenilenir, ECO uyumlu.
// /token-profiles/latest/v1 ve /token-boosts/latest/v1 endpoint'leri yeni token'lar
// için en hızlı sinyaller. Sonra her token için /tokens/v1/bsc/<addr> ile detay alınır.
async function fetchPoolsFromDexScreener() {
  // Yöntem: DexScreener "search" + "tokens" hybrid
  // En sağlam yol: token-profiles/latest tüm chain'leri döner, BSC'ye filtrele
  try {
    const { data } = await http.get(
      `${config.api.dexScreenerBase}/token-profiles/latest/v1`,
    );
    const profiles = Array.isArray(data) ? data : (data?.data || []);
    const bscProfiles = profiles.filter((p) => p.chainId === 'bsc');
    if (bscProfiles.length === 0) return [];

    // Her token için pair detayını çek (batch)
    const tokenAddrs = bscProfiles.slice(0, 30).map((p) => p.tokenAddress);
    return await _fetchPairsByTokens(tokenAddrs);
  } catch (e) {
    console.warn('[bsc/adapter] DexScreener profiles fail:', e.message);
    return null; // null → fallback'e geç
  }
}

async function _fetchPairsByTokens(tokenAddrs) {
  if (!tokenAddrs || tokenAddrs.length === 0) return [];
  // DexScreener /tokens/v1/bsc/<addr1,addr2,...> max 30 token
  const joined = tokenAddrs.slice(0, 30).join(',');
  try {
    const { data } = await http.get(
      `${config.api.dexScreenerBase}/tokens/v1/bsc/${joined}`,
    );
    const pairs = Array.isArray(data) ? data : (data?.pairs || []);
    return pairs.filter((p) => p.chainId === 'bsc');
  } catch (e) {
    console.warn('[bsc/adapter] DexScreener tokens batch fail:', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DISCOVERY FALLBACK — GeckoTerminal BSC new_pools
// ─────────────────────────────────────────────────────────────
async function fetchPoolsFromGecko() {
  try {
    const { data } = await http.get(
      `${config.api.geckoTerminalBase}/networks/bsc/new_pools?page=1`,
    );
    const pools = data?.data || [];
    // GeckoTerminal şemasını DexScreener pair şemasına dönüştür
    return pools.map(_geckoPoolToDsPair).filter(Boolean);
  } catch (e) {
    console.warn('[bsc/adapter] Gecko BSC new_pools fail:', e.message);
    return [];
  }
}

function _geckoPoolToDsPair(pool) {
  const a = pool.attributes || {};
  const baseRel = pool.relationships?.base_token?.data?.id || '';
  const baseAddr = baseRel.replace(/^bsc_/, '');
  const quoteRel = pool.relationships?.quote_token?.data?.id || '';
  const quoteAddr = quoteRel.replace(/^bsc_/, '');
  if (!baseAddr) return null;
  const dexId = pool.relationships?.dex?.data?.id || 'pancakeswap';
  const symbol = (a.name || '').split(' / ')[0] || '?';
  // DexScreener pair şeması taklit
  return {
    chainId: 'bsc',
    dexId,
    url: `https://dexscreener.com/bsc/${a.address}`,
    pairAddress: a.address,
    baseToken: {
      address: baseAddr,
      name: symbol,
      symbol,
    },
    quoteToken: {
      address: quoteAddr,
      name: (a.name || '').split(' / ')[1] || 'WBNB',
      symbol: (a.name || '').split(' / ')[1] || 'WBNB',
    },
    priceUsd: a.base_token_price_usd || '0',
    fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
    marketCap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : null,
    liquidity: {
      usd: parseFloat(a.reserve_in_usd) || 0,
    },
    volume: {
      h24: parseFloat(a.volume_usd?.h24) || 0,
      h1: parseFloat(a.volume_usd?.h1) || 0,
    },
    priceChange: {
      h1: parseFloat(a.price_change_percentage?.h1) || 0,
      h24: parseFloat(a.price_change_percentage?.h24) || 0,
    },
    txns: {
      h24: {
        buys: a.transactions?.h24?.buys || 0,
        sells: a.transactions?.h24?.sells || 0,
      },
      h1: {
        buys: a.transactions?.h1?.buys || 0,
        sells: a.transactions?.h1?.sells || 0,
      },
    },
    pairCreatedAt: a.pool_created_at ? new Date(a.pool_created_at).getTime() : null,
  };
}

// ─────────────────────────────────────────────────────────────
// 3. HİBRİT DISCOVERY — primary + fallback
// ─────────────────────────────────────────────────────────────
async function fetchPoolsHybrid() {
  // Birincil: DexScreener
  let pairs = await fetchPoolsFromDexScreener();
  if (!pairs || pairs.length === 0) {
    console.log('[bsc/adapter] DexScreener boş/başarısız → GeckoTerminal fallback');
    pairs = await fetchPoolsFromGecko();
  }
  // Önbelleğe yaz
  _lastDiscoveryAt = Date.now();
  _lastDiscoveryPools = pairs || [];
  return pairs || [];
}

// ─────────────────────────────────────────────────────────────
// 4. NORMALIZE — DexScreener pair → mevcut Token şeması
// ─────────────────────────────────────────────────────────────
function normalizePair(pair) {
  if (!pair || !pair.baseToken) return null;

  // WBNB / native quote ise tersleyebiliriz — şimdilik baseToken'ı al
  const tokenAddress = pair.baseToken.address;
  const poolAddress = pair.pairAddress;

  let ageMinutes = null;
  if (pair.pairCreatedAt) {
    ageMinutes = Math.round((Date.now() - pair.pairCreatedAt) / 60_000);
  }

  return {
    // Ortak bot şeması (kanal / audit / kart)
    chain: 'bsc',
    poolId: `bsc_${poolAddress}`,
    poolAddress,
    poolName: `${pair.baseToken.symbol} / ${pair.quoteToken?.symbol || 'WBNB'}`,
    dex: (pair.dexId || 'pancakeswap').toLowerCase(),
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    ageMinutes,

    tokenAddress,
    tokenName: pair.baseToken.name || pair.baseToken.symbol || 'Bilinmiyor',
    tokenSymbol: (pair.baseToken.symbol || '?').toUpperCase(),
    tokenImage: pair.info?.imageUrl || null,
    decimals: null, // BscScan'den ayrıca çekilebilir
    totalSupply: null,

    priceUsd: parseFloat(pair.priceUsd) || 0,
    fdvUsd: parseFloat(pair.fdv) || 0,
    marketCapUsd: parseFloat(pair.marketCap) || null,

    liquidityUsd: parseFloat(pair.liquidity?.usd) || 0,

    volume24h: parseFloat(pair.volume?.h24) || 0,
    volume1h: parseFloat(pair.volume?.h1) || 0,
    priceChange1h: parseFloat(pair.priceChange?.h1) || 0,
    priceChange24h: parseFloat(pair.priceChange?.h24) || 0,

    buys24h: pair.txns?.h24?.buys || 0,
    sells24h: pair.txns?.h24?.sells || 0,
    buys1h: pair.txns?.h1?.buys || 0,
    sells1h: pair.txns?.h1?.sells || 0,
    buys5m: pair.txns?.m5?.buys || 0,
    sells5m: pair.txns?.m5?.sells || 0,
    buyers24h: 0, // DexScreener buyer/seller ayrımı vermiyor
    sellers24h: 0,

    dexScreener: {
      url: pair.url || `https://dexscreener.com/bsc/${poolAddress}`,
      pairAddress: poolAddress,
      info: pair.info || null,
    },

    contract: null, // BscScan risk taramasında doldurulacak
  };
}

// ─────────────────────────────────────────────────────────────
// 5. ANA FONKSİYON — scanNewTokens (registry `chains/bsc` arayüzü)
// ─────────────────────────────────────────────────────────────
async function scanNewTokens({ minLiquidityUsd = 0, limit = 30 } = {}) {
  const pairs = await fetchPoolsHybrid();
  const enriched = [];

  for (const pair of pairs.slice(0, limit)) {
    const token = normalizePair(pair);
    if (!token) continue;
    if (token.liquidityUsd < minLiquidityUsd) continue;
    enriched.push(token);

    // Cache
    if (token.poolAddress) {
      _poolCache.set(token.poolAddress, { token, fetchedAt: Date.now() });
    }
  }

  return enriched;
}

// ─────────────────────────────────────────────────────────────
// 6. TOKEN / POOL RESOLVE — manuel CA inputu
// ─────────────────────────────────────────────────────────────
async function fetchPairByPoolAddress(poolAddr) {
  if (!poolAddr) return null;
  const key = String(poolAddr).toLowerCase();
  const hit = _pairByAddrCache.get(key);
  if (hit && Date.now() - hit.at < PAIR_BY_ADDR_CACHE_MS) return hit.pair;

  let lastErr = null;
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/latest/dex/pairs/bsc/${poolAddr}`,
      );
      const pairs = data?.pairs || [];
      const pair = pairs[0] || null;
      _pairByAddrCache.set(key, { pair, at: Date.now() });
      return pair;
    } catch (e) {
      lastErr = e;
      if (is429Error(e)) {
        const h = e.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        const backoff = Math.min(10_000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 700) * (2 ** att));
        await sleep(backoff);
        continue;
      }
      console.warn('[bsc/adapter] pair-by-address fail:', e.message);
      break;
    }
  }
  if (lastErr && is429Error(lastErr)) {
    if (Date.now() - _lastPair429LogAt > 25_000) {
      console.warn('[bsc/adapter] pair-by-address: DexScreener 429 after retries — falling back to Gecko if possible');
      _lastPair429LogAt = Date.now();
    }
  } else if (lastErr) {
    console.warn('[bsc/adapter] pair-by-address fail:', lastErr.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// fetchPoolLiquidity — watch loop (rüg/scam); dönüş: { liquidityUsd, priceUsd, volume24h, buys1h, sells1h } | null
// ─────────────────────────────────────────────────────────────
async function fetchPoolLiquidity(poolAddress) {
  if (!poolAddress) return null;
  const key = String(poolAddress).toLowerCase();
  const snap = _liqSnapCache.get(key);
  if (snap && Date.now() - snap.at < LIQ_SNAPSHOT_CACHE_MS) return snap.data;

  // Birincil: DexScreener pair detail (fetchPairByPoolAddress içinde 429 backoff + cache)
  try {
    const pair = await fetchPairByPoolAddress(poolAddress);
    if (pair) {
      const out = {
        liquidityUsd: parseFloat(pair.liquidity?.usd) || 0,
        priceUsd: parseFloat(pair.priceUsd) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        volume1h: parseFloat(pair.volume?.h1) || 0,
        priceChange1h: parseFloat(pair.priceChange?.h1) || 0,
        buys1h: pair.txns?.h1?.buys || 0,
        sells1h: pair.txns?.h1?.sells || 0,
        buys5m: pair.txns?.m5?.buys || 0,
        sells5m: pair.txns?.m5?.sells || 0,
      };
      _liqSnapCache.set(key, { data: out, at: Date.now() });
      return out;
    }
  } catch (_) { /* düşer */ }

  // Yedek: GeckoTerminal BSC pool detail (+ 429 backoff)
  let lastGeckoErr = null;
  for (let att = 0; att < 3; att++) {
    try {
      const url = `${config.api.geckoTerminalBase}/networks/bsc/pools/${poolAddress}`;
      const { data } = await http.get(url);
      const a = data?.data?.attributes;
      if (!a) return null;
      const out = {
        liquidityUsd: parseFloat(a.reserve_in_usd) || 0,
        priceUsd: parseFloat(a.base_token_price_usd) || 0,
        volume24h: parseFloat(a.volume_usd?.h24) || 0,
        buys1h: a.transactions?.h1?.buys || 0,
        sells1h: a.transactions?.h1?.sells || 0,
      };
      _liqSnapCache.set(key, { data: out, at: Date.now() });
      return out;
    } catch (err) {
      lastGeckoErr = err;
      if (is429Error(err)) {
        const h = err.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        const backoff = Math.min(10_000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 700) * (2 ** att));
        await sleep(backoff);
        continue;
      }
      const status = err?.response?.status;
      if (status && status !== 429 && process.env.BSC_DEBUG === '1') {
        console.warn(`[bsc/adapter] fetchPoolLiquidity fail (${poolAddress}): ${status} ${err.message}`);
      }
      break;
    }
  }
  if (lastGeckoErr && !is429Error(lastGeckoErr) && process.env.BSC_DEBUG === '1') {
    console.warn(`[bsc/adapter] fetchPoolLiquidity gecko fail (${poolAddress}):`, lastGeckoErr.message);
  }
  return null;
}

async function fetchTopPairForToken(tokenAddr) {
  let lastErr = null;
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/tokens/v1/bsc/${tokenAddr}`,
      );
      const pairs = Array.isArray(data) ? data : (data?.pairs || []);
      const bscPairs = pairs.filter((p) => p.chainId === 'bsc');
      bscPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      return bscPairs[0] || null;
    } catch (e) {
      lastErr = e;
      if (is429Error(e)) {
        const h = e.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        const backoff = Math.min(10_000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 700) * (2 ** att));
        await sleep(backoff);
        continue;
      }
      console.warn('[bsc/adapter] top-pair-for-token fail:', e.message);
      break;
    }
  }
  if (lastErr && !is429Error(lastErr)) console.warn('[bsc/adapter] top-pair-for-token fail:', lastErr.message);
  return null;
}

async function resolveTokenFromInput(input) {
  if (!input) return null;
  const addr = extractAddress(input);
  if (!addr) return null;

  // Pool adresi mi token adresi mi? Önce pool olarak dene, olmazsa token
  let pair = await fetchPairByPoolAddress(addr);
  if (!pair) pair = await fetchTopPairForToken(addr);
  if (!pair) return null;

  return normalizePair(pair);
}

// ─────────────────────────────────────────────────────────────
// 7. ADRES EXTRACT — 0x{40-hex}
// ─────────────────────────────────────────────────────────────
function extractAddress(text) {
  if (!text || typeof text !== 'string') return null;
  // URL'lerden de çekebilelim: bscscan.com/token/0x... veya dexscreener/bsc/0x...
  const m = text.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

module.exports = {
  scanNewTokens,
  resolveTokenFromInput,
  extractAddress,
  fetchPoolsHybrid,
  fetchPairByPoolAddress,
  fetchTopPairForToken,
  fetchPoolLiquidity,
  normalizePair,
};
