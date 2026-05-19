// Mini App — liste yalnızca botun kanala paylaştığı tokenler.

const adapter = require('./chains/solana/adapter');
const solana = require('./chains/solana');
const reportStore = require('./reportStore');
const botFeedStore = require('./botFeedStore');
const { getPromoBanner } = require('./miniAppPromo');
const { rankFeedByVolume, buildTrendingTicker } = require('./trendingEngine');
const {
  resolveDexPlatform,
  matchesDexFilter,
  countByPlatform,
  listPlatformsForUi,
} = require('./dexPlatform');
const { safetyPercent } = require('./riskDisplay');
const { buildMarketFromToken } = require('./marketData');
const { buildLogoCandidates } = require('./tokenLogo');

const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

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

function auditFromFeedEntry(entry) {
  if (!entry) return null;
  return {
    isCritical: entry.isCritical,
    risk: { code: entry.riskCode || 'LOW' },
    riskPercent: entry.riskPercent,
  };
}

function quickAudit(token) {
  try {
    return solana.auditToken(token);
  } catch {
    return null;
  }
}

function formatAgeMinutes(mins) {
  const m = Math.max(0, Math.floor(Number(mins) || 0));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  if (m < 43200) return `${Math.floor(m / 1440)}d`;
  return `${Math.floor(m / 43200)}mo`;
}

function ageFmtForToken(token, postedAt = null) {
  if (postedAt) return formatAgeMinutes((Date.now() - postedAt) / 60000);
  if (token?.ageMinutes != null) return formatAgeMinutes(token.ageMinutes);
  if (token?.createdAt) {
    const t = new Date(token.createdAt).getTime();
    if (t) return formatAgeMinutes((Date.now() - t) / 60000);
  }
  return '—';
}

function tokenToFeedItem(token, audit, rank, reportId = null) {
  const risk = riskBandFromAudit(audit);
  const safe = audit ? safetyPercent(audit.riskPercent) : null;
  const candidates = buildLogoCandidates(token, null);
  const imageUrl = token.tokenImage || candidates[0] || null;
  const imageFallbacks = candidates.filter((u) => u !== imageUrl).slice(0, 4);
  const plat = resolveDexPlatform(token.dex, token.tokenAddress);
  return {
    rank,
    mint: token.tokenAddress,
    poolId: token.poolId,
    reportId,
    symbol: token.tokenSymbol,
    name: token.tokenName,
    imageUrl,
    imageFallbacks,
    pairLabel: token.poolName || `${token.tokenSymbol}/SOL`,
    dex: token.dex,
    dexPlatform: plat.key,
    dexLabel: plat.label,
    dexShort: plat.short,
    dexAppUrl: reportId ? require('./miniAppServer').buildWebAppUrl(reportId) : null,
    priceUsd: token.priceUsd,
    priceUsdFmt: fmtPriceUsd(token.priceUsd),
    change24h: token.priceChange24h,
    change1h: token.priceChange1h,
    marketCapUsdFmt: fmtUsd(token.marketCapUsd || token.fdvUsd),
    liquidityUsd: Number(token.liquidityUsd) || 0,
    liquidityUsdFmt: fmtUsd(token.liquidityUsd),
    volume24h: Number(token.volume24h) || 0,
    volume24hFmt: fmtUsd(token.volume24h),
    marketCapUsd: Number(token.marketCapUsd || token.fdvUsd) || 0,
    ageMinutes: token.ageMinutes ?? null,
    txns24h: (Number(token.buys24h) || 0) + (Number(token.sells24h) || 0),
    risk,
    trustScore: safe,
    level: cardLevelFromAudit(audit),
    postedAt: null,
  };
}

async function refreshTokenFromDex(storedToken) {
  try {
    const pair = await adapter.fetchTopPairForToken(storedToken.tokenAddress);
    if (pair) return adapter.normalizePair(pair);
  } catch {
    /* yedek snapshot */
  }
  return storedToken;
}

function tokenSnapshotUsable(token) {
  return token?.tokenAddress && (Number(token.priceUsd) > 0 || Number(token.volume24h) > 0);
}

async function buildFeedFromBotShares(tab = 'trending', limit = 24, dexFilter = 'all') {
  const entries = await botFeedStore.listRecentAsync(limit, tab);
  const tokens = await Promise.all(
    entries.map(async (entry) => {
      const snap = entry.token;
      if (tokenSnapshotUsable(snap)) return snap;
      try {
        const live = await refreshTokenFromDex(snap);
        return live || snap;
      } catch {
        return snap;
      }
    }),
  );
  const items = [];
  let rank = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let token = tokens[i];
    if (!token?.tokenAddress) token = entry.token;
    token = { ...token, chain: 'solana' };

    let audit = null;
    if (entry.reportId) {
      const meta = reportStore.getReportMeta(entry.reportId);
      if (meta.status === 'ok') audit = meta.report.audit;
    }
    if (!audit) audit = auditFromFeedEntry(entry) || quickAudit(token);

    const item = tokenToFeedItem(token, audit, rank, entry.reportId);
    item.postedAt = entry.postedAt;
    item.ageFmt = ageFmtForToken(token, entry.postedAt);
    item.txns24hFmt = item.txns24h > 0 ? String(item.txns24h) : '—';
    item.channelTitle = entry.channelTitle;
    items.push(item);
    rank += 1;
  }

  let ranked = items;
  if (tab === 'trending') {
    ranked = rankFeedByVolume(items);
  } else {
    ranked = items
      .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))
      .map((it, i) => ({ ...it, rank: i + 1 }));
  }

  const dexCounts = countByPlatform(ranked, (it) => it.dexPlatform);
  if (dexFilter && dexFilter !== 'all') {
    ranked = ranked.filter((it) => matchesDexFilter(it.dexPlatform, dexFilter));
    ranked = ranked.map((it, i) => ({ ...it, rank: i + 1 }));
  }

  const now = Date.now();
  const newPairs = entries.filter((e) => now - (e.postedAt || 0) < 2 * 60 * 60 * 1000).length;
  const volFromTokens = ranked.reduce((s, it) => s + (it.volume24h || 0), 0);

  return {
    tab,
    source: 'bot_channel',
    sortMode: tab === 'new' ? 'postedAt_desc' : 'volume24h_desc',
    updatedAt: Date.now(),
    botCount: await botFeedStore.feedCountAsync(),
    promo: getPromoBanner(),
    trendingTicker: buildTrendingTicker(ranked, 14),
    dexFilter: dexFilter || 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts,
    stats: {
      count: items.length,
      volume24hFmt: fmtUsd(volFromTokens),
      liquidityFmt: fmtUsd(entries.reduce((s, e) => s + (e.token?.liquidityUsd || 0), 0)),
      newPairs,
      activeNow: ranked.length,
    },
    items: ranked,
    empty: ranked.length === 0,
    emptyMessage: ranked.length === 0
      ? 'Henüz kanal paylaşımı yok. Bot kanala admin ekleyin, /settings ile Solana seçin, SOLANA_SCAN_ENABLED=1 yapın.'
      : null,
  };
}

async function buildFeed(tab = 'trending', limit = 24, dexFilter = 'all') {
  return buildFeedFromBotShares(tab, limit, dexFilter);
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
  const reportId = await reportStore.saveReportAsync({ token, audit, lang, level });

  return {
    reportId,
    level,
    symbol: token.tokenSymbol,
    preview: buildMarketFromToken(token),
  };
}

module.exports = {
  buildFeed,
  buildFeedFromBotShares,
  analyzeMintAndSave,
  tokenToFeedItem,
};
