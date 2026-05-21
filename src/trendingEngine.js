// Trending — ağırlıklı skor veya 24s hacim sıralaması.

function sortByVolume24hDesc(items) {
  return [...items].sort((a, b) => {
    const va = Number(a.volume24h) || 0;
    const vb = Number(b.volume24h) || 0;
    if (vb !== va) return vb - va;
    return (Number(b.postedAt) || 0) - (Number(a.postedAt) || 0);
  });
}

function normMap(items, pick) {
  const vals = items.map((it) => Math.max(0, Number(pick(it)) || 0));
  const max = Math.max(...vals, 1);
  return vals.map((v) => v / max);
}

/**
 * @param {Array<object>} items
 * @param {{ volume?: number, txns?: number, liquidity?: number, priceChange?: number }} weights — yüzde (toplam ~100)
 */
function sortByWeightedScore(items, weights = {}) {
  const w = {
    volume: Number(weights.volume) || 0,
    txns: Number(weights.txns) || 0,
    holders: Number(weights.holders ?? weights.liquidity) || 0,
    priceChange: Number(weights.priceChange) || 0,
  };
  const total = w.volume + w.txns + w.holders + w.priceChange;
  if (total <= 0) return sortByVolume24hDesc(items);

  const volN = normMap(items, (it) => it.volume24h);
  const txnN = normMap(items, (it) => it.txns24h);
  const holdN = normMap(items, (it) => it.liquidityUsd || it.holders);
  const chgN = normMap(items, (it) => Math.abs(Number(it.change24h) || 0));

  const scored = items.map((it, i) => {
    const score =
      (w.volume / total) * volN[i]
      + (w.txns / total) * txnN[i]
      + (w.holders / total) * holdN[i]
      + (w.priceChange / total) * chgN[i];
    return { it, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (Number(b.it.postedAt) || 0) - (Number(a.it.postedAt) || 0);
  });
  return scored.map((x) => x.it);
}

function applyRanks(items) {
  return items.map((it, i) => ({ ...it, rank: i + 1 }));
}

function rankFeedByVolume(items, weights = null) {
  const sorted = weights
    ? sortByWeightedScore(items, weights)
    : sortByVolume24hDesc(items);
  return applyRanks(sorted);
}

function buildTrendingTicker(items, limit = 12, minVolumeUsd = 0) {
  let list = items;
  if (minVolumeUsd > 0) {
    list = list.filter((it) => (Number(it.volume24h) || 0) >= minVolumeUsd);
  }
  return sortByVolume24hDesc(list)
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
  sortByWeightedScore,
  rankFeedByVolume,
  buildTrendingTicker,
};
