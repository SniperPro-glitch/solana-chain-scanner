// Pump.fun keşfi — DexScreener (pump mint), isteğe bağlı Pump API + Solana RPC imzaları.

const axios = require('axios');
const config = require('./config');

const http = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/pumpfun' },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pump.fun bonding curve program (create / trade). */
const PUMP_BONDING_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

function envOn(name, defaultVal = '1') {
  return ['1', 'true', 'on', 'yes'].includes(
    String(process.env[name] ?? defaultVal).trim().toLowerCase(),
  );
}

function isPumpMintAddress(addr) {
  if (!addr || typeof addr !== 'string') return false;
  return addr.endsWith('pump');
}

function isPumpDexId(dexId) {
  const d = String(dexId || '').toLowerCase();
  return d === 'pumpfun' || d === 'pumpswap' || d === 'pump';
}

function pumpCoinToDexPair(coin) {
  if (!coin) return null;
  const mint = coin.mint || coin.mint_address || coin.address || coin.token_address;
  if (!mint) return null;
  const created = coin.created_timestamp || coin.createdTimestamp || coin.created_at;
  const createdMs = typeof created === 'number'
    ? (created < 1e12 ? created * 1000 : created)
    : (created ? new Date(created).getTime() : Date.now());

  const mc = parseFloat(coin.usd_market_cap ?? coin.market_cap ?? coin.marketCap ?? 0) || 0;
  const liq = parseFloat(coin.virtual_sol_reserves ?? coin.virtualSolReserves ?? 0);
  const solPrice = parseFloat(coin.sol_price ?? coin.solPrice ?? 0) || null;
  let liquidityUsd = parseFloat(coin.liquidity_usd ?? coin.liquidityUsd ?? 0) || 0;
  if (!liquidityUsd && liq && solPrice) liquidityUsd = liq * solPrice;

  return {
    chainId: 'solana',
    dexId: coin.complete || coin.raydium_pool ? 'pumpswap' : 'pumpfun',
    url: `https://dexscreener.com/solana/${mint}`,
    pairAddress: coin.bonding_curve || coin.bondingCurve || mint,
    baseToken: {
      address: mint,
      name: coin.name || coin.token_name || '?',
      symbol: (coin.symbol || coin.ticker || '?').toUpperCase(),
    },
    quoteToken: {
      address: config.wrappedNative,
      symbol: 'SOL',
    },
    priceUsd: String(parseFloat(coin.usd_price ?? coin.price_usd ?? coin.priceUsd ?? 0) || 0),
    fdv: mc || null,
    marketCap: mc || null,
    liquidity: { usd: liquidityUsd },
    volume: { h24: 0, h1: 0 },
    priceChange: { h1: 0, h24: 0 },
    txns: { h24: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 } },
    pairCreatedAt: createdMs,
    info: {
      imageUrl: coin.image_uri || coin.imageUri || coin.image_url || null,
    },
    _pumpSource: 'pump_api',
  };
}

async function rpcCall(method, params) {
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();
  if (!rpc || !/^https?:\/\//i.test(rpc)) return null;
  try {
    const { data } = await http.post(rpc, { jsonrpc: '2.0', id: 1, method, params });
    if (data?.error) throw new Error(data.error.message || 'rpc error');
    return data?.result ?? null;
  } catch (e) {
    console.warn('[solana/pumpfun] RPC:', e.message);
    return null;
  }
}

function extractPumpMintsFromTx(tx) {
  const found = new Set();
  if (!tx) return [];

  const keys = tx.transaction?.message?.accountKeys || [];
  for (const k of keys) {
    const pk = typeof k === 'string' ? k : (k?.pubkey || k?.toString?.());
    if (pk && isPumpMintAddress(pk)) found.add(pk);
  }

  for (const b of tx.meta?.postTokenBalances || []) {
    if (b.mint && isPumpMintAddress(b.mint)) found.add(b.mint);
  }

  const logs = tx.meta?.logMessages || [];
  for (const line of logs) {
    const m = line.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}pump\b/g);
    if (m) m.forEach((a) => found.add(a));
  }

  return [...found];
}

