// Mini App — sabit test tokenları (gerçek mint; tıklanınca /api/open çalışır).

const solana = require('./chains/solana');
const { resolveTokenLogo } = require('./tokenLogo');

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

function seedEnabled() {
  return !['0', 'false', 'off', 'no'].includes(
    String(process.env.MINI_APP_SEED || '1').trim().toLowerCase(),
  );
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
        const logo = await resolveTokenLogo(token);
        return tokenToFeedItem(token, audit, 0, logo);
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
  buildSeedFeedItems,
  mergeFeedItems,
};
