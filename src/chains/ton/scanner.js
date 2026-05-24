// TON zinciri — yeni havuz keşfi + zenginleştirme (`src/chains/ton/`).
// GeckoTerminal + TonAPI / poolDiscovery hibrit akışı.

const axios = require('axios');

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const DS_BASE = 'https://api.dexscreener.com';
const TONAPI_BASE = 'https://tonapi.io/v2';

const http = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json', 'User-Agent': 'ton-chain-scanner/0.2' },
});

async function fetchNewPools(page = 1) {
  const url = `${GT_BASE}/networks/ton/new_pools?page=${page}`;
  const { data } = await http.get(url);
  return data?.data || [];
}

async function fetchNewPoolsFromChain() {
  const { getInstance } = require('../../poolDiscovery');
  const discovery = getInstance();
  if (!discovery.started) discovery.start();

  const entries = discovery.drain(50);
  if (entries.length === 0) return [];

  const pools = [];
  for (const e of entries) {
    if (!e.tokenAddress) continue;
    let gtPool = null;
    try {
      gtPool = await fetchPoolByAddress(e.poolAddress);
    } catch (_) { /* yoksay */ }

    if (gtPool) {
      gtPool._discoverySource = e.dex;
      pools.push(gtPool);
      continue;
    }

    pools.push({
      id: `${e.dex}_${e.poolAddress}`,
      attributes: {
        address: e.poolAddress,
        name: '?',
        pool_created_at: new Date(e.detectedAt).toISOString(),
        base_token_price_usd: '0',
        fdv_usd: '0',
        reserve_in_usd: '0',
        volume_usd: { h24: 0, h1: 0 },
        price_change_percentage: { h1: 0, h24: 0 },
        transactions: { h24: { buys: 0, sells: 0, buyers: 0, sellers: 0 } },
      },
      relationships: {
        base_token: { data: { id: `ton_${e.tokenAddress}` } },
        dex: { data: { id: e.dex } },
      },
      _discoverySource: e.dex,
      _onChainFresh: true,
    });
  }
  return pools;
}

async function fetchNewPoolsHybrid() {
  const source = (process.env.DISCOVERY_SOURCE || 'gecko').toLowerCase();
  if (source === 'tonchain') {
    const onchain = await fetchNewPoolsFromChain();
    if (onchain.length > 0) return onchain;
    try { return await fetchNewPools(1); } catch (_) { return []; }
  }
  return await fetchNewPools(1);
}

async function fetchTokenDetail(tokenAddress) {
  try {
    const url = `${GT_BASE}/networks/ton/tokens/${tokenAddress}`;
    const { data } = await http.get(url);
    return data?.data?.attributes || null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`Token detay hatası (${tokenAddress}):`, err.message);
    return null;
  }
}

async function fetchJettonInfo(tokenAddress) {
  try {
    const [info, holders] = await Promise.all([
      http.get(`${TONAPI_BASE}/jettons/${tokenAddress}`).then((r) => r.data).catch(() => null),
      http.get(`${TONAPI_BASE}/jettons/${tokenAddress}/holders?limit=10`).then((r) => r.data).catch(() => null),
    ]);
    if (!info) return null;

    const totalSupply = parseFloat(info.total_supply) || 0;
    let top10Pct = null;
    let topHolderPct = null;
    if (holders?.addresses && totalSupply > 0) {
      const top10Sum = holders.addresses
        .slice(0, 10)
        .reduce((s, h) => s + (parseFloat(h.balance) || 0), 0);
      top10Pct = (top10Sum / totalSupply) * 100;
      const topBal = parseFloat(holders.addresses[0]?.balance) || 0;
      topHolderPct = (topBal / totalSupply) * 100;
    }

    return {
      mintable: info.mintable === true,
      verification: info.verification || 'none',
      holdersCount: info.holders_count || 0,
      totalSupply,
      top10Pct,
      topHolderPct,
      adminAddress: info.admin?.address || null,
    };
  } catch (err) {
    console.warn(`Tonapi jetton hatası (${tokenAddress}):`, err.message);
    return null;
  }
}

async function fetchDexScreener(tokenAddress) {
  try {
    const url = `${DS_BASE}/tokens/v1/ton/${tokenAddress}`;
    const { data } = await http.get(url);
    if (!Array.isArray(data) || data.length === 0) return null;
    return data.sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    )[0];
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`DexScreener hatası (${tokenAddress}):`, err.message);
    return null;
  }
}

