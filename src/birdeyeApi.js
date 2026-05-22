// Birdeye — OHLCV + token trades (Dex ekranı grafik / işlem bandı).

const axios = require('axios');
const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const OHLCV_CACHE_MS_BY_TF = {
  '1m': 10_000,
  '5m': 30_000,
  '15m': 60_000,
  '1h': 60_000,
  '4h': 120_000,
  '1d': 120_000,
};
const ohlcvCache = new Map();

const http = axios.create({
  timeout: 16_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/birdeye' },
});

const TF_TO_BIRDEYE = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
};

function getApiKey() {
  return String(process.env.BIRDEYE_API_KEY || '').trim();
}

function isBirdeyeEnabled() {
  return !!getApiKey();
}

function birdeyeHeaders() {
  const h = { 'x-chain': 'solana' };
  const key = getApiKey();
  if (key) h['X-API-KEY'] = key;
  return h;
}

function normalizeAppTf(tf) {
  const key = String(tf || '15m').toLowerCase();
  return TF_TO_BIRDEYE[key] ? key : '15m';
}

function birdeyeType(tf) {
  return TF_TO_BIRDEYE[normalizeAppTf(tf)] || '15m';
}

function ohlcvCacheMs(tf) {
  return OHLCV_CACHE_MS_BY_TF[normalizeAppTf(tf)] || 60_000;
}

function chartDayTime(unixSec) {
  const d = new Date(Number(unixSec) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseBirdeyeOhlcvItems(items, type) {
  const isDay = type === '1D';
  return (items || [])
    .map((item) => {
      const unix = Number(item?.unixTime);
      const close = Number(item?.c);
      if (!unix || !Number.isFinite(close)) return null;
      return {
        unix,
        time: isDay ? chartDayTime(unix) : unix,
        open: Number(item.o),
        high: Number(item.h),
        low: Number(item.l),
        close,
        volume: Number(item.v) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.unix - b.unix)
    .map(({ unix, ...c }) => c);
}

function ohlcvTimeRange(tf, limit = 320) {
  const type = birdeyeType(tf);
  const secPerBar = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1H': 3600,
    '4H': 14400,
    '1D': 86400,
  };
  const bar = secPerBar[type] || 900;
  const now = Math.floor(Date.now() / 1000);
  return { time_from: now - bar * limit, time_to: now };
}

async function fetchOhlcvByMint(mint, tf, opts = {}) {
  if (!mint || !isBirdeyeEnabled()) return [];
  const type = birdeyeType(tf);
  const cacheKey = `${mint}:${type}`;
  const live = !!opts.fresh;
  const hit = ohlcvCache.get(cacheKey);
  if (!live && hit && Date.now() - hit.at < ohlcvCacheMs(tf)) return hit.candles;

  const { time_from, time_to } = ohlcvTimeRange(tf);
  const { data, status } = await http.get(`${BIRDEYE_BASE}/defi/ohlcv`, {
    params: {
      address: mint,
      type,
      currency: 'usd',
      time_from,
      time_to,
    },
    headers: birdeyeHeaders(),
    validateStatus: () => true,
  });
  if (status !== 200 || !data?.success) {
    if (status === 401) console.warn('[birdeye] OHLCV unauthorized — set BIRDEYE_API_KEY');
    return hit?.candles || [];
  }
  const candles = parseBirdeyeOhlcvItems(data?.data?.items, type);
  if (candles.length) ohlcvCache.set(cacheKey, { at: Date.now(), candles });
  return candles.length ? candles : (hit?.candles || []);
}

function shortAddr(a) {
  if (!a || a.length < 10) return a || '—';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function timeAgoFromUnix(sec) {
  const t = Number(sec) * 1000;
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function tradeAmountFromLegs(item, side, baseMint) {
  const base = String(baseMint || '').toLowerCase();
  const from = item?.from;
  const to = item?.to;
  if (!from && !to) {
    const leg = item?.base || item?.quote;
    return Math.abs(parseFloat(leg?.uiAmount) || 0) || null;
  }
  const fromMint = String(from?.address || '').toLowerCase();
  const toMint = String(to?.address || '').toLowerCase();
  if (side === 'buy') {
    if (base && toMint === base) return Math.abs(parseFloat(to?.uiAmount) || 0);
    return Math.abs(parseFloat(to?.uiChangeAmount ?? to?.uiAmount) || 0);
  }
  if (side === 'sell') {
    if (base && fromMint === base) return Math.abs(parseFloat(from?.uiAmount) || 0);
    return Math.abs(parseFloat(from?.uiChangeAmount ?? from?.uiAmount) || 0);
  }
  return Math.abs(parseFloat(from?.uiAmount) || parseFloat(to?.uiAmount) || 0) || null;
}

/** WS TXS_DATA veya REST /defi/txs/token satırı → mini app trade objesi. */
function normalizeBirdeyeTrade(item, baseMint) {
  if (!item) return null;
  let side = String(item.side || '').toLowerCase();
  if (side === 'swap') return null;
  if (side !== 'buy' && side !== 'sell') {
    const txType = String(item.txType || '').toLowerCase();
    if (txType && txType !== 'swap') return null;
    side = 'buy';
  }
  const unix = Number(item.blockUnixTime);
  if (!unix) return null;
  const usd = Math.abs(
    parseFloat(item.volumeUSD)
      || parseFloat(item.volumeUsd)
      || parseFloat(item.tradeVolumeUsd)
      || 0,
  );
  const txHash = item.txHash || item.signature || null;
  const at = new Date(unix * 1000).toISOString();
  const amount = tradeAmountFromLegs(item, side, baseMint);

  return {
    id: txHash || `be-${unix}-${item.owner || ''}`,
    side,
    usd,
    usdFmt: usd >= 1 ? fmtUsd(usd) : usd > 0 ? fmtPriceUsd(usd) : '—',
    amount,
    priceUsd: parseFloat(item.tokenPrice) || parseFloat(item.pricePair) || null,
    wallet: shortAddr(item.owner),
    txHash,
    at,
    updatedAt: at,
    ago: timeAgoFromUnix(unix),
    source: 'birdeye',
  };
}

async function fetchTokenTrades(mint, limit = 50) {
  if (!mint || !isBirdeyeEnabled()) return [];
  const { data, status } = await http.get(`${BIRDEYE_BASE}/defi/txs/token`, {
    params: {
      address: mint,
      limit: Math.min(limit, 50),
      tx_type: 'swap',
      sort_type: 'desc',
    },
    headers: birdeyeHeaders(),
    validateStatus: () => true,
  });
  if (status !== 200 || !data?.success) return [];
  const items = data?.data?.items || [];
  return items
    .map((row) => normalizeBirdeyeTrade(row, mint))
    .filter(Boolean)
    .slice(0, limit);
}

function publicConfig() {
  const key = getApiKey();
  return {
    enabled: !!key,
    wsUrl: 'wss://public-api.birdeye.so/socket/solana',
    hasApiKey: !!key,
    apiKey: key,
  };
}

module.exports = {
  isBirdeyeEnabled,
  getApiKey,
  birdeyeType,
  ohlcvCacheMs,
  fetchOhlcvByMint,
  fetchTokenTrades,
  normalizeBirdeyeTrade,
  publicConfig,
};
