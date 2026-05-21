// Admin trend tablosu — feed + manuel kayıt birleşimi.

const adminTrendStore = require('./adminTrendStore');
const trendConfigStore = require('./trendConfigStore');

function riskLabel(item) {
  const code = String(item.riskCode || item.risk?.code || item.level || 'MED').toUpperCase();
  const pct = item.riskPercent != null ? Math.round(item.riskPercent) : (item.trustScore != null ? Math.round(item.trustScore) : null);
  return pct != null ? `${code} ${pct}` : code;
}

function riskLevel(item) {
  const code = String(item.riskCode || item.risk?.code || item.level || 'MED').toUpperCase();
  if (code === 'LOW' || code === 'SAFE') return 'LOW';
  if (code === 'HIGH' || code === 'CRITICAL' || code === 'SCAM') return 'HIGH';
  return 'MED';
}

function fmtChange(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(v >= 100 || v <= -100 ? 0 : 1)}%`;
}

function placeholderItem(mint) {
  return {
    mint,
    symbol: String(mint).slice(0, 4).toUpperCase(),
    pairLabel: '—',
    priceUsdFmt: '—',
    change24h: 0,
    volume24hFmt: '—',
    txns24hFmt: '—',
    risk: { code: 'MED' },
    trustScore: 50,
    chain: 'solana',
  };
}

/** Dex yenileme yok — admin tablo/arama için hızlı liste. */
async function buildFastFeedItems(limit = 80) {
  const botFeedStore = require('./botFeedStore');
  const reportStore = require('./reportStore');
  const { tokenToFeedItem } = require('./miniAppFeed');
  const { rankFeedByVolume } = require('./trendingEngine');
  const entries = await botFeedStore.listRecentAsync(limit, 'trending');
  const items = [];

  for (const entry of entries) {
    const token = entry?.token;
    if (!token?.tokenAddress) continue;
    let audit = null;
    if (entry.reportId) {
      try {
        const meta = reportStore.getReportMeta(entry.reportId);
        if (meta.status === 'ok') audit = meta.report.audit;
      } catch {
        /* yoksay */
      }
    }
    if (!audit) {
      try {
        const solana = require('./chains/solana');
        audit = solana.auditToken(token);
      } catch {
        audit = { risk: { code: 'MEDIUM' }, riskPercent: 55 };
      }
    }
    const item = tokenToFeedItem({ ...token, chain: 'solana' }, audit, items.length + 1, entry.reportId);
    items.push(item);
  }

  const cfg = trendConfigStore.loadConfig();
  return rankFeedByVolume(items, cfg.weights);
}

function itemToRow(item, opts = {}) {
  const hidden = opts.hidden;
  const source = opts.source || 'Otomatik';
  const rank = opts.rank;
  const isPinned = !!opts.is_pinned;
  const id = opts.id || item.mint;
  const rl = riskLevel(item);
  let status = 'Aktif';
  let statusColor = 'green';
  if (hidden) {
    status = 'Gizlendi';
    statusColor = 'red';
  } else if (rl === 'MED') {
    status = 'İzleniyor';
    statusColor = 'yellow';
  }

  const rankLabel = isPinned ? '📌' : (hidden ? '✕' : rank);

  return {
    id,
    token_id: item.mint,
    mint: item.mint,
    rank: rankLabel,
    rankNum: isPinned ? 0 : (Number(rank) || 99),
    is_pinned: isPinned,
    symbol: item.symbol || '?',
    pair: item.pairLabel || item.dexLabel || item.dex || '—',
    chain: item.chain || 'solana',
    chainLabel: '◎ SOL',
    price: item.priceUsdFmt || '—',
    change24h: fmtChange(item.change24h),
    change24hNum: Number(item.change24h) || 0,
    volume: item.volume24hFmt || '—',
    txns: item.txns24hFmt || item.txns24h || '—',
    risk: riskLabel(item),
    riskLevel: rl,
    source,
    status,
    statusColor,
    hidden: !!hidden,
    dexUrl: item.dexUrl || item.dexPageUrl || null,
    avatarLetter: (item.symbol || '?').charAt(0),
  };
}

async function buildTrendingTable({ timeframe = '24h', chain = 'all' } = {}) {
  const cfg = trendConfigStore.loadConfig();
  const limit = Math.max(cfg.defaults?.pageSize || 20, 20);
  const dexFilter = chain && chain !== 'all' ? String(chain).toLowerCase() : 'all';

  let items = await buildFastFeedItems(limit + 40);
  if (dexFilter && dexFilter !== 'all') {
    const { matchesDexFilter } = require('./dexPlatform');
    items = items.filter((it) => matchesDexFilter(it.dexPlatform, dexFilter));
  }

  if (cfg.view?.hideHighRisk) {
    items = items.filter((it) => riskLevel(it) !== 'HIGH');
  }
  const minVol = cfg.view?.minVolumeUsd ?? cfg.ticker?.minVolumeUsd ?? 0;
  if (minVol > 0) {
    items = items.filter((it) => (Number(it.volume24h) || 0) >= minVol);
  }

  const hiddenSet = adminTrendStore.listHidden();
  const manual = adminTrendStore.listManual();
  const byMint = new Map(items.map((it) => [it.mint, it]));

  const rows = [];
  const used = new Set();

  for (const m of manual) {
    const item = byMint.get(m.mint) || placeholderItem(m.mint);
    used.add(m.mint);
    rows.push(itemToRow(item, {
      id: m.id,
      source: 'Manuel',
      is_pinned: m.is_pinned,
      rank: m.position === 'pin' ? 'pin' : m.position,
      hidden: hiddenSet.has(m.mint),
    }));
  }

  let autoRank = 1;
  for (const item of items) {
    if (used.has(item.mint)) continue;
    if (hiddenSet.has(item.mint)) {
      rows.push(itemToRow(item, {
        id: `auto-${item.mint}`,
        source: 'Otomatik',
        rank: '✕',
        hidden: true,
      }));
      continue;
    }
    rows.push(itemToRow(item, {
      id: `auto-${item.mint}`,
      source: 'Otomatik',
      rank: autoRank,
    }));
    autoRank += 1;
    if (autoRank > limit + manual.length) break;
  }

  rows.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    if (a.hidden && !b.hidden) return 1;
    if (!a.hidden && b.hidden) return -1;
    const ra = a.is_pinned ? 0 : (Number(a.rank) || a.rankNum || 99);
    const rb = b.is_pinned ? 0 : (Number(b.rank) || b.rankNum || 99);
    return ra - rb;
  });

  return { items: rows, timeframe, chain, updatedAt: Date.now() };
}

function trendIndexMap(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (r.hidden) continue;
    map.set(r.mint, {
      rank: r.rank,
      id: r.id,
      sym: r.symbol,
      is_pinned: r.is_pinned,
    });
  }
  return map;
}

async function searchTokens(q, net = 'ALL') {
  const ql = String(q || '').trim().toLowerCase();
  const table = await buildTrendingTable();
  const onTrend = trendIndexMap(table.items);

  if (!ql) {
    const onList = (table.items || [])
      .filter((r) => !r.hidden)
      .map((r) => ({
        token_id: r.mint,
        sym: r.symbol,
        name: r.pair,
        net: 'SOL',
        dex: r.pair,
        risk: r.risk,
        vol: r.volume,
        change: r.change24h,
        addr: r.mint,
        inTrend: true,
        trendRank: r.rank,
        trendId: r.id,
      }));
    return { tokens: onList, onTrendCount: onList.length };
  }

  let items = await buildFastFeedItems(120);
  items = items.filter((it) => {
    const sym = String(it.symbol || '').toLowerCase();
    const mint = String(it.mint || '').toLowerCase();
    const name = String(it.name || '').toLowerCase();
    return sym.includes(ql) || mint.includes(ql) || name.includes(ql);
  });

  const looksLikeMint = ql.length >= 20;
  if (looksLikeMint && !items.some((it) => it.mint?.toLowerCase() === ql)) {
    try {
      const { previewTokenFromInput } = require('./adminFeed');
      const prev = await Promise.race([
        previewTokenFromInput(q.trim(), 'tr'),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 12000);
        }),
      ]);
      if (prev?.item) items = [prev.item, ...items];
    } catch {
      /* feed'de yoksa sessiz */
    }
  }

  if (net && net !== 'ALL') {
    const n = String(net).toUpperCase();
    items = items.filter((it) => {
      const c = String(it.chain || 'solana').toUpperCase();
      if (n === 'SOL') return c === 'SOL' || c === 'SOLANA';
      return c === n;
    });
  }

  const seen = new Set();
  const tokens = [];
  for (const it of items) {
    if (!it.mint || seen.has(it.mint)) continue;
    seen.add(it.mint);
    const tr = onTrend.get(it.mint);
    tokens.push({
      token_id: it.mint,
      sym: it.symbol,
      name: it.name || it.pairLabel || '',
      net: 'SOL',
      dex: it.dexLabel || it.dex || '—',
      risk: riskLabel(it),
      vol: it.volume24hFmt || '—',
      change: fmtChange(it.change24h),
      addr: it.mint,
      inTrend: !!tr,
      trendRank: tr?.rank ?? null,
      trendId: tr?.id ?? null,
    });
    if (tokens.length >= 40) break;
  }

  tokens.sort((a, b) => {
    if (a.inTrend && !b.inTrend) return -1;
    if (!a.inTrend && b.inTrend) return 1;
    return 0;
  });

  return { tokens, onTrendCount: onTrend.size };
}

function settingsPayload() {
  const cfg = trendConfigStore.loadConfig();
  return {
    weights: cfg.weights,
    defaults: cfg.defaults,
    view: cfg.view || {},
    refresh: cfg.refresh || {},
    ticker: cfg.ticker,
  };
}

function saveSettings(body) {
  const patch = {
    weights: body.weights,
    defaults: body.defaults,
    ticker: body.ticker,
    view: {
      hideHighRisk: body.view?.hideHighRisk ?? body.hideHighRisk,
      minVolumeUsd: body.view?.minVolumeUsd ?? body.minVolumeUsd,
    },
    refresh: {
      enabled: body.refresh?.enabled ?? body.autoRefresh,
      intervalSec: body.refresh?.intervalSec ?? body.refreshIntervalSec,
    },
  };
  return trendConfigStore.saveConfig(patch);
}

module.exports = {
  buildTrendingTable,
  searchTokens,
  settingsPayload,
  saveSettings,
  itemToRow,
  buildFastFeedItems,
};