function normalize(pool, tokenDetail, dsData, jettonInfo) {
  const a = pool.attributes || {};
  const baseTokenRel = pool.relationships?.base_token?.data?.id || '';
  const baseTokenAddress = baseTokenRel.replace(/^ton_/, '');
  const dexId = pool.relationships?.dex?.data?.id || 'unknown';

  let ageMinutes = null;
  if (a.pool_created_at) {
    const created = new Date(a.pool_created_at).getTime();
    if (!isNaN(created)) {
      ageMinutes = Math.round((Date.now() - created) / 60_000);
    }
  }

  return {
    poolId: pool.id,
    poolAddress: a.address,
    poolName: a.name || '?',
    dex: dexId,
    createdAt: a.pool_created_at || null,
    ageMinutes,

    tokenAddress: baseTokenAddress,
    tokenName: tokenDetail?.name || a.name?.split(' / ')[0] || 'Bilinmiyor',
    tokenSymbol: tokenDetail?.symbol || (a.name?.split(' / ')[0] || '?').toUpperCase(),
    tokenImage: tokenDetail?.image_url || null,
    decimals: tokenDetail?.decimals || null,
    totalSupply: tokenDetail?.normalized_total_supply || null,

    priceUsd: parseFloat(a.base_token_price_usd) || 0,
    fdvUsd: parseFloat(a.fdv_usd) || 0,
    marketCapUsd: parseFloat(a.market_cap_usd) || null,

    liquidityUsd: parseFloat(a.reserve_in_usd) || dsData?.liquidity?.usd || 0,

    volume24h: parseFloat(a.volume_usd?.h24) || dsData?.volume?.h24 || 0,
    volume1h: parseFloat(a.volume_usd?.h1) || dsData?.volume?.h1 || 0,
    priceChange1h: parseFloat(a.price_change_percentage?.h1) || 0,
    priceChange24h: parseFloat(a.price_change_percentage?.h24) || 0,

    buys24h: a.transactions?.h24?.buys || dsData?.txns?.h24?.buys || 0,
    sells24h: a.transactions?.h24?.sells || dsData?.txns?.h24?.sells || 0,
    buyers24h: a.transactions?.h24?.buyers || 0,
    sellers24h: a.transactions?.h24?.sellers || 0,
    buys1h: a.transactions?.h1?.buys || dsData?.txns?.h1?.buys || 0,
    sells1h: a.transactions?.h1?.sells || dsData?.txns?.h1?.sells || 0,
    buys5m: dsData?.txns?.m5?.buys || 0,
    sells5m: dsData?.txns?.m5?.sells || 0,

    dexScreener: dsData
      ? {
          url: dsData.url,
          pairAddress: dsData.pairAddress,
          info: dsData.info || null,
        }
      : null,

    contract: jettonInfo || null,
  };
}

async function scanNewTokens({ minLiquidityUsd = 0, limit = 30 } = {}) {
  const pools = await fetchNewPoolsHybrid();
  const sliced = pools.slice(0, limit);

  const enriched = [];
  for (const pool of sliced) {
    const a = pool.attributes || {};
    const liquidity = parseFloat(a.reserve_in_usd) || 0;
    const isOnChainFresh = pool._onChainFresh === true;
    if (!isOnChainFresh && liquidity < minLiquidityUsd) continue;

    const baseTokenRel = pool.relationships?.base_token?.data?.id || '';
    const tokenAddress = baseTokenRel.replace(/^ton_/, '');
    if (!tokenAddress) continue;

    const poolAddrForChecks = pool.attributes?.address;
    const heavyOnScan = process.env.TON_HEAVY_ON_SCAN === '1';
    const [tokenDetail, dsData, jettonInfo, lpAnalysis, sybilAnalysis] = await Promise.all([
      fetchTokenDetail(tokenAddress),
      fetchDexScreener(tokenAddress),
      fetchJettonInfo(tokenAddress),
      heavyOnScan && poolAddrForChecks
        ? require('../../lpBurnDetector').analyzePool(poolAddrForChecks).catch(() => null)
        : Promise.resolve(null),
      heavyOnScan && poolAddrForChecks
        ? require('../../sybilDetector').analyzePool(poolAddrForChecks, 6).catch(() => null)
        : Promise.resolve(null),
    ]);

    const normalized = normalize(pool, tokenDetail, dsData, jettonInfo);
    normalized.lpBurnAnalysis = lpAnalysis || { burnedPct: 0, lockedPct: 0, lpLocked: false, top1Pct: 0, source: 'unknown' };
    normalized.sybilAnalysis = sybilAnalysis || { buyersAnalyzed: 0, largestClusterSize: 0, clusterRatio: 0, sharedFunder: null, sybilDetected: false, source: 'unknown' };
    enriched.push(normalized);

    const gap = parseInt(process.env.TON_SCAN_ENRICH_GAP_MS || '300', 10);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  }

  return enriched;
}

