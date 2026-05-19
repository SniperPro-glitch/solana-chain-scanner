// Uygulama içi token araması — bot kanal listesi (+ isteğe bağlı DexScreener).

const botFeedStore = require('./botFeedStore');
const miniAppFeed = require('./miniAppFeed');
const { normalizeSearchQ, itemMatchesSearch } = require('./multiChainFeed');
const { searchDexPairs, normalizeDexPair } = require('./chains/dexscreenerPair');
const solana = require('./chains/solana');

function searchScore(it, qLower) {
  const sym = String(it.symbol || '').toLowerCase();
  const name = String(it.name || it.fullName || '').toLowerCase();
  const mint = String(it.mint || '').toLowerCase();
  const pair = String(it.pairLabel || '').toLowerCase();

  if (mint === qLower || mint.startsWith(qLower)) return 950;
  if (sym === qLower) return 1000;
  if (sym.startsWith(qLower)) return 900 - Math.min(sym.length, 40);
  if (name.startsWith(qLower)) return 850;
  if (sym.includes(qLower)) return 600;
  if (name.includes(qLower)) return 550;
  if (pair.includes(qLower)) return 500;
  if (mint.includes(qLower)) return 400;
  return 0;
}

function auditFromEntry(entry) {
  if (!entry) return null;
  return {
    isCritical: entry.isCritical,
    risk: { code: entry.riskCode || 'LOW' },
    riskPercent: entry.riskPercent,
  };
}

async function buildItemsFromBotEntries(entries) {
  const items = [];
  for (const entry of entries) {
    const token = entry?.token;
    if (!token?.tokenAddress) continue;
    let audit = null;
    if (entry.reportId) {
      try {
        const reportStore = require('./reportStore');
        const meta = reportStore.getReportMeta(entry.reportId);
        if (meta.status === 'ok') audit = meta.report.audit;
      } catch {
        /* yoksay */
      }
    }
    if (!audit) {
      audit = auditFromEntry(entry);
      if (!audit) {
        try {
          audit = solana.auditToken(token);
        } catch {
          audit = { risk: { code: 'MEDIUM' }, riskPercent: 55 };
        }
      }
    }
    const item = miniAppFeed.tokenToFeedItem(token, audit, 0, entry.reportId);
    item.postedAt = entry.postedAt;
    item.chain = 'solana';
    items.push(item);
  }
  return items;
}

async function searchSolanaCatalog(q, limit = 40) {
  const qLower = normalizeSearchQ(q);
  if (!qLower || qLower.length < 1) return [];

  const entries = await botFeedStore.listAllAsync();
  const items = await buildItemsFromBotEntries(entries);

  const ranked = items
    .map((it) => ({ it, score: searchScore(it, qLower) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.it.volume24h || 0) - (a.it.volume24h || 0);
    })
    .slice(0, limit)
    .map((x, i) => ({ ...x.it, rank: i + 1 }));

  return ranked;
}

async function searchDexChain(chainKey, q, limit) {
  const pairs = await searchDexPairs(chainKey, q, limit);
  return pairs
    .map((p, i) => {
      const token = normalizeDexPair(p, chainKey);
      if (!token) return null;
      let audit = { risk: { code: 'MEDIUM' }, riskPercent: 55 };
      if (chainKey === 'solana') {
        try {
          audit = solana.auditToken(token) || audit;
        } catch {
          /* yoksay */
        }
      }
      const item = miniAppFeed.tokenToFeedItem(token, audit, i + 1, null);
      item.chain = chainKey;
      item.dexPageUrl = token.dexScreener?.url || null;
      item.source = 'dexscreener';
      return item;
    })
    .filter(Boolean);
}

async function searchListedTokens(q, limit = 40, chain = 'all') {
  const qTrim = String(q || '').trim();
  const chainKey = String(chain || 'all').toLowerCase();
  const cap = Math.min(50, Math.max(1, limit));

  if (!qTrim) {
    return { items: [], query: '', chain: chainKey, total: 0 };
  }

  if (chainKey !== 'solana' && chainKey !== 'all') {
    return {
      items: [],
      query: qTrim,
      chain: chainKey,
      total: 0,
      source: 'app_catalog',
      emptyMessage: 'Arama yalnızca Solana bot listesinde.',
    };
  }

  const items = await searchSolanaCatalog(qTrim, cap);
  return {
    items,
    query: qTrim,
    chain: 'solana',
    total: items.length,
    source: 'app_catalog',
  };
}

module.exports = {
  searchListedTokens,
  searchSolanaCatalog,
};