/** Son Pump.fun create işlemlerinden mint listesi (SOLANA_RPC_URL + PUMP_RPC_DISCOVERY=1). */
async function fetchRecentMintsFromRpc({ limit = 20 } = {}) {
  if (!envOn('PUMP_RPC_DISCOVERY', '0')) return [];
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();
  if (!rpc) return [];

  try {
    const sigs = await rpcCall('getSignaturesForAddress', [
      PUMP_BONDING_PROGRAM,
      { limit: Math.min(50, limit * 3) },
    ]);
    if (!Array.isArray(sigs) || !sigs.length) return [];

    const mints = [];
    const seen = new Set();
    for (const entry of sigs) {
      if (mints.length >= limit) break;
      if (!entry?.signature || entry.err) continue;
      try {
        const tx = await rpcCall('getTransaction', [
          entry.signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ]);
        for (const mint of extractPumpMintsFromTx(tx)) {
          if (seen.has(mint)) continue;
          seen.add(mint);
          mints.push(mint);
          if (mints.length >= limit) break;
        }
      } catch {
        /* skip tx */
      }
      await sleep(120);
    }
    if (mints.length) console.log(`[solana/pumpfun] RPC: ${mints.length} yeni pump mint`);
    return mints;
  } catch (e) {
    console.warn('[solana/pumpfun] RPC discovery:', e.message);
    return [];
  }
}

