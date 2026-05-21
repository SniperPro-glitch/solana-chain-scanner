// Mini App — sabit test tokenları (gerçek mint; tıklanınca /api/open çalışır).

const solana = require('./chains/solana');

/** Popüler Solana mint'leri — feed'in üstünde ve boş listede yedek. */
const SEED_MINTS = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t1GHn2a4gyyg9WH', // POPCAT
  'JUPyiwrYJFskUPiHa7HPQc8J4iHmuxcKoCx8xNv4Sol', // JUP
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { items: [], at: 0 };

/** New Pairs önizleme — listedAt son 48 saat içinde. */
const NEW_PAIRS_PREVIEW_AGES_MIN = [8, 22, 95, 280, 610, 1200];

const STATIC_NEW_PAIRS_DEMO = [
  {
    symbol: 'BONK',
    mint: SEED_MINTS[0],
    dexPlatform: 'pumpfun',
    dexLabel: 'Pump.fun',
    risk: { band: 'low', label: 'LOW RISK' },
    marketCapUsdFmt: '$1.8B',
    liquidityUsdFmt: '$2.1M',
    volume24hFmt: '$4.2M',
    change24h: 8.4,
    mins: 8,
    hot: true,
  },
  {
    symbol: 'WIF',
    mint: SEED_MINTS[1],
    dexPlatform: 'raydium',
    dexLabel: 'Raydium',
    risk: { band: 'mid', label: 'MEDIUM RISK' },
    marketCapUsdFmt: '$890M',
    liquidityUsdFmt: '$1.4M',
    volume24hFmt: '$2.8M',
    change24h: -3.2,
    mins: 22,
  },
  {
    symbol: 'POPCAT',
    mint: SEED_MINTS[2],
    dexPlatform: 'pumpfun',
    dexLabel: 'Pump.fun',
    risk: { band: 'mid', label: 'MEDIUM RISK' },
    marketCapUsdFmt: '$420M',
    liquidityUsdFmt: '$680K',
    volume24hFmt: '$1.1M',
    change24h: 15.1,
    mins: 95,
  },
  {
    symbol: 'JUP',
    mint: SEED_MINTS[3],
    dexPlatform: 'orca',
    dexLabel: 'Orca',
    risk: { band: 'low', label: 'LOW RISK' },
    marketCapUsdFmt: '$1.2B',
    liquidityUsdFmt: '$3.2M',
    volume24hFmt: '$6.5M',
    change24h: 2.1,
    mins: 280,
  },
  {
    symbol: 'RAY',
    mint: SEED_MINTS[4],
    dexPlatform: 'raydium',
    dexLabel: 'Raydium',
    risk: { band: 'low', label: 'LOW RISK' },
    marketCapUsdFmt: '$1.5B',
    liquidityUsdFmt: '$5.8M',
    volume24hFmt: '$12M',
    change24h: 4.6,
    mins: 610,
  },
];

function seedEnabled() {
  return !['0', 'false', 'off', 'no'].includes(
    String(process.env.MINI_APP_SEED || '1').trim().toLowerCase(),
  );
}

/** New Pairs demo — MINI_APP_SEED=0 olsa da varsayılan açık; kapatmak için MINI_APP_NEW_PAIRS_PREVIEW=0. */
function newPairsPreviewEnabled() {
  const raw = process.env.MINI_APP_NEW_PAIRS_PREVIEW;
  if (raw === undefined || raw === '') return true;
  return !['0', 'false', 'off', 'no'].includes(String(raw).trim().toLowerCase());
}

