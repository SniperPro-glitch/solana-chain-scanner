// Birdeye — OHLCV + token trades (Dex ekranı grafik / işlem bandı).

const axios = require('axios');
const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const BIRDEYE_WS_RELAY_PATH = '/api/dex/ws/trades';
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
  const key = getApiKey();
  const h = { 'x-chain': 'solana' };
  if (key) h['x-api-key'] = key;
  return h;
}

/** WS: token mint ile işlem akışı (Birdeye dokümanı: SUBSCRIBE_TXS). */
function buildTradesSubscribeMessage(mint) {
  const address = String(mint || '').trim();
  const sub = String(process.env.BIRDEYE_WS_SUBSCRIBE || 'SUBSCRIBE_TXS').trim();
  const type = sub === 'SUBSCRIBE_TRANSACTION' ? 'SUBSCRIBE_TXS' : sub;
  return {
    type,
    data: {
      queryType: 'simple',
      address,
      txsType: 'swap',
    },
  };
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
  const params = { address: mint, type, currency: 'usd' };
  if (time_from && time_to) {
    params.time_from = time_from;
    params.time_to = time_to;
  }
  const { data, status } = await http.get(`${BIRDEYE_BASE}/defi/ohlcv`, {
    params,
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

function legAddress(leg) {
  return String(leg?.address || leg?.mint || '').toLowerCase();
}

function legUiAmount(leg) {
  if (!leg) return 0;
  const uiChange = parseFloat(leg.uiChangeAmount);
  if (Number.isFinite(uiChange) && uiChange !== 0) return Math.abs(uiChange);
  const ui = parseFloat(leg.uiAmount);
  if (Number.isFinite(ui) && ui !== 0) return Math.abs(ui);
  const scaledChange = parseFloat(leg.scaledUiChangeAmount);
  if (Number.isFinite(scaledChange) && scaledChange !== 0) return Math.abs(scaledChange);
  const scaled = parseFloat(leg.scaledUiAmount);
  if (Number.isFinite(scaled) && scaled !== 0) return Math.abs(scaled);
  const dec = parseInt(leg.decimals, 10);
  const change = parseFloat(leg.changeAmount);
  if (Number.isFinite(change) && change !== 0 && Number.isFinite(dec)) {
    return Math.abs(change) / 10 ** dec;
  }
  const amt = parseFloat(leg.amount);
  if (Number.isFinite(amt) && amt !== 0 && Number.isFinite(dec)) {
    return Math.abs(amt) / 10 ** dec;
  }
  return 0;
}

/** TXS_DATA / REST: izlenen mint'in token adedi (ui). */
function tradeAmountFromLegs(item, side, baseMint) {
  const mint = String(baseMint || item?.tokenAddress || '').trim().toLowerCase();
  if (!mint) return null;

  const legs = [item?.from, item?.to, item?.base, item?.quote].filter(Boolean);
  for (const leg of legs) {
    if (legAddress(leg) === mint) {
      const n = legUiAmount(leg);
      if (n > 0) return n;
    }
  }

  if (side === 'buy') {
    const n = legUiAmount(item?.to) || legUiAmount(item?.quote);
    if (n > 0) return n;
  }
  if (side === 'sell') {
    const n = legUiAmount(item?.from) || legUiAmount(item?.base);
    if (n > 0) return n;
  }

  const fallback = legUiAmount(item?.from) || legUiAmount(item?.to)
    || legUiAmount(item?.base) || legUiAmount(item?.quote);
  return fallback > 0 ? fallback : null;
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
    wsRelay: BIRDEYE_WS_RELAY_PATH,
    hasApiKey: !!key,
  };
}

module.exports = {
  BIRDEYE_WS_RELAY_PATH,
  isBirdeyeEnabled,
  getApiKey,
  birdeyeType,
  birdeyeHeaders,
  ohlcvCacheMs,
  fetchOhlcvByMint,
  fetchTokenTrades,
  normalizeBirdeyeTrade,
  buildTradesSubscribeMessage,
  publicConfig,
};
