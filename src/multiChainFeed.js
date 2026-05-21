// Mini App feed — liste yalnızca Solana bot kanalı paylaşımları (sc_feed).

const miniAppFeed = require('./miniAppFeed');
const {
  discoverDexPairs,
  discoverNewDexPairs,
  searchDexPairs,
  normalizeDexPair,
} = require('./chains/dexscreenerPair');
const { rankFeedByVolume, buildTrendingTicker } = require('./trendingEngine');
const { countByPlatform, listPlatformsForUi, matchesDexFilter } = require('./dexPlatform');
const { getPromoBanner } = require('./miniAppPromo');
const { fmtUsd } = require('./formatUsd');
const solana = require('./chains/solana');

const LIVE_CHAINS = new Set(['solana', 'ton', 'bsc', 'eth']);

function normalizeSearchQ(q) {
  return String(q || '').trim().toLowerCase().replace(/^\$/, '');
}

function itemMatchesSearch(it, qLower) {
  if (!qLower) return true;
  const parts = [it.symbol, it.tokenSymbol, it.mint, it.pairLabel, it.name, it.fullName, it.tokenName, it.dexLabel]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return parts.some((s) => s.includes(qLower));
}

function defaultAudit() {
  return {
    isCritical: false,
    risk: { code: 'MEDIUM' },
    riskPercent: 55,
  };
}

function pairToFeedItem(pair, chainKey, rank) {
  const token = normalizeDexPair(pair, chainKey);
  if (!token) return null;
  let audit = defaultAudit();
  if (chainKey === 'solana') {
    try {
      audit = solana.auditToken(token) || audit;
    } catch {
      /* varsayılan */
    }
  }
  const item = miniAppFeed.tokenToFeedItem(token, audit, rank, null);
  const listedAt = miniAppFeed.getPairListedAtMs(token);
  item.chain = chainKey;
  item.listedAt = listedAt;
  item.ageFmt = miniAppFeed.ageFmtForToken(token, listedAt);
  item.dexPageUrl = token.dexScreener?.url || null;
  item.source = 'dexscreener';
  return item;
}

function emptyNonSolanaFeed(chainKey) {
  const label = { ton: 'TON', bsc: 'BSC', eth: 'Ethereum' }[chainKey] || chainKey;
  return {
    tab: 'trending',
    chain: chainKey,
    source: 'app_catalog',
    sortMode: 'volume24h_desc',
    updatedAt: Date.now(),
    promo: getPromoBanner(),
    trendingTicker: [],
    dexFilter: 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts: { all: 0 },
    stats: { count: 0, volume24hFmt: '—', liquidityFmt: '—', newPairs: 0, activeNow: 0 },
    items: [],
    empty: true,
    emptyMessage: `${label} listesi henüz boş. Tokenler yalnızca Solana bot kanalına düştükçe burada görünür.`,
  };
}

async function buildDexChainNewPairsFeed(chainKey, limit = 48) {
  const pairs = await discoverNewDexPairs(chainKey, Math.min(80, limit * 3));
  const now = Date.now();
  let items = [];
  for (const p of pairs) {
    const it = pairToFeedItem(p, chainKey, 0);
    if (!it?.listedAt || !miniAppFeed.isWithinNewPairsWindowMs(it.listedAt, now)) continue;
    items.push(it);
  }
  items.sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));
  items = items.slice(0, limit).map((it, i) => ({ ...it, rank: i + 1 }));

  const vol = items.reduce((s, it) => s + (it.volume24h || 0), 0);
  const label = { ton: 'TON', bsc: 'BSC', eth: 'Ethereum', solana: 'Solana' }[chainKey] || chainKey;

  return {
    tab: 'new',
    chain: chainKey,
    source: 'dexscreener',
    sortMode: 'listedAt_desc',
    updatedAt: Date.now(),
    promo: getPromoBanner(),
    trendingTicker: [],
    dexFilter: 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts: { all: items.length },
    stats: {
      count: items.length,
      volume24hFmt: fmtUsd(vol),
      liquidityFmt: fmtUsd(items.reduce((s, it) => s + (it.liquidityUsd || 0), 0)),
      newPairs: items.length,
      activeNow: items.length,
    },
    items,
    empty: items.length === 0,
    emptyKind: items.length === 0 ? 'new_pairs_empty' : undefined,
    emptyMessage: items.length === 0 ? null : null,
    previewDemo: false,
    devSeed: false,
    newPairsWindowHours: miniAppFeed.NEW_PAIRS_MAX_AGE_HOURS,
    emptyHint:
      items.length === 0
        ? `${label} · Son 48 saatte yeni DEX listelemesi yok`
        : `${label} · DexScreener yeni listelemeler`,
  };
}

