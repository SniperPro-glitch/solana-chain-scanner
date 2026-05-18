// Trending — 24s hacme göre büyükten küçüğe sıralama.

/**
 * @param {Array<{ volume24h?: number, postedAt?: number }>} items
 */
function sortByVolume24hDesc(items) {
  return [...items].sort((a, b) => {
    const va = Number(a.volume24h) || 0;
    const vb = Number(b.volume24h) || 0;
    if (vb !== va) return vb - va;
    return (Number(b.postedAt) || 0) - (Number(a.postedAt) || 0);
  });
}

function applyRanks(items) {
  return items.map((it, i) => ({ ...it, rank: i + 1 }));
}

/**
 * @param {Array<object>} items — feed satırları (volume24h dolu)
 */
function rankFeedByVolume(items) {
  return applyRanks(sortByVolume24hDesc(items));
}

/**
 * Yatay trending şeridi (en yüksek hacimli tokenler).
 */
function buildTrendingTicker(items, limit = 12) {
  return sortByVolume24hDesc(items)
    .slice(0, limit)
    .map((it) => ({
      mint: it.mint,
      symbol: it.symbol || '?',
      change24h: it.change24h,
      volume24hFmt: it.volume24hFmt || '—',
      priceUsdFmt: it.priceUsdFmt || '—',
      reportId: it.reportId || null,
    }));
}

module.exports = {
  sortByVolume24hDesc,
  rankFeedByVolume,
  buildTrendingTicker,
};
