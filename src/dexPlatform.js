// Solana DEX platformları — DexScreener dexId → grup (Pump, Raydium, Meteora, …).

const PLATFORMS = [
  { key: 'all', label: 'Tümü', short: 'ALL' },
  { key: 'pumpfun', label: 'Pump.fun', short: 'PUMP' },
  { key: 'raydium', label: 'Raydium', short: 'RAY' },
  { key: 'meteora', label: 'Meteora', short: 'MET' },
  { key: 'orca', label: 'Orca', short: 'ORCA' },
  { key: 'other', label: 'Diğer', short: 'DEX' },
];

function isPumpMint(mint) {
  return String(mint || '').toLowerCase().endsWith('pump');
}

function isPumpDexId(dex) {
  const d = String(dex || '').toLowerCase();
  return d === 'pumpfun' || d === 'pumpswap' || d === 'pump';
}

/**
 * @returns {{ key: string, label: string, short: string, dexRaw: string }}
 */
function resolveDexPlatform(dexRaw, tokenAddress = null) {
  const d = String(dexRaw || '').toLowerCase().trim();
  const mint = tokenAddress || '';

  if (isPumpDexId(d) || isPumpMint(mint)) {
    const label = d === 'pumpswap' ? 'PumpSwap' : 'Pump.fun';
    return { key: 'pumpfun', label, short: 'PUMP', dexRaw: d || 'pumpfun' };
  }
  if (d.startsWith('raydium')) {
    const label = d.includes('clmm') ? 'Raydium CLMM' : 'Raydium';
    return { key: 'raydium', label, short: 'RAY', dexRaw: d };
  }
  if (d.startsWith('meteora')) {
    const label = d.includes('dlmm') ? 'Meteora DLMM' : 'Meteora';
    return { key: 'meteora', label, short: 'MET', dexRaw: d };
  }
  if (d === 'orca' || d.startsWith('orca')) {
    return { key: 'orca', label: 'Orca', short: 'ORCA', dexRaw: d };
  }
  if (d === 'lifinity' || d === 'phoenix' || d === 'openbook' || d === 'jupiter') {
    const labels = {
      lifinity: 'Lifinity',
      phoenix: 'Phoenix',
      openbook: 'OpenBook',
      jupiter: 'Jupiter',
    };
    return { key: 'other', label: labels[d] || d, short: 'DEX', dexRaw: d };
  }
  if (!d) {
    return { key: 'other', label: 'DEX', short: 'DEX', dexRaw: 'unknown' };
  }
  const pretty = d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { key: 'other', label: pretty, short: 'DEX', dexRaw: d };
}

function matchesDexFilter(platformKey, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  return platformKey === filterKey;
}

function countByPlatform(items, getKey = (it) => it.dexPlatform) {
  const counts = { all: items.length };
  for (const p of PLATFORMS) {
    if (p.key !== 'all') counts[p.key] = 0;
  }
  for (const it of items) {
    const k = typeof getKey === 'function' ? getKey(it) : it.dexPlatform;
    if (k && counts[k] != null) counts[k] += 1;
    else counts.other = (counts.other || 0) + 1;
  }
  return counts;
}

function listPlatformsForUi() {
  return PLATFORMS.filter((p) => p.key !== 'other');
}

module.exports = {
  PLATFORMS,
  resolveDexPlatform,
  matchesDexFilter,
  countByPlatform,
  listPlatformsForUi,
  isPumpDexId,
  isPumpMint,
};
