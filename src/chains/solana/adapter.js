// Solana adapter — DexScreener (birincil). SPL mint/freeze/holder → risk.js (stub/RPC).

const axios = require('axios');
const config = require('./config');

const http = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/adapter' },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function is429Error(e) {
  const st = e?.response?.status;
  return st === 429 || /429|Too Many Requests/i.test(String(e?.message || ''));
}

function normalizePair(pair) {
  if (!pair || !pair.baseToken) return null;

  const tokenAddress = pair.baseToken.address;
  const poolAddress = pair.pairAddress;

  let ageMinutes = null;
  if (pair.pairCreatedAt) {
    ageMinutes = Math.round((Date.now() - pair.pairCreatedAt) / 60_000);
  }

  return {
    chain: 'solana',
    poolId: `solana_${poolAddress || tokenAddress}`,
    poolAddress,
    poolName: `${pair.baseToken.symbol} / ${pair.quoteToken?.symbol || 'SOL'}`,
    dex: (pair.dexId || 'raydium').toLowerCase(),
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    ageMinutes,

    tokenAddress,
    tokenName: pair.baseToken.name || pair.baseToken.symbol || '?',
    tokenSymbol: (pair.baseToken.symbol || '?').toUpperCase(),
    tokenImage: pair.info?.imageUrl || null,

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

    dexScreener: {
      url: pair.url || config.data.dexScreener(poolAddress || tokenAddress),
      pairAddress: poolAddress,
    },

    contract: null,
  };
}

async function fetchPairByPoolAddress(poolAddr) {
  if (!poolAddr) return null;
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/latest/dex/pairs/solana/${poolAddr}`,
      );
      const pairs = data?.pairs || [];
      return pairs[0] || null;
    } catch (e) {
      if (is429Error(e)) {
        const h = e.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        await sleep(Math.min(10_000, (ra > 0 ? ra * 1000 : 700) * (2 ** att)));
        continue;
      }
      break;
    }
  }
  return null;
}

async function fetchTopPairForToken(tokenAddr) {
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/tokens/v1/solana/${tokenAddr}`,
      );
      const pairs = Array.isArray(data) ? data : (data?.pairs || []);
      const solPairs = pairs.filter((p) => p.chainId === 'solana');
      solPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      return solPairs[0] || null;
    } catch (e) {
      if (is429Error(e)) {
        const h = e.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        await sleep(Math.min(10_000, (ra > 0 ? ra * 1000 : 700) * (2 ** att)));
        continue;
      }
      break;
    }
  }
  return null;
}

function extractAddress(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(config.addressPattern);
  return m ? m[0] : null;
}

async function resolveTokenFromInput(input) {
  if (!input) return null;
  const addr = extractAddress(input);
  if (!addr) return null;

  let pair = await fetchPairByPoolAddress(addr);
  if (!pair) pair = await fetchTopPairForToken(addr);
  if (!pair) return null;

  return normalizePair(pair);
}