async function buildAllChainsNewPairsFeed(limit = 48) {
  const chains = ['solana', 'ton', 'bsc', 'eth'];
  let merged = [];
  const seenMint = new Set();
  for (const c of chains) {
    try {
      const part =
        c === 'solana'
          ? await miniAppFeed.buildFeedFromBotShares('new', limit, 'all')
          : await buildDexChainNewPairsFeed(c, limit);
      for (const it of part.items || []) {
        const row = { ...it, chain: it.chain || c };
        if (!row.mint || seenMint.has(row.mint)) continue;
        seenMint.add(row.mint);
        merged.push(row);
      }
    } catch (e) {
      console.warn(`[feed/new/all] ${c}:`, e.message);
    }
  }
  merged = merged
    .filter((it) => it.listedAt && miniAppFeed.isWithinNewPairsWindowMs(it.listedAt))
    .sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0))
    .slice(0, limit)
    .map((it, i) => ({ ...it, rank: i + 1 }));

  const vol = merged.reduce((s, it) => s + (it.volume24h || 0), 0);
  return {
    tab: 'new',
    chain: 'all',
    source: 'multi_chain',
    sortMode: 'listedAt_desc',
    updatedAt: Date.now(),
    promo: getPromoBanner(),
    trendingTicker: [],
    dexFilter: 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts: { all: merged.length },
    stats: {
      count: merged.length,
      volume24hFmt: fmtUsd(vol),
      liquidityFmt: fmtUsd(merged.reduce((s, it) => s + (it.liquidityUsd || 0), 0)),
      newPairs: merged.length,
      activeNow: merged.length,
    },
    items: merged,
    empty: merged.length === 0,
    emptyKind: merged.length === 0 ? 'new_pairs_empty' : undefined,
    emptyMessage: null,
    previewDemo: false,
    devSeed: false,
    newPairsWindowHours: miniAppFeed.NEW_PAIRS_MAX_AGE_HOURS,
  };
}

async function buildDexChainFeed(chainKey, tab = 'trending', limit = 24, dexFilter = 'all', searchQ = '') {
  const q = String(searchQ || '').trim();
  let pairs = q
    ? await searchDexPairs(chainKey, q, Math.min(40, limit + 8))
    : await discoverDexPairs(chainKey, Math.min(40, limit + 8));

  let items = pairs
    .map((p, i) => pairToFeedItem(p, chainKey, i + 1))
    .filter(Boolean);

  if (tab === 'trending') {
    items = rankFeedByVolume(items);
  }

  if (dexFilter && dexFilter !== 'all' && chainKey === 'solana') {
    items = items.filter((it) => matchesDexFilter(it.dexPlatform, dexFilter));
  }

  items = items.slice(0, limit).map((it, i) => ({ ...it, rank: i + 1 }));

  const dexCounts = countByPlatform(items, (it) => it.dexPlatform);
  const vol = items.reduce((s, it) => s + (it.volume24h || 0), 0);

  return {
    tab,
    chain: chainKey,
    source: 'dexscreener',
    searchQuery: q || null,
    sortMode: tab === 'new' ? 'postedAt_desc' : 'volume24h_desc',
    updatedAt: Date.now(),
    promo: getPromoBanner(),
    trendingTicker: buildTrendingTicker(items, 14),
    dexFilter: chainKey === 'solana' ? (dexFilter || 'all') : 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts,
    stats: {
      count: items.length,
      volume24hFmt: fmtUsd(vol),
      liquidityFmt: fmtUsd(
        pairs.reduce((s, p) => s + (parseFloat(p.liquidity?.usd) || 0), 0),
      ),
      newPairs: items.length,
      activeNow: items.length,
    },
    items,
    empty: items.length === 0,
    emptyMessage: q
      ? 'Bu token bu ağ listesinde bulunamadı.'
      : 'DexScreener verisi alınamadı — tekrar deneyin.',
  };
}

async function buildFeed(tab = 'trending', limit = 24, dexFilter = 'all', chain = 'solana', searchQ = '') {
  let chainKey = String(chain || 'solana').toLowerCase();
  const q = String(searchQ || '').trim();
  const apiTab = tab === 'new' ? 'new' : tab === 'home' ? 'home' : 'trending';

  if (apiTab === 'new' && chainKey === 'all') {
    return buildAllChainsNewPairsFeed(limit);
  }

  if (chainKey === 'all') chainKey = 'solana';

  if (!LIVE_CHAINS.has(chainKey)) {
    return {
      chain: chainKey,
      items: [],
      empty: true,
      emptyMessage: 'Bu ağ henüz desteklenmiyor.',
      stats: { count: 0, volume24hFmt: '—', liquidityFmt: '—', newPairs: 0, activeNow: 0 },
      promo: getPromoBanner(),
    };
  }

  if (chainKey !== 'solana') {
    if (apiTab === 'new') return buildDexChainNewPairsFeed(chainKey, limit);
    return emptyNonSolanaFeed(chainKey);
  }

  if (chainKey === 'solana') {
    const solTab = apiTab;
    const feed = await miniAppFeed.buildFeedFromBotShares(solTab, limit, dexFilter);
    feed.chain = 'solana';
    feed.source = feed.source || 'bot_channel';

    if (q) {
      const qLower = normalizeSearchQ(q);
      let filtered = feed.items.filter((it) => itemMatchesSearch(it, qLower));

      filtered.sort((a, b) => {
        const symA = String(a.symbol || '').toLowerCase();
        const symB = String(b.symbol || '').toLowerCase();
        const aExact = symA === qLower ? 1 : 0;
        const bExact = symB === qLower ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
        const aStart = symA.startsWith(qLower) ? 1 : 0;
        const bStart = symB.startsWith(qLower) ? 1 : 0;
        if (bStart !== aStart) return bStart - aStart;
        return (b.volume24h || 0) - (a.volume24h || 0);
      });

      feed.items = filtered.slice(0, limit).map((it, i) => ({ ...it, rank: i + 1 }));
      feed.searchQuery = q;
      feed.empty = feed.items.length === 0;
      feed.emptyMessage = feed.empty ? 'Bu token listemizde mevcut değil.' : null;
    }

    return feed;
  }

  return emptyNonSolanaFeed(chainKey);
}

module.exports = {
  buildFeed,
  buildDexChainFeed,
  LIVE_CHAINS,
  normalizeSearchQ,
  itemMatchesSearch,
};
