// Mini App — canlı token listesi + tıklanınca tam rapor.

const adapter = require('./chains/solana/adapter');
const solana = require('./chains/solana');
const reportStore = require('./reportStore');
const { safetyPercent } = require('./riskDisplay');
const { buildMarketFromToken } = require('./marketData');
const { tokenLogoUrl } = require('./tokenLogo');

function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const x = Number(n);
  if (x < 1_000) return `$${x.toFixed(2)}`;
  if (x < 1_000_000) return `$${(x / 1_000).toFixed(2)}K`;
  return `$${(x / 1_000_000).toFixed(2)}M`;
}

function cardLevelFromAudit(audit) {
  if (audit?.isCritical) return 'critical';
  if (audit?.risk?.code === 'HIGH') return 'red';
  if (audit?.risk?.code === 'MEDIUM') return 'yellow';
  return 'green';
}

function riskBandFromAudit(audit) {
  const code = audit?.risk?.code;
  if (audit?.isCritical || code === 'HIGH') return { band: 'high', label: 'HIGH RISK' };
  if (code === 'MEDIUM') return { band: 'mid', label: 'MEDIUM RISK' };
  return { band: 'low', label: 'LOW RISK' };
}

function quickAudit(token) {
  try {
    return solana.auditToken(token);
  } catch {
    return null;
  }
}

function tokenToFeedItem(token, audit, rank) {
  const risk = riskBandFromAudit(audit);
  const safe = audit ? safetyPercent(audit.riskPercent) : null;
  return {
    rank,
    mint: token.tokenAddress,
    poolId: token.poolId,
    symbol: token.tokenSymbol,
    name: token.tokenName,
    imageUrl: token.tokenImage || tokenLogoUrl(token),
    pairLabel: token.poolName || `${token.tokenSymbol}/SOL`,
    dex: token.dex,
    priceUsd: token.priceUsd,
    priceUsdFmt: fmtUsd(token.priceUsd),
    change24h: token.priceChange24h,
    change1h: token.priceChange1h,
    marketCapUsdFmt: fmtUsd(token.marketCapUsd || token.fdvUsd),
    liquidityUsdFmt: fmtUsd(token.liquidityUsd),
    volume24hFmt: fmtUsd(token.volume24h),
    risk,
    trustScore: safe,
    level: cardLevelFromAudit(audit),
  };
}

async function fetchRawPairs(tab = 'trending', limit = 24) {
  const pairs = await adapter.fetchPoolsHybrid();
  const tokens = [];
  for (const pair of pairs) {
    const token = adapter.normalizePair(pair);
    if (!token?.tokenAddress) continue;
    tokens.push(token);
  }

  if (tab === 'new') {
    tokens.sort((a, b) => (a.ageMinutes ?? 99999) - (b.ageMinutes ?? 99999));
  } else {
    tokens.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
  }

  return tokens.slice(0, limit);
}

async function buildFeed(tab = 'trending', limit = 24) {
  const raw = await fetchRawPairs(tab, limit);
  const items = [];
  let rank = 1;
  for (const token of raw) {
    const audit = quickAudit(token);
    items.push(tokenToFeedItem(token, audit, rank));
    rank += 1;
  }

  const totalVol = raw.reduce((s, t) => s + (t.volume24h || 0), 0);
  const totalLiq = raw.reduce((s, t) => s + (t.liquidityUsd || 0), 0);
  const newPairs = raw.filter((t) => (t.ageMinutes ?? 99999) < 120).length;
  return {
    tab,
    updatedAt: Date.now(),
    stats: {
      count: items.length,
      volume24hFmt: fmtUsd(totalVol),
      liquidityFmt: fmtUsd(totalLiq),
      newPairs,
      activeNow: items.length,
    },
    items,
  };
}

async function analyzeMintAndSave(mint, lang = 'tr') {
  const token = await solana.resolveTokenFromInput(mint);
  if (!token) {
    const err = new Error('not_found');
    err.code = 'not_found';
    throw err;
  }

  token.chain = 'solana';
  token.initialLiquidity = token.liquidityUsd || 0;

  const { ensureShareEnrichment } = require('./shareEnrich');
  await ensureShareEnrichment(token, 'solana').catch(() => {});

  const audit = solana.auditToken(token);
  const level = cardLevelFromAudit(audit);
  const reportId = reportStore.saveReport({ token, audit, lang, level });

  return {
    reportId,
    level,
    symbol: token.tokenSymbol,
    preview: buildMarketFromToken(token),
  };
}

module.exports = {
  buildFeed,
  analyzeMintAndSave,
  tokenToFeedItem,
};