function ageFmtFromListedAt(listedAt) {
  const m = Math.max(0, Math.floor((Date.now() - listedAt) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function buildStaticNewPairsDemoItems(limit = 6) {
  const now = Date.now();
  return STATIC_NEW_PAIRS_DEMO.slice(0, limit).map((d, i) => {
    const listedAt = now - d.mins * 60 * 1000;
    const hot = !!d.hot;
    return {
      rank: i + 1,
      mint: d.mint,
      symbol: d.symbol,
      name: d.symbol,
      chain: 'solana',
      pairLabel: `${d.symbol}/SOL`,
      dex: d.dexPlatform,
      dexPlatform: d.dexPlatform,
      dexLabel: d.dexLabel,
      dexShort: d.dexPlatform === 'pumpfun' ? 'PUMP' : d.dexPlatform === 'orca' ? 'ORCA' : 'RAY',
      listedAt,
      postedAt: listedAt,
      ageFmt: ageFmtFromListedAt(listedAt),
      marketCapUsdFmt: d.marketCapUsdFmt,
      liquidityUsdFmt: d.liquidityUsdFmt,
      volume24hFmt: d.volume24hFmt,
      volume24h: 1_000_000,
      change24h: d.change24h,
      priceUsdFmt: '$0.00',
      risk: d.risk,
      level: d.risk.band === 'high' ? 'red' : d.risk.band === 'mid' ? 'yellow' : 'green',
      buys5m: hot ? 18 : 4 + i,
      sells5m: hot ? 7 : 2 + i,
      buys1h: hot ? 52 : 20 + i * 3,
      sells1h: hot ? 19 : 8 + i,
      volume5m: hot ? 18500 : 2500 + i * 800,
      txns24hFmt: '120',
      imageUrl: null,
      imageFallbacks: [],
      source: 'dev_seed',
      preview: true,
    };
  });
}

function decorateNewPairsPreviewItem(item, listedAt, hot = false) {
  return {
    ...item,
    listedAt,
    postedAt: listedAt,
    ageFmt: ageFmtFromListedAt(listedAt),
    buys5m: hot ? 18 : Number(item.buys5m) || 4,
    sells5m: hot ? 7 : Number(item.sells5m) || 2,
    buys1h: hot ? 52 : Number(item.buys1h) || 24,
    sells1h: hot ? 19 : Number(item.sells1h) || 10,
    volume5m: hot ? 18500 : Number(item.volume5m) || 3000,
    source: item.source || 'dev_seed',
    preview: true,
  };
}

async function buildSeedFeedItems(tokenToFeedItem, quickAudit) {
  if (!seedEnabled()) return [];
  if (cache.items.length && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.items.map((it, i) => ({ ...it, rank: i + 1 }));
  }

  const items = [];
  const results = await Promise.all(
    SEED_MINTS.map(async (mint) => {
      try {
        const token = await solana.resolveTokenFromInput(mint);
        if (!token?.tokenAddress) return null;
        const audit = quickAudit(token);
        return tokenToFeedItem(token, audit, 0, null);
      } catch (e) {
        console.warn('[miniApp] seed', mint.slice(0, 8), e.message);
        return null;
      }
    }),
  );

  for (const item of results) {
    if (item) items.push(item);
  }

  cache = { items, at: Date.now() };
  console.log(`[miniApp] seed: ${items.length} test token yüklendi`);
  return items.map((it, i) => ({ ...it, rank: i + 1 }));
}

async function buildNewPairsSeedItems(tokenToFeedItem, quickAudit, limit = 6) {
  if (!newPairsPreviewEnabled()) return [];

  let base = [];
  if (seedEnabled()) {
    base = await buildSeedFeedItems(tokenToFeedItem, quickAudit);
  }
  if (!base.length) {
    base = buildStaticNewPairsDemoItems(limit);
    console.log(`[miniApp] new pairs preview: ${base.length} statik örnek (offline)`);
    return base;
  }

  const now = Date.now();
  const cap = Math.min(limit, base.length, NEW_PAIRS_PREVIEW_AGES_MIN.length);
  const items = [];

  for (let i = 0; i < cap; i++) {
    const listedAt = now - NEW_PAIRS_PREVIEW_AGES_MIN[i] * 60 * 1000;
    items.push(decorateNewPairsPreviewItem(base[i], listedAt, i === 0));
  }

  console.log(`[miniApp] new pairs preview: ${items.length} örnek token`);
  return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
}

/** Canlı listeye önizleme ekle (48h penceresi dışarıda kontrol edilir). */
function appendNewPairsPreview(finalItems, previewItems, maxTotal = 24) {
  const seen = new Set((finalItems || []).map((x) => x.mint));
  const merged = [...(finalItems || [])];
  for (const it of previewItems || []) {
    if (!it?.mint || seen.has(it.mint)) continue;
    seen.add(it.mint);
    merged.push(it);
    if (merged.length >= maxTotal) break;
  }
  return merged
    .sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

function mergeFeedItems(seedItems, liveItems, limit = 24) {
  const seen = new Set();
  const merged = [];

  for (const item of seedItems) {
    if (!item?.mint || seen.has(item.mint)) continue;
    seen.add(item.mint);
    merged.push({ ...item, rank: merged.length + 1 });
  }

  for (const item of liveItems) {
    if (!item?.mint || seen.has(item.mint)) continue;
    if (merged.length >= limit) break;
    seen.add(item.mint);
    merged.push({ ...item, rank: merged.length + 1 });
  }

  return merged.slice(0, limit);
}

module.exports = {
  SEED_MINTS,
  seedEnabled,
  newPairsPreviewEnabled,
  buildSeedFeedItems,
  buildNewPairsSeedItems,
  buildStaticNewPairsDemoItems,
  appendNewPairsPreview,
  mergeFeedItems,
};