async function fetchPoolLiquidity(poolAddress) {
  const { getPoolState } = require('../../tonchain');

  const onchain = await getPoolState(poolAddress);

  let dsExtra = {
    priceUsd: 0, volume24h: 0, volume1h: 0, priceChange1h: 0,
    buys1h: 0, sells1h: 0, buys5m: 0, sells5m: 0,
  };
  try {
    const ds = await http.get(`https://api.dexscreener.com/latest/dex/pairs/ton/${poolAddress}`);
    const pair = ds.data?.pairs?.[0] || ds.data?.pair;
    if (pair) {
      dsExtra = {
        priceUsd: parseFloat(pair.priceUsd) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        volume1h: parseFloat(pair.volume?.h1) || 0,
        priceChange1h: parseFloat(pair.priceChange?.h1) || 0,
        buys1h: pair.txns?.h1?.buys || 0,
        sells1h: pair.txns?.h1?.sells || 0,
        buys5m: pair.txns?.m5?.buys || 0,
        sells5m: pair.txns?.m5?.sells || 0,
      };
    }
  } catch (_) { /* yoksay */ }

  if (onchain) {
    return {
      liquidityUsd: onchain.liquidityUsd,
      removed: onchain.removed,
      priceUsd: dsExtra.priceUsd,
      volume24h: dsExtra.volume24h,
      volume1h: dsExtra.volume1h,
      priceChange1h: dsExtra.priceChange1h,
      buys1h: dsExtra.buys1h,
      sells1h: dsExtra.sells1h,
      buys5m: dsExtra.buys5m,
      sells5m: dsExtra.sells5m,
    };
  }

  try {
    const url = `${GT_BASE}/networks/ton/pools/${poolAddress}`;
    const { data } = await http.get(url);
    const a = data?.data?.attributes;
    if (!a) return null;
    return {
      liquidityUsd: parseFloat(a.reserve_in_usd) || 0,
      priceUsd: parseFloat(a.base_token_price_usd) || 0,
      volume24h: parseFloat(a.volume_usd?.h24) || 0,
      buys1h: a.transactions?.h1?.buys || 0,
      sells1h: a.transactions?.h1?.sells || 0,
      priceChange1h: parseFloat(a.price_change_percentage?.h1) || 0,
      volume1h: parseFloat(a.volume_usd?.h1) || 0,
    };
  } catch (err) {
    console.warn(`Pool likidite hatası (${poolAddress}):`, err.message);
    return null;
  }
}

const TON_ADDR_RE = /\b(EQ[A-Za-z0-9_-]{46}|UQ[A-Za-z0-9_-]{46}|0:[a-fA-F0-9]{64})\b/;

function extractTonAddress(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(TON_ADDR_RE);
  return m ? m[0] : null;
}

async function fetchPoolByAddress(poolAddress) {
  try {
    const url = `${GT_BASE}/networks/ton/pools/${poolAddress}?include=base_token,dex`;
    const { data } = await http.get(url);
    return data?.data || null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`Pool fetch hatası (${poolAddress}):`, err.message);
    return null;
  }
}

async function fetchTopPoolForToken(tokenAddress) {
  try {
    const url = `${GT_BASE}/networks/ton/tokens/${tokenAddress}/pools?page=1`;
    const { data } = await http.get(url);
    const pools = data?.data || [];
    if (pools.length === 0) return null;
    return pools.sort((a, b) => {
      const la = parseFloat(a.attributes?.reserve_in_usd) || 0;
      const lb = parseFloat(b.attributes?.reserve_in_usd) || 0;
      return lb - la;
    })[0];
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`Token pools hatası (${tokenAddress}):`, err.message);
    return null;
  }
}

async function resolveTokenFromInput(input) {
  const addr = extractTonAddress(input);
  if (!addr) return null;

  let pool = await fetchPoolByAddress(addr);

  if (!pool) {
    pool = await fetchTopPoolForToken(addr);
  }
  if (!pool) return null;

  const baseTokenRel = pool.relationships?.base_token?.data?.id || '';
  const tokenAddress = baseTokenRel.replace(/^ton_/, '');
  if (!tokenAddress) return null;

  const [tokenDetail, dsData, jettonInfo] = await Promise.all([
    fetchTokenDetail(tokenAddress),
    fetchDexScreener(tokenAddress),
    fetchJettonInfo(tokenAddress),
  ]);

  return normalize(pool, tokenDetail, dsData, jettonInfo);
}

module.exports = {
  scanNewTokens,
  fetchNewPools,
  fetchNewPoolsFromChain,
  fetchNewPoolsHybrid,
  fetchTokenDetail,
  fetchDexScreener,
  fetchJettonInfo,
  fetchPoolLiquidity,
  resolveTokenFromInput,
  extractTonAddress,
};
