// DexScreener pair → feed token (Solana, TON, BSC, Ethereum).

const axios = require('axios');
const config = require('./solana/config');
const { resolveDexPlatform } = require('../dexPlatform');

const http = axios.create({
  timeout: 14_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/dexscreener' },
});

const CHAIN_META = {
  solana: { dsId: 'solana', quote: 'SOL' },
  ton: { dsId: 'ton', quote: 'TON' },
  bsc: { dsId: 'bsc', quote: 'BNB' },
  eth: { dsId: 'ethereum', quote: 'ETH' },
};

function chainMeta(chainKey) {
  return CHAIN_META[chainKey] || CHAIN_META.solana;
}

function normalizeDexPair(pair, chainKey) {
  if (!pair?.baseToken?.address) return null;
  const { dsId, quote } = chainMeta(chainKey);
  if (String(pair.chainId || '').toLowerCase() !== dsId) return null;

  const tokenAddress = pair.baseToken.address;
  const poolAddress = pair.pairAddress;
  const dexRaw = (pair.dexId || 'unknown').toLowerCase();
  const plat = resolveDexPlatform(dexRaw, tokenAddress);
  const quoteSym = pair.quoteToken?.symbol || quote;

  return {
    chain: chainKey,
    poolId: `${dsId}_${poolAddress || tokenAddress}`,
    poolAddress,
    poolName: `${pair.baseToken.symbol || '?'}/${quoteSym}`,
    dex: dexRaw,
    dexPlatform: plat.key,
    dexLabel: plat.label,
    tokenAddress,
    tokenName: pair.baseToken.name || pair.baseToken.symbol || '?',
    tokenSymbol: (pair.baseToken.symbol || '?').toUpperCase(),
    tokenImage: pair.info?.imageUrl || null,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    fdvUsd: parseFloat(pair.fdv) || 0,
    marketCapUsd: parseFloat(pair.marketCap) || null,
    liquidityUsd: parseFloat(pair.liquidity?.usd) || 0,
    volume24h: parseFloat(pair.volume?.h24) || 0,
    volume6h: parseFloat(pair.volume?.h6) || 0,
    volume1h: parseFloat(pair.volume?.h1) || 0,
    volume5m: parseFloat(pair.volume?.m5) || 0,
    priceChange5m: parseFloat(pair.priceChange?.m5) || 0,
    priceChange1h: parseFloat(pair.priceChange?.h1) || 0,
    priceChange6h: parseFloat(pair.priceChange?.h6) || 0,
    priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
    dexScreener: {
      url: pair.url || `https://dexscreener.com/${dsId}/${poolAddress || tokenAddress}`,
    },
  };
}

function pickBestPairs(pairs, chainKey, limit) {
  const { dsId } = chainMeta(chainKey);
  const seen = new Set();
  const list = [];
  for (const p of pairs || []) {
    if (String(p.chainId || '').toLowerCase() !== dsId) continue;
    const addr = p.baseToken?.address;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    list.push(p);
  }
  list.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  return list.slice(0, limit);
}

function pairMatchesQuery(pair, qLower) {
  if (!qLower) return true;
  const base = pair?.baseToken || {};
  const quote = pair?.quoteToken || {};
  const fields = [
    base.symbol,
    base.name,
    base.address,
    quote.symbol,
    quote.name,
    pair.pairAddress,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return fields.some((s) => s.includes(qLower));
}

async function searchDexPairs(chainKey, query, limit = 24) {
  const q = String(query || '').trim().replace(/^\$/, '');
  if (!q) return [];
  const qLower = q.toLowerCase();
  const { quote } = chainMeta(chainKey);
  const attempts = [q];
  if (quote && !q.toUpperCase().includes(quote)) {
    attempts.push(`${q} ${quote}`, `${q}/${quote}`);
  }

  const merged = [];
  const seenAddr = new Set();
  for (const attempt of attempts) {
    try {
      const { data } = await http.get(
        `${config.api.dexScreenerBase}/latest/dex/search?q=${encodeURIComponent(attempt)}`,
      );
      for (const p of data?.pairs || []) {
        const addr = p.baseToken?.address;
        if (!addr || seenAddr.has(addr)) continue;
        seenAddr.add(addr);
        merged.push(p);
      }
    } catch (e) {
      console.warn(`[dexscreener/${chainKey}] search "${attempt}":`, e.message);
    }
    if (merged.length >= limit * 2) break;
  }

  let picked = pickBestPairs(merged, chainKey, Math.max(limit, merged.length));
  if (qLower.length >= 2) {
    const strict = picked.filter((p) => pairMatchesQuery(p, qLower));
    if (strict.length) picked = strict;
  }
  return picked.slice(0, limit);
}

async function discoverDexPairs(chainKey, limit = 24) {
  const { dsId } = chainMeta(chainKey);
  try {
    const { data } = await http.get(`${config.api.dexScreenerBase}/token-profiles/latest/v1`);
    const profiles = (Array.isArray(data) ? data : []).filter((p) => p.chainId === dsId);
    const addrs = profiles.slice(0, Math.min(30, limit + 6)).map((p) => p.tokenAddress).filter(Boolean);
    if (!addrs.length) {
      return searchDexPairs(chainKey, chainMeta(chainKey).quote, limit);
    }
    const { data: tok } = await http.get(
      `${config.api.dexScreenerBase}/latest/dex/tokens/${addrs.join(',')}`,
    );
    const pairs = tok?.pairs || [];
    const best = pickBestPairs(pairs, chainKey, limit);
    if (best.length) return best;
    return searchDexPairs(chainKey, chainMeta(chainKey).quote, limit);
  } catch (e) {
    console.warn(`[dexscreener/${chainKey}] discover:`, e.message);
    return searchDexPairs(chainKey, chainMeta(chainKey).quote, limit);
  }
}

module.exports = {
  CHAIN_META,
  chainMeta,
  normalizeDexPair,
  pickBestPairs,
  searchDexPairs,
  discoverDexPairs,
};
