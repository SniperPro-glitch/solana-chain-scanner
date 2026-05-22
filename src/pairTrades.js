// Canlı alım/satım — GeckoTerminal (DexScreener tarzı). Resmi DS orders yedek.

const axios = require('axios');
const { resolveDexScreenerPair } = require('./dexscreenerApi');
const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

const http = axios.create({
  timeout: 12_000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'solana-chain-scanner/miniapp',
  },
});

const CACHE_MS = 12_000;
const CACHE_MS_SLOW = 30_000;
/** live=1 + pool: cache yok (her poll Gecko). Pool yoksa kısa cache. */
const TRADES_LIVE_CACHE_MS = 0;
const TRADES_LIVE_CACHE_MS_NOPOOL = 1_200;
const PAIR_RESOLVE_CACHE_MS = 10 * 60 * 1000;
const TRADES_FEED_MAX = 50;
const cache = new Map();
const tradesLastGood = new Map();
const inFlight = new Map();
const pairResolveCache = new Map();
const pairResolveInFlight = new Map();

function pairResolveCacheKey({ mint, poolAddress } = {}) {
  const m = String(mint || '').trim();
  const p = String(poolAddress || '').trim();
  if (p && m) return `m:${m}:p:${p}`;
  if (p) return `p:${p}`;
  if (m) return `m:${m}`;
  return '';
}

