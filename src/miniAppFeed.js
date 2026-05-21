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

/** New Pairs sekmesi — DEX çift oluşturma zamanına göre (kanala eklenme değil). */
const NEW_PAIRS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const NEW_PAIRS_MAX_AGE_HOURS = 48;

/** Çiftin DEX'te listelendiği an (ms). Yoksa null — New Pairs'e alınmaz. */
function getPairListedAtMs(token) {
  if (!token) return null;
  const raw = token.pairCreatedAt ?? token.createdAt;
  if (raw == null) return null;
  if (typeof raw === 'number' && raw > 0) return raw;
  const t = new Date(raw).getTime();
  return t > 0 ? t : null;
}

function isWithinNewPairsWindowMs(listedAtMs, now = Date.now()) {
  if (!listedAtMs) return false;
  return now - listedAtMs < NEW_PAIRS_MAX_AGE_MS;
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
    symbol: (token.tokenSymbol || token.symbol || '?').toString().toUpperCase(),
    name: token.tokenName || token.name || '',
    imageUrl,
    imageFallbacks,
    pairLabel: token.poolName || `${token.tokenSymbol}/SOL`,
    dex: token.dex,
    dexPlatform: plat.key,
    dexLabel: plat.label,
    dexShort: plat.short,
    dexAppUrl: reportId ? require('./miniAppServer').buildWebAppUrl(reportId) : null,
    dexUrl: token.dexScreener?.url || null,
    dexPageUrl: token.dexScreener?.url || null,
    poolAddress: token.poolAddress || null,
    priceUsd: token.priceUsd,
    priceUsdFmt: fmtPriceUsd(token.priceUsd),
    change24h: token.priceChange24h,
    change6h: token.priceChange6h,
    change1h: token.priceChange1h,
    change5m: token.priceChange5m,
    marketCapUsdFmt: fmtUsd(token.marketCapUsd || token.fdvUsd),
    liquidityUsd: Number(token.liquidityUsd) || 0,
    liquidityUsdFmt: fmtUsd(token.liquidityUsd),
    volume24h: Number(token.volume24h) || 0,
    volume24hFmt: fmtUsd(token.volume24h),
    volume6h: Number(token.volume6h) || 0,
    volume6hFmt: fmtUsd(token.volume6h),
    volume1h: Number(token.volume1h) || 0,
    volume1hFmt: fmtUsd(token.volume1h),
    volume5m: Number(token.volume5m) || 0,
    volume5mFmt: fmtUsd(token.volume5m),
    marketCapUsd: Number(token.marketCapUsd || token.fdvUsd) || 0,
    ageMinutes: token.ageMinutes ?? null,
    txns24h: (Number(token.buys24h) || 0) + (Number(token.sells24h) || 0),
    buys5m: Number(token.buys5m) || 0,
    sells5m: Number(token.sells5m) || 0,
    buys1h: Number(token.buys1h) || 0,
    sells1h: Number(token.sells1h) || 0,
    risk,
    trustScore: safe,
    level: cardLevelFromAudit(audit),
    postedAt: null,
    listedAt: null,
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
  const isNewTab = tab === 'new';
  const fetchLimit = isNewTab ? 400 : limit;
  const now = Date.now();
  const entries = await botFeedStore.listRecentAsync(fetchLimit, tab);
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
  let items = [];
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

    const listedAt = getPairListedAtMs(token) ?? getPairListedAtMs(entry.token);
    if (isNewTab && !isWithinNewPairsWindowMs(listedAt, now)) continue;

    const item = tokenToFeedItem(token, audit, rank, entry.reportId);
    item.postedAt = entry.postedAt;
    item.listedAt = listedAt;
    item.ageFmt = ageFmtForToken(token, listedAt);
    item.txns24hFmt = item.txns24h > 0 ? String(item.txns24h) : '—';
    item.channelTitle = entry.channelTitle;
    items.push(item);
    rank += 1;
  }

  // ≤48s DEX listelemesi yalnızca New Pairs sekmesinde; Trending/Home'da gösterme.
  if (!isNewTab) {
    items = items.filter((it) => !isWithinNewPairsWindowMs(it.listedAt, now));
  }

  const { loadConfig } = require('./trendConfigStore');
  const trendCfg = loadConfig();

  function applyTrendViewFilters(list) {
    let out = list;
    const minVol = Number(trendCfg.view?.minVolumeUsd) || 0;
    if (minVol > 0) {
      out = out.filter((it) => (Number(it.volume24h) || 0) >= minVol);
    }
    if (trendCfg.view?.hideHighRisk) {
      out = out.filter((it) => {
        const band = it.risk?.band || it.level;
        return band !== 'high' && it.level !== 'red' && it.level !== 'critical';
      });
    }
    return out;
  }

  let ranked = applyTrendViewFilters(items);
  if (tab === 'trending') {
    let trendItems = ranked;
    if (trendCfg.ticker?.minVolumeUsd > 0) {
      trendItems = trendItems.filter(
        (it) => (Number(it.volume24h) || 0) >= trendCfg.ticker.minVolumeUsd,
      );
    }
    ranked = rankFeedByVolume(trendItems, trendCfg.weights);
  } else if (tab === 'home') {
    ranked = [...ranked]
      .sort((a, b) => (Number(b.marketCapUsd) || 0) - (Number(a.marketCapUsd) || 0))
      .map((it, i) => ({ ...it, rank: i + 1 }));
  } else {
    ranked = ranked
      .sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0))
      .map((it, i) => ({ ...it, rank: i + 1 }));
  }

  const dexCounts = countByPlatform(ranked, (it) => it.dexPlatform);
  if (dexFilter && dexFilter !== 'all') {
    ranked = ranked.filter((it) => matchesDexFilter(it.dexPlatform, dexFilter));
    ranked = ranked.map((it, i) => ({ ...it, rank: i + 1 }));
  }

  const finalItems = ranked;
  const feedSource = 'bot_channel';

  let newPairs = 0;
  for (let i = 0; i < entries.length; i++) {
    const listedAt = getPairListedAtMs(tokens[i]) ?? getPairListedAtMs(entries[i].token);
    if (isWithinNewPairsWindowMs(listedAt, now)) newPairs += 1;
  }
  if (isNewTab) newPairs = finalItems.length;
  const volFromTokens = finalItems.reduce((s, it) => s + (it.volume24h || 0), 0);
  const dexCountsFinal = countByPlatform(finalItems, (it) => it.dexPlatform);

  return {
    tab,
    source: feedSource,
    sortMode: tab === 'new' ? 'listedAt_desc' : tab === 'home' ? 'marketCap_desc' : 'volume24h_desc',
    updatedAt: Date.now(),
    botCount: await botFeedStore.feedCountAsync(),
    promo: getPromoBanner(),
    trendingTicker: (() => {
      const { loadConfig } = require('./trendConfigStore');
      const tc = loadConfig();
      if (!tc.ticker?.enabled) return [];
      return buildTrendingTicker(finalItems, tc.ticker.limit, tc.ticker.minVolumeUsd);
    })(),
    dexFilter: dexFilter || 'all',
    dexPlatforms: listPlatformsForUi(),
    dexCounts: dexCountsFinal,
    stats: {
      count: finalItems.length,
      volume24hFmt: fmtUsd(volFromTokens),
      liquidityFmt: fmtUsd(finalItems.reduce((s, it) => s + (it.liquidityUsd || 0), 0)),
      newPairs,
      activeNow: finalItems.length,
    },
    items: finalItems,
    empty: finalItems.length === 0,
    emptyKind: isNewTab && finalItems.length === 0 ? 'new_pairs_empty' : 'generic',
    previewDemo: false,
    emptyMessage: finalItems.length === 0
      ? (isNewTab
        ? null
        : 'Henüz kanal paylaşımı yok. Bot kanala admin ekleyin, /settings ile Solana seçin, SOLANA_SCAN_ENABLED=1 yapın.')
      : null,
    newPairsWindowHours: NEW_PAIRS_MAX_AGE_HOURS,
    devSeed: false,
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
  getPairListedAtMs,
  isWithinNewPairsWindowMs,
  ageFmtForToken,
  NEW_PAIRS_MAX_AGE_MS,
  NEW_PAIRS_MAX_AGE_HOURS,
};
