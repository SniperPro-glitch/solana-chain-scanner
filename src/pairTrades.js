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

const CACHE_MS = 2_500;
const cache = new Map();

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
    ago: timeAgo(a.block_timestamp),
    isBaseSold,
    source: 'geckoterminal',
  };
}

async function fetchGeckoTrades(poolAddress, baseMint, limit = 24) {
  if (!poolAddress) return [];
  const { data, status } = await http.get(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/trades`,
    { params: { limit: Math.min(limit, 40) }, validateStatus: () => true },
  );
  if (status >= 400 || !data?.data) return [];
  return data.data
    .map((row) => normalizeGeckoTrade(row, baseMint))
    .filter(Boolean)
    .slice(0, limit);
}

async function fetchDexOrders(mint, limit = 24) {
  if (!mint) return [];
  const { data, status } = await http.get(
    `https://api.dexscreener.com/orders/v1/solana/${mint}`,
    { validateStatus: () => true },
  );
  if (status >= 400 || !Array.isArray(data)) return [];
  return data.slice(0, limit).map((o, i) => {
    const side = String(o.type || o.side || '').toLowerCase().includes('sell') ? 'sell' : 'buy';
    const usd = Math.abs(parseFloat(o.usdAmount || o.amountUsd || o.volumeUsd || 0));
    return {
      id: o.id || `ds-${i}`,
      side,
      usd,
      usdFmt: usd ? fmtUsd(usd) : '—',
      wallet: shortAddr(o.maker || o.trader || o.wallet),
      at: o.timestamp || o.blockTimestamp || null,
      ago: timeAgo(o.timestamp || o.blockTimestamp),
      source: 'dexscreener',
    };
  }).filter((t) => t.usd > 0 || t.wallet !== '—');
}

async function fetchPairTrades({ poolAddress, mint, limit = 24 } = {}) {
  const key = `${poolAddress || ''}:${mint || ''}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.trades;

  let pool = poolAddress;
  let baseMint = mint;
  if (!pool && mint) {
    const pair = await resolveDexScreenerPair({ mint });
    pool = pair?.pairAddress;
    baseMint = pair?.baseToken?.address || mint;
  }

  let trades = [];
  if (pool) {
    try {
      trades = await fetchGeckoTrades(pool, baseMint, limit);
    } catch (e) {
      console.warn('[trades] gecko:', e.message);
    }
  }
  if (trades.length < 3 && mint) {
    try {
      const ds = await fetchDexOrders(mint, limit);
      if (ds.length) trades = ds;
    } catch {
      /* yoksay */
    }
  }

  const out = trades.slice(0, limit);
  cache.set(key, { at: Date.now(), trades: out });
  return out;
}

module.exports = {
  fetchPairTrades,
  timeAgo,
};