async function resolvePairCached(opts = {}) {
  const key = pairResolveCacheKey(opts);
  if (!key) return null;
  const hit = pairResolveCache.get(key);
  if (hit && Date.now() - hit.at < PAIR_RESOLVE_CACHE_MS) return hit.pair;

  const pending = pairResolveInFlight.get(key);
  if (pending) return pending;

  const promise = resolveDexScreenerPair(opts)
    .then((pair) => {
      pairResolveCache.set(key, { at: Date.now(), pair: pair || null });
      return pair || null;
    })
    .finally(() => {
      pairResolveInFlight.delete(key);
    });
  pairResolveInFlight.set(key, promise);
  return promise;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tradeTimeMs(t) {
  const ms = new Date(t?.at || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function tradeKey(t) {
  return String(t?.txHash || t?.id || '').trim();
}

/** Zaman damgası + tx — aynı işlem iki kez gelmesin. */
function tradeDedupeKey(t) {
  const tx = tradeKey(t);
  if (tx) return `tx:${tx}`;
  return `t:${tradeTimeMs(t)}:${String(t?.wallet || '')}:${t?.usd ?? ''}`;
}

function mergeTrades(primary, extra, limit = TRADES_FEED_MAX) {
  const byKey = new Map();
  for (const t of [...(primary || []), ...(extra || [])]) {
    if (!t) continue;
    const k = tradeDedupeKey(t);
    const prev = byKey.get(k);
    if (!prev || tradeTimeMs(t) >= tradeTimeMs(prev)) byKey.set(k, t);
  }
  return [...byKey.values()]
    .sort((a, b) => tradeTimeMs(b) - tradeTimeMs(a))
    .slice(0, limit);
}

function shortAddr(a) {
  if (!a || a.length < 10) return a || '—';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function normalizeGeckoTrade(row, baseMint) {
  const a = row?.attributes;
  if (!a) return null;
  const kind = String(a.kind || '').toLowerCase();
  const side = kind === 'buy' ? 'buy' : kind === 'sell' ? 'sell' : 'swap';
  const usd = Math.abs(parseFloat(a.volume_in_usd) || 0);
  const fromAmt = parseFloat(a.from_token_amount) || 0;
  const toAmt = parseFloat(a.to_token_amount) || 0;
  const base = String(baseMint || '').toLowerCase();
  const fromMint = String(a.from_token_address || '').toLowerCase();
  const isBaseSold = base && fromMint === base;

  return {
    id: row.id || a.tx_hash,
    side,
    usd,
    usdFmt: usd >= 1 ? fmtUsd(usd) : fmtPriceUsd(usd),
    amount: side === 'buy' ? toAmt : fromAmt,
    priceUsd: parseFloat(a.price_from_in_usd) || parseFloat(a.price_to_in_usd) || null,
    wallet: shortAddr(a.tx_from_address),
    txHash: a.tx_hash || null,
    at: a.block_timestamp,
    updatedAt: a.block_timestamp,
    ago: timeAgo(a.block_timestamp),
    isBaseSold,
    source: 'geckoterminal',
  };
}

async function fetchGeckoTrades(poolAddress, baseMint, limit = TRADES_FEED_MAX) {
  if (!poolAddress) return [];
  const { data, status } = await http.get(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/trades`,
    {
      params: { limit: Math.min(limit, 50) },
      validateStatus: () => true,
      timeout: 16_000,
    },
  );
  if (status === 429) {
    const err = new Error('GeckoTerminal rate limit');
    err.code = 'rate_limit';
    throw err;
  }
  if (status >= 400 || !data?.data) return [];
  return data.data
    .map((row) => normalizeGeckoTrade(row, baseMint))
    .filter(Boolean)
    .slice(0, limit);
}

async function fetchDexOrders(mint, limit = TRADES_FEED_MAX) {
  if (!mint) return [];
  const { data, status } = await http.get(
    `https://api.dexscreener.com/orders/v1/solana/${mint}`,
    { validateStatus: () => true },
  );
  if (status >= 400 || !Array.isArray(data)) return [];
  return data.slice(0, limit).map((o, i) => {
    const side = String(o.type || o.side || '').toLowerCase().includes('sell') ? 'sell' : 'buy';
    const usd = Math.abs(parseFloat(o.usdAmount || o.amountUsd || o.volumeUsd || 0));
    const txHash = o.txHash || o.transactionHash || o.hash || null;
    const at = o.timestamp || o.blockTimestamp || null;
    return {
      id: txHash || o.id || `ds-${at || i}-${o.maker || o.trader || ''}`,
      side,
      usd,
      usdFmt: usd ? fmtUsd(usd) : '—',
      wallet: shortAddr(o.maker || o.trader || o.wallet),
      txHash,
      at,
      updatedAt: at,
      ago: timeAgo(at),
      source: 'dexscreener',
    };
  }).filter((t) => t.usd > 0 || t.wallet !== '—');
}

function parseSinceMs(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) && t > 0 ? t : 0;
}

function filterTradesAfterSince(trades, sinceMs) {
  if (!sinceMs || !trades?.length) return trades || [];
  return trades.filter((t) => tradeTimeMs(t) > sinceMs);
}

async function fetchPairTradesInner({
  poolAddress,
  mint,
  limit = TRADES_FEED_MAX,
  fresh = false,
  skipDexOrders = false,
  sinceMs = 0,
} = {}) {
  const since = parseSinceMs(sinceMs);
  const incremental = since > 0;
  const key = `${poolAddress || ''}:${mint || ''}:${limit}`;
  const hit = cache.get(key);
  const liveMaxAge = poolAddress ? TRADES_LIVE_CACHE_MS : TRADES_LIVE_CACHE_MS_NOPOOL;
  const maxAge = fresh ? liveMaxAge : (hit?.slow ? CACHE_MS_SLOW : CACHE_MS);
  if (!incremental && maxAge > 0 && hit?.trades?.length && Date.now() - hit.at < maxAge) {
    return hit.trades;
  }

  let pool = poolAddress;
  let baseMint = mint;
  if (!pool && mint) {
    const pair = await resolvePairCached({ mint });
    pool = pair?.pairAddress;
    baseMint = pair?.baseToken?.address || mint;
  }

  const t0 = Date.now();
  let trades = [];
  const attempts = poolAddress ? 1 : (fresh ? 2 : 1);
  for (let i = 0; i < attempts && pool; i += 1) {
    try {
      trades = await fetchGeckoTrades(pool, baseMint, limit);
      if (trades.length) break;
      if (i < attempts - 1) await sleep(400 * (i + 1));
    } catch (e) {
      if (e.code === 'rate_limit') {
        console.warn('[trades] gecko rate limit:', `attempt ${i + 1}/${attempts}`);
        if (i < attempts - 1) await sleep(600 * (i + 1));
        continue;
      }
      console.warn('[trades] gecko:', e.message);
      break;
    }
  }

  const elapsed = Date.now() - t0;
  const slow = elapsed > 2000;
  if (slow) {
    console.warn('[trades] gecko slow', elapsed, 'ms', key);
  }

  if (mint && !trades.length) {
    try {
      const ds = await fetchDexOrders(mint, limit);
      if (ds.length) trades = ds;
    } catch {
      /* yoksay */
    }
  } else if (!skipDexOrders && mint && trades.length < limit) {
    try {
      const ds = await fetchDexOrders(mint, limit);
      trades = mergeTrades(trades, ds, limit);
    } catch {
      /* yoksay */
    }
  }

  const batch = mergeTrades(trades, [], limit);
  if (batch.length) {
    const full = mergeTrades(batch, tradesLastGood.get(key) || [], limit);
    cache.set(key, { at: Date.now(), trades: full, slow: slow || hit?.slow });
    tradesLastGood.set(key, full);
    return incremental ? filterTradesAfterSince(batch, since) : full;
  }

  if (incremental) return [];

  const stale = tradesLastGood.get(key);
  if (stale?.length) {
    console.warn('[trades] boş yanıt — son iyi işlem listesi:', key);
    return stale;
  }
  return [];
}

async function fetchPairTrades(opts = {}) {
  const since = parseSinceMs(opts.sinceMs);
  const inflightKey = `${opts.poolAddress || ''}:${opts.mint || ''}:${opts.limit || TRADES_FEED_MAX}:${since || 0}`;
  const pending = inFlight.get(inflightKey);
  if (pending) return pending;
  const promise = fetchPairTradesInner(opts);
  inFlight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(inflightKey);
  }
}

module.exports = {
  parseSinceMs,
  filterTradesAfterSince,
  fetchPairTrades,
  mergeTrades,
  tradeDedupeKey,
  tradeTimeMs,
  TRADES_FEED_MAX,
  timeAgo,
};
