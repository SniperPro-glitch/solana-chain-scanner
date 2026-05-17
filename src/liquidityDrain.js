// Likidite çekildi (rug) — izleme döngüsü ile aynı eşikler.

const DRAINED_ABSOLUTE_USD = 50;
const DRAINED_RATIO = 0.05;

function isLiquidityDrained(token, opts = {}) {
  const current = Number(
    opts.currentLiquidity ?? token?.liquidityUsd ?? token?.lastLiquidity ?? 0,
  );
  const initial = Number(
    opts.initialLiquidity ?? token?.initialLiquidity ?? 0,
  );
  if (current < DRAINED_ABSOLUTE_USD) return true;
  if (initial > 0 && current < initial * DRAINED_RATIO) return true;
  return false;
}

module.exports = {
  isLiquidityDrained,
  DRAINED_ABSOLUTE_USD,
  DRAINED_RATIO,
};