async function fetchPumpFunApiCoins() {
  if (!envOn('PUMP_FUN_API_ENABLED', '1')) return [];

  const base = (process.env.PUMP_FUN_API_BASE || 'https://frontend-api-v3.pump.fun').replace(/\/$/, '');
  const jwt = (process.env.PUMP_FUN_JWT || '').trim();
  const headers = {
    Accept: 'application/json',
    Origin: 'https://pump.fun',
    Referer: 'https://pump.fun/',
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const path = '/coins/latest';
  try {
    const { data, status } = await http.get(`${base}${path}`, {
      headers,
      timeout: 12_000,
      validateStatus: () => true,
    });
    if (status === 404) return [];
    if (status === 401 || status === 403) {
      if (!jwt) {
        console.warn('[solana/pumpfun] Pump API auth gerekli (PUMP_FUN_JWT) — DexScreener keşfi kullanılıyor');
      }
      return [];
    }
    if (status >= 400) {
      console.warn(`[solana/pumpfun] API ${path}: HTTP ${status}`);
      return [];
    }
    const coins = Array.isArray(data) ? data : (data?.coins || data?.results || []);
    if (coins.length) {
      console.log(`[solana/pumpfun] API ${path}: ${coins.length} coin`);
      return coins.map(pumpCoinToDexPair).filter(Boolean);
    }
  } catch (e) {
    console.warn(`[solana/pumpfun] API ${path}:`, e.message);
  }
  return [];
}

async function fetchPumpMintsFromDexScreener() {
  if (!envOn('PUMP_DEXSCREENER_DISCOVERY', '1')) return [];

  const mints = new Set();
  const urls = [
    `${config.api.dexScreenerBase}/token-boosts/latest/v1`,
    `${config.api.dexScreenerBase}/token-profiles/latest/v1`,
  ];

  for (const url of urls) {
    try {
      const { data } = await http.get(url);
      const arr = Array.isArray(data) ? data : [];
      for (const item of arr) {
        if (item.chainId !== 'solana') continue;
        const mint = item.tokenAddress;
        if (!mint) continue;
        if (isPumpMintAddress(mint) || String(item.url || '').toLowerCase().includes('pump')) {
          mints.add(mint);
        }
      }
    } catch (e) {
      console.warn('[solana/pumpfun] DexScreener list:', e.message);
    }
  }

  return [...mints];
}

/**
 * Pump.fun odaklı havuz listesi (DexScreener pair şekli).
 * @param {object} deps — adapter._fetchPairsByTokens, adapter.fetchTopPairForToken
 */
async function fetchPumpPairs(deps = {}) {
  const { fetchPairsByTokens, fetchTopPairForToken } = deps;
  const seen = new Set();
  const out = [];

  const addPair = (pair) => {
    if (!pair || pair.chainId !== 'solana') return;
    const dex = (pair.dexId || '').toLowerCase();
    const mint = pair.baseToken?.address;
    if (!isPumpDexId(dex) && !isPumpMintAddress(mint)) return;
    const id = pair.pairAddress || mint;
    if (!id || seen.has(id)) return;
    seen.add(id);
    pair.dexId = pair.dexId || 'pumpfun';
    pair._pumpSource = pair._pumpSource || 'dexscreener';
    out.push(pair);
  };

  const apiPairs = await fetchPumpFunApiCoins();
  for (const p of apiPairs) addPair(p);

  const rpcMints = await fetchRecentMintsFromRpc({ limit: 15 });
  const profileMints = await fetchPumpMintsFromDexScreener();
  const allMints = [...new Set([...rpcMints, ...profileMints])].filter(isPumpMintAddress);

  if (allMints.length && fetchPairsByTokens) {
    const pairs = await fetchPairsByTokens(allMints.slice(0, 30));
    for (const p of pairs) {
      if (isPumpDexId(p.dexId) || isPumpMintAddress(p.baseToken?.address)) addPair(p);
    }
  }

  for (const mint of allMints.slice(0, 12)) {
    if (out.length >= 40) break;
    if (seen.has(mint)) continue;
    if (!fetchTopPairForToken) continue;
    try {
      const pair = await fetchTopPairForToken(mint);
      if (pair) addPair(pair);
    } catch {
      /* skip */
    }
    await sleep(200);
  }

  out.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
  if (out.length) console.log(`[solana/pumpfun] ${out.length} pump havuz (API/RPC/Dex)`);
  return out;
}

function inferPumpGraduationFromDex(token) {
  const dex = String(token?.dex || '').toLowerCase();
  const mint = token?.tokenAddress;
  if (dex === 'pumpswap') return { graduated: true, pct: 100 };
  if (dex === 'pumpfun') return { graduated: false, pct: token.pumpBondingPct ?? null };
  if (dex === 'raydium' && isPumpMintAddress(mint)) return { graduated: true, pct: 100 };
  return null;
}

function parseBondingPct(coin) {
  if (!coin) return null;
  if (coin.complete === true) return 100;
  const raw = coin.bonding_curve_progress ?? coin.bondingCurveProgress ?? coin.progress;
  if (raw == null) return null;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.min(100, Math.round(n));
}

async function fetchPumpCoinByMint(mint) {
  if (!mint) return null;
  const base = (process.env.PUMP_FUN_API_BASE || 'https://frontend-api-v3.pump.fun').replace(/\/$/, '');
  const jwt = (process.env.PUMP_FUN_JWT || '').trim();
  const headers = {
    Accept: 'application/json',
    Origin: 'https://pump.fun',
    Referer: 'https://pump.fun/',
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  for (const path of [`/coins/${mint}`, `/coins/metadata/${mint}`]) {
    try {
      const { data } = await http.get(`${base}${path}`, { headers, timeout: 10_000 });
      return Array.isArray(data) ? data[0] : data;
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Pump.fun bonding curve / mezuniyet durumu (paylaşım filtresi için).
 * pumpGraduated: true = havuz %100, PumpSwap/Raydium’a geçmiş.
 */
async function enrichPumpGraduation(token) {
  if (!token) return token;
  const mint = token.tokenAddress;
  const isPump = token.isPumpFun || isPumpMintAddress(mint);
  if (!isPump) {
    token.pumpGraduated = null;
    token.pumpBondingPct = null;
    return token;
  }

  const fromDex = inferPumpGraduationFromDex(token);
  if (fromDex?.graduated === true) {
    token.pumpGraduated = true;
    token.pumpBondingPct = 100;
    return token;
  }

  const coin = await fetchPumpCoinByMint(mint);
  if (coin) {
    const pct = parseBondingPct(coin);
    const complete = coin.complete === true
      || !!coin.raydium_pool
      || !!coin.pump_swap_pool
      || !!coin.pumpswap_pool;
    token.pumpBondingPct = pct ?? (complete ? 100 : token.pumpBondingPct ?? null);
    token.pumpGraduated = complete || (pct != null && pct >= 100);
    if (token.pumpGraduated != null) return token;
  }

  if (fromDex) {
    token.pumpGraduated = fromDex.graduated;
    token.pumpBondingPct = fromDex.pct;
    return token;
  }

  const dex = String(token.dex || '').toLowerCase();
  token.pumpGraduated = dex === 'pumpswap' || (dex === 'raydium' && isPumpMintAddress(mint));
  if (dex === 'pumpfun') token.pumpGraduated = false;
  return token;
}

/** Manuel paylaşım / mint: DexScreener yoksa Pump.fun API veya minimal pumpfun çifti. */
async function resolvePumpPairForMint(mint) {
  if (!mint) return null;
  const coin = await fetchPumpCoinByMint(mint);
  if (coin) return pumpCoinToDexPair(coin);
  if (isPumpMintAddress(mint)) {
    let pair = null;
    try {
      const { fetchTopPairForToken } = require('./adapter');
      pair = await fetchTopPairForToken(mint);
    } catch {
      /* skip */
    }
    if (pair?.chainId === 'solana') return pair;
    return pumpCoinToDexPair({
      mint,
      symbol: 'PUMP',
      name: 'Pump.fun',
      complete: false,
    });
  }
  return null;
}

module.exports = {
  PUMP_BONDING_PROGRAM,
  isPumpMintAddress,
  isPumpDexId,
  fetchPumpPairs,
  fetchRecentMintsFromRpc,
  pumpCoinToDexPair,
  resolvePumpPairForMint,
  enrichPumpGraduation,
  inferPumpGraduationFromDex,
};