async function _fetchPairsByTokens(tokenAddrs) {
  if (!tokenAddrs?.length) return [];
  const joined = tokenAddrs.slice(0, 30).join(',');
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/tokens/v1/solana/${joined}`,
      );
      const pairs = Array.isArray(data) ? data : (data?.pairs || []);
      return pairs.filter((p) => p.chainId === 'solana');
    } catch (e) {
      if (is429Error(e)) {
        const h = e.response?.headers || {};
        const ra = parseInt(h['retry-after'] || h['Retry-After'] || '0', 10);
        await sleep(Math.min(10_000, (ra > 0 ? ra * 1000 : 700) * (2 ** att)));
        continue;
      }
      break;
    }
  }
  return [];
}

async function fetchPoolsFromDexScreener() {
  try {
    const { data } = await http.get(`${config.api.dexScreenerBase}/token-profiles/latest/v1`);
    const profiles = Array.isArray(data) ? data : (data?.data || []);
    const solProfiles = profiles.filter((p) => p.chainId === 'solana');
    if (!solProfiles.length) return [];
    const addrs = solProfiles.slice(0, 30).map((p) => p.tokenAddress);
    return await _fetchPairsByTokens(addrs);
  } catch (e) {
    console.warn('[solana/adapter] DexScreener profiles:', e.message);
    return null;
  }
}

function _geckoPoolToDsPair(pool) {
  const a = pool.attributes || {};
  const baseRel = pool.relationships?.base_token?.data?.id || '';
  const baseAddr = baseRel.replace(/^solana_/, '');
  const quoteRel = pool.relationships?.quote_token?.data?.id || '';
  const quoteAddr = quoteRel.replace(/^solana_/, '');
  if (!baseAddr) return null;
  return {
    chainId: 'solana',
    dexId: (pool.relationships?.dex?.data?.id || 'raydium').replace(/^solana_/, ''),
    url: `https://dexscreener.com/solana/${a.address}`,
    pairAddress: a.address,
    baseToken: { address: baseAddr, name: (a.name || '').split(' / ')[0] || '?', symbol: (a.name || '').split(' / ')[0] || '?' },
    quoteToken: { address: quoteAddr, symbol: (a.name || '').split(' / ')[1] || 'SOL' },
    priceUsd: a.base_token_price_usd || '0',
    fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
    marketCap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : null,
    liquidity: { usd: parseFloat(a.reserve_in_usd) || 0 },
    volume: { h24: parseFloat(a.volume_usd?.h24) || 0, h1: parseFloat(a.volume_usd?.h1) || 0 },
    priceChange: { h1: parseFloat(a.price_change_percentage?.h1) || 0, h24: parseFloat(a.price_change_percentage?.h24) || 0 },
    txns: {
      h24: { buys: a.transactions?.h24?.buys || 0, sells: a.transactions?.h24?.sells || 0 },
      h1: { buys: a.transactions?.h1?.buys || 0, sells: a.transactions?.h1?.sells || 0 },
    },
    pairCreatedAt: a.pool_created_at ? new Date(a.pool_created_at).getTime() : null,
  };
}

async function fetchPoolsFromGecko() {
  for (let att = 0; att < 3; att++) {
    try {
      const { data } = await http.get(
        `${config.api.geckoTerminalBase}/networks/solana/new_pools?page=1`,
      );
      return (data?.data || []).map(_geckoPoolToDsPair).filter(Boolean);
    } catch (e) {
      if (is429Error(e)) {
        await sleep(700 * (2 ** att));
        continue;
      }
      console.warn('[solana/adapter] Gecko new_pools:', e.message);
      break;
    }
  }
  return [];
}

async function fetchPoolsHybrid() {
  let pairs = await fetchPoolsFromDexScreener();
  if (!pairs?.length) {
    console.log('[solana/adapter] DexScreener boş → GeckoTerminal');
    pairs = await fetchPoolsFromGecko();
  }
  const seen = new Set();
  const out = [];
  for (const p of pairs || []) {
    const id = p.pairAddress || p.baseToken?.address;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  out.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
  return out;
}

async function scanNewTokens({ minLiquidityUsd = 0, limit = 30 } = {}) {
  const pairs = await fetchPoolsHybrid();
  const enriched = [];
  const gap = parseInt(process.env.SOLANA_SCAN_TOKEN_GAP_MS || '1200', 10);
  for (const pair of pairs.slice(0, limit * 2)) {
    const token = normalizePair(pair);
    if (!token || token.liquidityUsd < minLiquidityUsd) continue;
    enriched.push(token);
    if (enriched.length >= limit) break;
    if (gap > 0) await sleep(gap);
  }
  return enriched;
}

async function fetchPoolLiquidity(poolAddress) {
  const pair = await fetchPairByPoolAddress(poolAddress);
  if (!pair) return null;
  return {
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
}

module.exports = {
  scanNewTokens,
  resolveTokenFromInput,
  extractAddress,
  fetchPoolLiquidity,
  normalizePair,
  fetchTopPairForToken,
  fetchPairByPoolAddress,
};
