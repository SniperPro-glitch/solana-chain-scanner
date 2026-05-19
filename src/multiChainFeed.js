// Mini App feed — Solana (bot) + TON / BSC / ETH (DexScreener).

const miniAppFeed = require('./miniAppFeed');
const { discoverDexPairs, searchDexPairs, normalizeDexPair } = require('./chains/dexscreenerPair');
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
  const parts = [it.symbol, it.mint, it.pairLabel, it.name, it.fullName, it.dexLabel]
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
  item.chain = chainKey;
  item.dexPageUrl = token.dexScreener?.url || null;
  item.source = 'dexscreener';
  return item;
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
  const chainKey = String(chain || 'solana').toLowerCase();
  const q = String(searchQ || '').trim();

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

  if (chainKey === 'solana') {
    const solTab = tab === 'home' ? 'trending' : tab;
    const feed = await miniAppFeed.buildFeedFromBotShares(solTab, limit, dexFilter);
    feed.chain = 'solana';
    feed.source = feed.source || 'bot_channel';

    if (q) {
      const qLower = normalizeSearchQ(q);
      let filtered = feed.items.filter((it) => itemMatchesSearch(it, qLower));

      const extraPairs = await searchDexPairs('solana', q, Math.max(limit, 24));
      const seen = new Set(filtered.map((it) => it.mint));
      for (const p of extraPairs) {
        const row = pairToFeedItem(p, 'solana', filtered.length + 1);
        if (!row || seen.has(row.mint)) continue;
        if (dexFilter !== 'all' && !matchesDexFilter(row.dexPlatform, dexFilter)) continue;
        seen.add(row.mint);
        filtered.push(row);
        if (filtered.length >= limit) break;
      }

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

  return buildDexChainFeed(chainKey, tab, limit, dexFilter, q);
}

module.exports = {
  buildFeed,
  buildDexChainFeed,
  LIVE_CHAINS,
};
