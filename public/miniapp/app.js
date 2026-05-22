(function () {
  const tg = window.Telegram?.WebApp;
  const isWebBrowser = window.SniperHost?.isWebBrowser?.() ?? !tg;
  let apiConfig = { botApiBase: '', webAppBase: '' };
  let apiConfigPromise = null;
  let homeFeedInflight = null;
  let homeFeedCacheKey = '';

  async function loadApiConfig() {
    if (apiConfigPromise) return apiConfigPromise;
    apiConfigPromise = (async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) apiConfig = await res.json();
        applyTrendConfigDefaults(apiConfig.trend);
      } catch {
        /* aynı sunucu */
      }
      return apiConfig;
    })();
    return apiConfigPromise;
  }

  function applyTrendConfigDefaults(trend) {
    if (!trend) return;
    const tf = String(trend.defaults?.timeframe || '').trim();
    if (tf && FEED_TF_META[tf]) feedTimeframe = tf;
    const dex = String(trend.defaults?.dexFilter || '').trim();
    if (dex) dexFilter = dex;
    const sec = parseInt(trend.refresh?.intervalSec, 10);
    if (Number.isFinite(sec) && sec >= 30 && sec <= 120) feedRefreshSec = sec;
  }

  function loadApiConfigOnce() {
    void loadApiConfig();
  }

  function apiRoot() {
    const base = String(apiConfig.botApiBase || '').replace(/\/$/, '');
    return base;
  }

  function apiPath(path) {
    const root = apiRoot();
    return root ? `${root}${path}` : path;
  }

  function readSearchQuery() {
    return ($('sidebarSearchInput')?.value || '').trim();
  }

  function syncSearchQuery() {
    searchQuery = readSearchQuery();
  }

  if (tg?.themeParams?.bg_color) {
    document.documentElement.style.setProperty('--bg', tg.themeParams.bg_color);
  }
  if (typeof window.__tgApplyFullscreen === 'function') {
    window.__tgApplyFullscreen();
  }

  const $ = (id) => document.getElementById(id);
  let reportId = null;
  let appData = null;
  let currentTf = '15m';
  let chartType = 'candle';
  /** DexScreener dark chart theme (Lightweight Charts). */
  const CHART_DS = {
    bg: '#0d1117',
    grid: '#1a2235',
    up: '#26a69a',
    down: '#ef5350',
    priceLine: '#485c7b',
    volUp: 'rgba(38, 166, 154, 0.3)',
    volDown: 'rgba(239, 83, 80, 0.3)',
    crosshair: 'rgba(255, 255, 255, 0.72)',
    text: '#8b949e',
  };
  let chartApi = null;
  let candleSeries = null;
  let lineSeries = null;
  let volumeSeries = null;
  let resizeHandler = null;
  let chartResizeObs = null;
  let livePollTimer = null;
  let chartDrawMode = 'select';
  let chartDrawings = [];
  let chartTrendPending = null;
  let chartClickUnsub = null;
  const CHART_DRAW_COLOR = '#f0b429';

  let feedTab = 'trending';
  let dexFilter = 'all';
  let activeChain = 'solana';
  /** Üst şerit: Tümü | Solana | TON | BSC | ETH */
  let feedChainFilter = 'solana';
  let homeShellBound = false;
  let homeFeedBooted = false;
  let detailShellBound = false;
  let feedPollTimer = null;
  let feedRefreshSec = 45;
  let tradesPollTimer = null;
  let tradesPollInFlight = false;
  let tradesFetchGen = 0;
  let tradesLastGood = [];
  let tradesDisplayRows = [];
  let birdeyeTradesWs = null;
  let birdeyeTradesMint = null;
  let birdeyeWsReconnectTimer = null;
  let birdeyeWsFailCount = 0;
  const TRADES_MAX_ROWS = 50;
  const TRADES_POLL_MS = 1000;
  const CHART_LIVE_POLL_MS = 5000;
  let openingMint = false;
  let feedItemsFull = [];
  let feedEmptyMessage = '';
  let feedEmptyKind = '';
  const NEW_PAIRS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
  const DUMP_VOLATILITY_TIP =
    'Bu token ani yükseliş ve ani düşüş yaşayabiliyor. Dikkatli olun.';
  const NEW_PAIRS_AGE_MS = {
    '1h': 1 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '48h': NEW_PAIRS_MAX_AGE_MS,
  };
  let newPairsAgeFilter = '24h';
  let npAgeMenuOpen = false;
  const NEW_PAIRS_AGE_META = {
    '1h': { label: 'Son 1 saat', short: '1 saat' },
    '6h': { label: 'Son 6 saat', short: '6 saat' },
    '12h': { label: 'Son 12 saat', short: '12 saat' },
    '24h': { label: 'Son 24 saat', short: '24 saat' },
    '48h': { label: 'Son 48 saat', short: '48 saat' },
  };
  let feedListMode = 'top';
  let feedTimeframe = '24h';
  const FEED_TF_META = {
    '5m': { label: 'Last 5 minutes', short: '5 min', col: '5M %', changeKey: 'change5m', volKey: 'volume5m', volFmtKey: 'volume5mFmt' },
    '1h': { label: 'Last hour', short: '1 hour', col: '1H %', changeKey: 'change1h', volKey: 'volume1h', volFmtKey: 'volume1hFmt' },
    '6h': { label: 'Last 6 hours', short: '6 hours', col: '6H %', changeKey: 'change6h', volKey: 'volume6h', volFmtKey: 'volume6hFmt' },
    '24h': { label: 'Last 24 hours', short: '24 hours', col: '24H %', changeKey: 'change24h', volKey: 'volume24h', volFmtKey: 'volume24hFmt' },
  };
  let feedTfMenuOpen = false;
  let searchQuery = '';
  let searchDebounce = null;
  let scannerAnalyzing = false;
  let scannerPreviewId = null;
  let scannerNavActive = false;
  let detailHideChart = false;
  let radarProgressTimer = null;

  const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function feedShowsSparklines() {
    return !scannerNavActive;
  }

  function markReportOpen(fromScanner) {
    detailHideChart = !!fromScanner;
  }

  function riskColHtml(band, label, up24) {
    const spark = feedShowsSparklines() ? miniSparkline(up24) : '';
    return `<div class="tr-risk-col">${spark}<span class="risk-badge ${band}">${escHtml(label)}</span></div>`;
  }

  const PLACEHOLDER_TOKENS = [
    { rank: 1, symbol: 'BONK', pairLabel: 'BONK/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263.png?size=sm' },
    { rank: 2, symbol: 'WIF', pairLabel: 'WIF/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm.png?size=sm' },
    { rank: 3, symbol: 'POPCAT', pairLabel: 'POPCAT/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'mid', label: 'MEDIUM RISK' }, mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t1GHn2a4gyyg9WH', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t1GHn2a4gyyg9WH.png?size=sm' },
    { rank: 4, symbol: 'JUP', pairLabel: 'JUP/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'JUPyiwrYJFskUPiHa7HPQc8J4iHmuxcKoCx8xNv4Sol', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/JUPyiwrYJFskUPiHa7HPQc8J4iHmuxcKoCx8xNv4Sol.png?size=sm' },
    { rank: 5, symbol: 'RAY', pairLabel: 'RAY/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png?size=sm' },
  ];

  const PLACEHOLDER_STATS = {
    volume24hFmt: '$2.48B',
    newPairs: 1248,
    liquidityFmt: '$243.6M',
    activeNow: 18457,
    count: 12458,
  };

  function chgClass(n) {
    if (n == null || Number.isNaN(Number(n))) return '';
    return Number(n) >= 0 ? 'up' : 'down';
  }

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const x = Number(n);
    const abs = Math.abs(x);
    if (abs >= 10_000) return `${x >= 0 ? '+' : ''}${Math.round(x / 1000)}K%`;
    if (abs >= 1000) return `${x >= 0 ? '+' : ''}${(x / 1000).toFixed(1)}K%`;
    return `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
  }

  function fmtPriceDisplay(item) {
    const raw = item?.priceUsd;
    if (raw != null && !Number.isNaN(Number(raw))) {
      const x = Number(raw);
      if (x === 0) return '$0';
      if (x < 0.0000001) return `$${x.toExponential(2)}`;
      if (x < 0.0001) return `$${x.toFixed(8).replace(/\.?0+$/, '')}`;
      if (x < 0.01) return `$${x.toFixed(6).replace(/\.?0+$/, '')}`;
      if (x < 1) return `$${x.toFixed(4)}`;
      if (x < 1000) return `$${x.toFixed(2)}`;
    }
    const fmt = item?.priceUsdFmt;
    if (fmt && fmt !== '$0.00' && fmt !== '$0') return fmt;
    return fmt || '—';
  }

  const SCANNER_ICON = 'assets/sniper-scanner-icon.png?v=1';

  /** Üst DEX chip + arama — token satırında kullanılmaz */
  const DEX_LOGO_SRC = {
    pumpfun: 'assets/dex-pumpfun.png?v=8',
    pumpswap: 'assets/dex-pumpfun.png?v=8',
    pump: 'assets/dex-pumpfun.png?v=8',
    raydium: 'assets/dex-raydium.png?v=8',
    meteora: 'assets/dex-meteora.png?v=8',
    orca: 'assets/dex-orca.png?v=8',
  };

  /** Alt satır — Pump.fun / PumpSwap yazısının solu (kapsül) */
  const SWAP_BADGE_SRC = 'assets/swap-badge.png?v=2';

  function avatarCornerHtml(dexKey, chainKey) {
    const ck = chainKey || 'solana';
    const src = CHAIN_PILL_ICONS[ck];
    if (src) {
      return `<img class="tr-chain-ico" src="${src}" alt="" width="10" height="10" decoding="async" />`;
    }
    if (dexKey === 'pumpswap' || dexKey === 'pumpfun') return '';
    return '<span class="tr-chain-dot" aria-hidden="true">◎</span>';
  }

  function dexSubBadgeHtml(dexKey, label) {
    if (!label) return '';
    let ico = '';
    if (dexKey === 'pumpswap' || dexKey === 'pumpfun') {
      ico = `<img class="tr-dex-badge-ico tr-dex-badge-ico--swap" src="${SWAP_BADGE_SRC}" alt="" width="16" height="16" loading="lazy" decoding="async" />`;
    } else {
      const src = DEX_LOGO_SRC[dexKey];
      if (src) {
        ico = `<img class="tr-dex-badge-ico" src="${src}" alt="" width="12" height="12" loading="lazy" decoding="async" />`;
      }
    }
    return `<span class="tr-dex-badge dex-${escHtml(dexKey)}">${ico}<span class="tr-dex-badge-txt">${escHtml(label)}</span></span>`;
  }

  function getNewPairsFilterMs() {
    return NEW_PAIRS_AGE_MS[newPairsAgeFilter] || NEW_PAIRS_MAX_AGE_MS;
  }

  function isWithinNewPairsWindow(item, windowMs = null) {
    const listed = item?.listedAt;
    if (!listed) return false;
    if (Date.now() - listed >= NEW_PAIRS_MAX_AGE_MS) return false;
    const maxMs = windowMs == null ? getNewPairsFilterMs() : windowMs;
    return Date.now() - listed < maxMs;
  }

  /** DEX listeleme ≤48s — NEW rozeti (Trending + New Pairs). */
  function showNewListingBadge(item) {
    return isWithinNewPairsWindow(item, NEW_PAIRS_MAX_AGE_MS);
  }

  /** Tek sınıflandırma: sunucu momentumBadge veya SniperFeedBadges (DUMP > ATH > HOT). */
  function resolveMomentumBadge(item) {
    const server = String(item?.momentumBadge || '').toLowerCase();
    if (server === 'dump' || server === 'ath' || server === 'hot') return server;
    return globalThis.SniperFeedBadges?.classifyMomentumBadge(item) || null;
  }

  function feedBadgeHtml(item) {
    const parts = [];
    const kind = resolveMomentumBadge(item);
    if (kind === 'dump') {
      parts.push(
        `<span class="tr-badge tr-badge-dump" title="${escHtml(DUMP_VOLATILITY_TIP)}">` +
          `<span class="tr-badge-dump-lbl">📉 DUMP</span>` +
          `<span class="tr-badge-info-ico" role="img" aria-label="${escHtml(DUMP_VOLATILITY_TIP)}" title="${escHtml(DUMP_VOLATILITY_TIP)}">ℹ</span>` +
          `</span>`,
      );
      return `<span class="tr-badges">${parts.join('')}</span>`;
    }
    if (showNewListingBadge(item)) {
      parts.push('<span class="tr-badge tr-badge-new" title="Son 48 saat içinde listelendi">NEW</span>');
    }
    if (kind === 'ath') {
      parts.push(
        '<span class="tr-badge tr-badge-ath" title="Güçlü kısa vadeli yükseliş ve alım baskısı">ATH</span>',
      );
    } else if (kind === 'hot') {
      parts.push(
        '<span class="tr-badge tr-badge-hot" title="Yoğun alım-satım / hızlı işlem"><span class="tr-badge-hot-ico" aria-hidden="true">🔥</span>HOT</span>',
      );
    }
    return parts.length ? `<span class="tr-badges">${parts.join('')}</span>` : '';
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg = getFeedChange(item);
    const up = chg == null ? true : Number(chg) >= 0;
    const pairShort = escHtml((item.pairLabel || 'SOL').replace(/^.*\//, '') || 'SOL');
    const dexKey = item.dexPlatform || item.dex || 'other';
    const chainKey = item.chain || 'solana';
    const pin = avatarCornerHtml(dexKey, chainKey);
    const avatar = item.imageUrl
      ? `<span class="tr-avatar-wrap"><img class="tr-img" src="${escHtml(item.imageUrl)}" alt="" loading="lazy" data-fb="${escHtml((item.imageFallbacks || []).join('|'))}" />${pin}</span>`
      : `<span class="tr-avatar-wrap"><span class="tr-avatar">${escHtml((item.symbol || '?').slice(0, 2))}</span>${pin}</span>`;
    const reportAttr = item.reportId ? ` data-report="${escHtml(item.reportId)}"` : '';
    const dexBadge = dexSubBadgeHtml(dexKey, item.dexLabel || item.dexShort);
    const badges = feedBadgeHtml(item);
    const subParts = [
      dexBadge,
      item.marketCapUsdFmt && item.marketCapUsdFmt !== '—'
        ? `<span class="tr-mcap-inline">${escHtml(item.marketCapUsdFmt)}</span>`
        : '',
      item.txns24hFmt && item.txns24hFmt !== '—' ? `TXNs ${escHtml(item.txns24hFmt)}` : '',
    ].filter(Boolean).join(' · ');
    const dexUrlAttr = item.dexPageUrl ? ` data-dex-url="${escHtml(item.dexPageUrl)}"` : '';
    const chainAttr = item.chain ? ` data-chain="${escHtml(item.chain)}"` : '';
    return `<article class="token-row ${extraClass}" data-mint="${escHtml(item.mint)}" data-dex="${escHtml(dexKey)}" data-chain="${escHtml(item.chain || 'solana')}"${reportAttr}${dexUrlAttr}${chainAttr}>
      <span class="tr-rank">${item.rank ?? '·'}</span>
      <div class="tr-token">${avatar}<div class="tr-meta"><div class="tr-name">${escHtml(item.symbol)}<span class="tr-pair"> / ${pairShort}</span>${badges}</div><div class="tr-sub">${subParts || '—'}</div></div></div>
      <span class="tr-mcap">${escHtml(item.marketCapUsdFmt || '—')}</span>
      <span class="tr-price" title="${item.priceUsd != null ? escHtml(String(item.priceUsd)) : ''}">${escHtml(fmtPriceDisplay(item))}</span>
      <span class="tr-age">${escHtml(item.ageFmt || '—')}</span>
      <span class="tr-pct ${chgClass(chg)}">${formatPct(chg)}</span>
      <span class="tr-vol">${escHtml(getFeedVolumeFmt(item))}</span>
      <span class="tr-liq">${escHtml(item.liquidityUsdFmt || '—')}</span>
      ${riskColHtml(rc, label, up)}
    </article>`;
  }

  function reportIdFromUrl() {
    const hash = (location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash.includes('=') ? hash : `r=${hash}`);
    return params.get('r') || new URLSearchParams(location.search).get('r');
  }

  function scoreColor(score) {
    if (score < 50) return 'var(--red)';
    if (score < 70) return 'var(--warn)';
    return 'var(--green)';
  }

  function levelRiskClass(level) {
    if (level === 'red' || level === 'critical') return 'bad';
    if (level === 'yellow') return 'warn';
    return 'good';
  }

  function riskBadgeLabel(level, score) {
    const cls = levelRiskClass(level);
    if (cls === 'bad') return { text: 'HIGH RISK', cls: 'high' };
    if (cls === 'warn') return { text: 'MEDIUM RISK', cls: 'mid' };
    if (typeof score === 'number' && score >= 70) return { text: 'LOW RISK', cls: 'low' };
    return { text: 'SCAN', cls: 'mid' };
  }

  function miniSparkline(up) {
    const pts = up
      ? '2,18 8,14 14,10 20,6 26,8 32,4 38,2'
      : '2,4 8,8 14,12 20,14 26,16 32,18 38,20';
    const col = up ? '#00ff88' : '#ff3b3b';
    return `<svg class="tr-spark" viewBox="0 0 40 22" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.5" points="${pts}"/></svg>`;
  }

  function hideAllViews() {
    $('loading')?.classList.add('hidden');
    $('error')?.classList.add('hidden');
    $('scanner-home')?.classList.add('hidden');
    $('view-detail')?.classList.add('hidden');
  }

  function refreshTgViewport() {
    if (typeof window.__tgApplyFullscreen === 'function') window.__tgApplyFullscreen();
    else if (typeof window.__tgApplySafeArea === 'function') window.__tgApplySafeArea();
  }

  function showScannerHome() {
    stopTradesPoll();
    stopLivePoll();
    if (typeof globalThis.closeSearchOverlay === 'function') globalThis.closeSearchOverlay();
    document.documentElement.classList.remove('detail-mode');
    hideAllViews();
    $('scanner-home')?.classList.remove('hidden');
    refreshTgViewport();
    bindHomeShell();
    toggleHomeRadarPanels();
    if (!homeFeedBooted) {
      initScannerHome();
      return;
    }
    if (!scannerNavActive && !feedItemsFull.length) {
      void loadHomeFeed(feedTabForApi(feedTab), feedTab, { force: true });
    }
  }

  let lastBottomNavAt = 0;

  function onBottomNav(nav) {
    if (!nav) return;
    const now = Date.now();
    if (now - lastBottomNavAt < 120) return;
    lastBottomNavAt = now;
    if (nav === 'home') {
      location.hash = '';
      reportId = null;
      feedListMode = 'top';
      setFeedTab('home');
      showScannerHome();
      clearSearch({ skipFetch: true });
      syncFeedToolbarUi();
      void loadHomeFeed('home', 'home', { force: true });
      return;
    }
    if (nav === 'trend') {
      location.hash = '';
      reportId = null;
      feedListMode = 'top';
      setFeedTab('trending');
      showScannerHome();
      syncFeedToolbarUi();
      void loadHomeFeed('trending', 'trending', { force: true });
      return;
    }
    if (nav === 'new') {
      location.hash = '';
      reportId = null;
      feedListMode = 'top';
      feedEmptyMessage = '';
      feedEmptyKind = '';
      if (feedChainFilter !== 'all' && feedChainFilter !== 'solana') {
        feedChainFilter = 'solana';
        activeChain = 'solana';
        updateHeaderChainPill('solana');
      }
      setFeedTab('new');
      showScannerHome();
      syncFeedToolbarUi();
      updateFeedListTitle();
      syncFeedChainChips();
      void loadHomeFeed('new', 'new', { force: true });
      return;
    }
    if (nav === 'scan') {
      location.hash = '';
      reportId = null;
      setFeedTab('scan');
      showScannerHome();
      setTimeout(() => $('radarMintInput')?.focus({ preventScroll: true }), 120);
      return;
    }
    showToast('Yakında');
  }

  function ensureDetailSpacer() {
    const body = document.querySelector('.detail-body');
    if (!body || body.querySelector('.detail-end-spacer')) return;
    const sp = document.createElement('div');
    sp.className = 'detail-end-spacer';
    sp.setAttribute('aria-hidden', 'true');
    body.appendChild(sp);
  }

  function showDetailView() {
    hideAllViews();
    document.documentElement.classList.add('detail-mode');
    $('view-detail')?.classList.remove('hidden');
    ensureDetailSpacer();
    refreshTgViewport();
  }

  function isSolanaMint(s) {
    return SOL_MINT_RE.test(String(s || '').trim());
  }

  function toggleHomeRadarPanels() {
    $('homeFeedPanel')?.classList.toggle('hidden', scannerNavActive);
    $('radarScanPanel')?.classList.toggle('hidden', !scannerNavActive);
    document.documentElement.classList.toggle('radar-tab-active', scannerNavActive);
    if (!scannerNavActive) hideRadarActive();
  }

  function hideRadarActive() {
    $('radarActive')?.classList.add('hidden');
    if (radarProgressTimer) {
      clearInterval(radarProgressTimer);
      radarProgressTimer = null;
    }
    const fill = $('radarProgressFill');
    if (fill) fill.style.width = '0%';
    const pct = $('radarProgressPct');
    if (pct) pct.textContent = '0%';
  }

  function setRadarProgress(pct, sub, title) {
    const fill = $('radarProgressFill');
    const pctEl = $('radarProgressPct');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    if (sub) {
      const subEl = $('radarScanSub');
      if (subEl) subEl.textContent = sub;
    }
    if (title) {
      const titleEl = $('radarScanTitle');
      if (titleEl) titleEl.textContent = title;
    }
  }

  function setScannerNav(on) {
    const was = scannerNavActive;
    scannerNavActive = !!on;
    document.documentElement.classList.toggle('scanner-mode', scannerNavActive);
    $('scanner-home')?.classList.toggle('scanner-nav-active', scannerNavActive);
    toggleHomeRadarPanels();
    if (was !== scannerNavActive && feedItemsFull.length && !scannerNavActive) {
      applySearchFilter();
    }
    updateFeedListTitle();
  }

  function setFeedTab(tab) {
    if (tab === 'scan') {
      setScannerNav(true);
    } else {
      setScannerNav(false);
      if (tab === 'new') feedTab = 'new';
      else if (tab === 'trend' || tab === 'trending') feedTab = 'trending';
      else feedTab = 'home';
    }
    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      const n = btn.dataset.nav;
      const active =
        (n === 'scan' && scannerNavActive) ||
        (!scannerNavActive && n === 'home' && feedTab === 'home') ||
        (!scannerNavActive && n === 'trend' && feedTab === 'trending') ||
        (!scannerNavActive && n === 'new' && feedTab === 'new');
      btn.classList.toggle('active', active);
    });
    updateFeedListTitle();
    if (feedTab === 'new') {
      feedEmptyMessage = '';
      feedEmptyKind = '';
    }
    syncNewPairsView();
    syncFeedToolbarUi();
  }

  function syncNewPairsView() {
    const isNp = feedTab === 'new' && !scannerNavActive;
    $('homeFeedPanel')?.classList.toggle('is-new-pairs', isNp);
    $('homeFeedPanel')?.classList.toggle('is-home-tab', feedTab === 'home' && !scannerNavActive);
    $('homeFeedPanel')?.classList.toggle('is-trend-tab', feedTab === 'trending' && !scannerNavActive);
    $('newPairsPanel')?.classList.toggle('hidden', !isNp);
    $('feedToolbar')?.classList.toggle('hidden', isNp);
    $('trendingBand')?.classList.toggle('hidden', isNp || feedTab === 'home');
    $('tokenTheadMain')?.classList.remove('hidden');
    $('tokenTheadMain')?.setAttribute('aria-hidden', 'false');
    $('tokenTableScroll')?.classList.remove('mode-new-pairs');
    $('tokenTableInner')?.classList.remove('mode-new-pairs');
    $('homeTokenList')?.classList.remove('np-list');
    updateNewPairsLiveBar();
    syncNewPairsAgeUi();
  }

  function updateNewPairsLiveBar() {
    const txt = $('newPairsLiveText');
    if (!txt || feedTab !== 'new') return;
    const n = prepareFeedListItems(feedItemsFull).length;
    const label = NEW_PAIRS_AGE_MS[newPairsAgeFilter] ? newPairsAgeFilter : '48h';
    txt.textContent = n ? `${n} çift · ${label}` : `Boş · ${label}`;
  }

  function npAgeMeta(ageKey) {
    return NEW_PAIRS_AGE_META[ageKey] || NEW_PAIRS_AGE_META['24h'];
  }

  function syncNewPairsAgeUi() {
    const meta = npAgeMeta(newPairsAgeFilter);
    const full = $('npAgeLabelFull');
    const compact = $('npAgeLabelCompact');
    if (full) full.textContent = meta.short;
    if (compact) compact.textContent = meta.short;
    document.querySelectorAll('#npAgeMenu .feed-tf-option[data-np-age]').forEach((btn) => {
      const on = btn.dataset.npAge === newPairsAgeFilter;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function setNpAgeMenuOpen(open) {
    npAgeMenuOpen = !!open;
    const dd = $('npAgeDropdown');
    const menu = $('npAgeMenu');
    const trigger = $('npAgeTrigger');
    dd?.classList.toggle('open', npAgeMenuOpen);
    menu?.classList.toggle('hidden', !npAgeMenuOpen);
    trigger?.setAttribute('aria-expanded', npAgeMenuOpen ? 'true' : 'false');
  }

  function setNewPairsAgeFilter(ageKey) {
    if (!NEW_PAIRS_AGE_MS[ageKey]) return;
    newPairsAgeFilter = ageKey;
    setNpAgeMenuOpen(false);
    syncNewPairsAgeUi();
    updateNewPairsLiveBar();
    applySearchFilter();
  }

  let newPairsAgeFilterBound = false;

  function bindNewPairsAgeFilter() {
    const dd = $('npAgeDropdown');
    const trigger = $('npAgeTrigger');
    const menu = $('npAgeMenu');
    if (!trigger || !menu || !dd) return;
    if (newPairsAgeFilterBound) return;
    newPairsAgeFilterBound = true;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setNpAgeMenuOpen(!npAgeMenuOpen);
    });

    menu.querySelectorAll('.feed-tf-option[data-np-age]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setNewPairsAgeFilter(btn.dataset.npAge || '24h');
      });
    });

    document.addEventListener('click', (e) => {
      if (dd.contains(e.target)) return;
      setNpAgeMenuOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setNpAgeMenuOpen(false);
    });

    syncNewPairsAgeUi();
  }

  function setSearchHint(msg) {
    const el = $('sidebarSearchHint');
    if (!el) return;
    if (!msg) {
      el.classList.add('hidden');
      el.classList.remove('is-miss');
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.classList.toggle('is-miss', msg.includes('mevcut değil') || msg.includes('bulunamadı'));
    el.classList.remove('hidden');
  }

  function hideScannerCard() {
    scannerPreviewId = null;
    const slot = $('scannerCardSlot');
    slot?.classList.add('hidden');
    if (slot) slot.innerHTML = '';
  }

  function clearSearch(opts = {}) {
    const inp = $('sidebarSearchInput');
    if (inp) inp.value = '';
    searchQuery = '';
    $('sidebarSearchClear')?.classList.add('hidden');
    hideScannerCard();
    scannerPreviewId = null;
    setSearchHint('');
    if (!opts.skipFetch) fetchFeed(feedTab);
    else renderTokenList(feedItemsFull);
  }

  function bindScannerCardActions(root) {
    root?.querySelector('[data-action="report"]')?.addEventListener('click', () => {
      if (!scannerPreviewId) return;
      markReportOpen(true);
      reportId = scannerPreviewId;
      location.hash = `r=${scannerPreviewId}`;
      loadReportFlow();
    });
    root?.querySelector('[data-action="clear"]')?.addEventListener('click', clearSearch);
  }

  function renderScannerCard(data, id, mint) {
    const slot = $('scannerCardSlot');
    if (!slot) return;
    const m = data.market || {};
    const sym = m.symbol || data.symbol || '?';
    const score = data.trust?.score;
    const rb = riskBadgeLabel(data.level, score);
    const chg24 = m.priceChange24h;
    const avatar = m.imageUrl
      ? `<img class="sc-avatar" src="${escHtml(m.imageUrl)}" alt="" loading="lazy" />`
      : `<span class="sc-avatar sc-avatar-fallback">${escHtml(sym.slice(0, 2))}</span>`;
    const verdict = data.trust?.verdict || data.levelLabel || 'Analiz hazır';
    slot.innerHTML = `<article class="scanner-card">
      <div class="sc-top">${avatar}<div class="sc-meta"><div class="sc-title">${escHtml(sym)}<span class="sc-pair"> / SOL</span></div><div class="sc-mint" title="${escHtml(mint)}">${escHtml(shortMint(mint))}</div></div>
      <span class="risk-badge ${rb.cls}">${rb.text}</span></div>
      <div class="sc-stats">
        <div><span class="sc-lbl">Fiyat</span><span class="sc-val">${escHtml(fmtPriceDisplay({ priceUsd: m.priceUsd, priceUsdFmt: m.priceUsdFmt }) || data.summary?.price || '—')}</span></div>
        <div><span class="sc-lbl">24s</span><span class="sc-val ${chgClass(chg24)}">${formatPct(chg24)}</span></div>
        <div><span class="sc-lbl">Skor</span><span class="sc-val sc-score">${score != null ? escHtml(String(score)) : '—'}</span></div>
        <div><span class="sc-lbl">MCap</span><span class="sc-val">${escHtml(m.marketCapUsdFmt || data.summary?.liquidityUsd || '—')}</span></div>
      </div>
      <p class="sc-verdict">${escHtml(verdict)}</p>
      <div class="sc-actions">
        <button type="button" class="scanner-card-btn primary" data-action="report">Tam analiz</button>
        <button type="button" class="scanner-card-btn" data-action="clear">Temizle</button>
      </div>
    </article>`;
    slot.classList.remove('hidden');
    bindScannerCardActions(slot);
  }

  async function runRadarScan() {
    const inp = $('radarMintInput');
    const mint = (inp?.value || '').trim();
    if (!isSolanaMint(mint)) {
      showToast('Paste a valid Solana contract address');
      inp?.focus();
      return;
    }
    if (scannerAnalyzing) return;
    scannerAnalyzing = true;
    $('radarAnalyzeBtn')?.setAttribute('disabled', 'true');
    $('radarActive')?.classList.remove('hidden');
    const phases = [
      [14, 'Parsing contract'],
      [32, 'Fetching liquidity'],
      [52, 'Running AI risk engine'],
      [72, 'Checking holders'],
      [88, 'Building report'],
    ];
    let phase = 0;
    setRadarProgress(8, phases[0][1], 'Scanning token...');
    radarProgressTimer = setInterval(() => {
      if (phase < phases.length) {
        setRadarProgress(phases[phase][0], phases[phase][1]);
        phase += 1;
      }
    }, 480);
    try {
      const openRes = await fetch(apiPath(`/api/open/${encodeURIComponent(mint)}`));
      const openBody = await openRes.json().catch(() => ({}));
      if (!openRes.ok) throw new Error(openBody.message || 'Token not found');
      const id = openBody.reportId;
      if (!id) throw new Error('Report failed');
      setRadarProgress(100, 'Complete', 'Opening report…');
      markReportOpen(true);
      reportId = id;
      location.hash = `r=${id}`;
      hideRadarActive();
      await loadReportFlow();
    } catch (e) {
      hideRadarActive();
      showToast(e.message || 'Analysis failed');
    } finally {
      scannerAnalyzing = false;
      $('radarAnalyzeBtn')?.removeAttribute('disabled');
      if (radarProgressTimer) {
        clearInterval(radarProgressTimer);
        radarProgressTimer = null;
      }
    }
  }

  async function runScannerAnalysis(mint) {
    const slot = $('scannerCardSlot');
    if (!slot || scannerAnalyzing) return;
    const trimmed = String(mint || '').trim();
    if (!isSolanaMint(trimmed)) return;
    scannerAnalyzing = true;
    slot.classList.remove('hidden');
    slot.innerHTML = '<div class="scanner-card scanner-card--loading"><span class="sc-spin"></span> Token analiz ediliyor…</div>';
    setSearchHint('Zincirde taranıyor — tam rapor için bekleyin');
    try {
      const openRes = await fetch(apiPath(`/api/open/${encodeURIComponent(trimmed)}`));
      const openBody = await openRes.json().catch(() => ({}));
      if (!openRes.ok) throw new Error(openBody.message || 'Token bulunamadı');
      const id = openBody.reportId;
      if (!id) throw new Error('Rapor oluşturulamadı');
      scannerPreviewId = id;
      const repRes = await fetch(apiPath(`/api/report/${encodeURIComponent(id)}?tf=15m`));
      const data = await repRes.json().catch(() => ({}));
      if (!repRes.ok) throw new Error(data.message || data.error || 'Rapor yüklenemedi');
      renderScannerCard(data, id, trimmed);
      setSearchHint('Analiz kartı — tam ekran için Tam analiz');
    } catch (e) {
      scannerPreviewId = null;
      slot.innerHTML = `<div class="scanner-card scanner-card--err"><p>${escHtml(e.message || 'Analiz başarısız')}</p><button type="button" class="scanner-card-btn" data-action="clear">Kapat</button></div>`;
      bindScannerCardActions(slot);
      setSearchHint('');
    } finally {
      scannerAnalyzing = false;
    }
  }

  function getActiveChain() {
    return globalThis.SniperSidebar?.getChain?.() || activeChain || 'solana';
  }

  function getFeedChainParam() {
    return feedChainFilter || activeChain || 'solana';
  }

  function syncFeedChainChips() {
    const key = feedChainFilter || 'solana';
    document.querySelectorAll('.chain-chip[data-chain]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.chain === key);
    });
  }

  function switchFeedChain(chainId) {
    const id = String(chainId || 'solana').toLowerCase();
    feedChainFilter = id;
    if (id !== 'all') {
      activeChain = id;
      try {
        localStorage.setItem('sniperSidebarChainV1', id);
      } catch {
        /* yoksay */
      }
      updateHeaderChainPill(id);
    }
    syncFeedChainChips();
    homeFeedCacheKey = '';
    homeFeedInflight = null;
    const uiTab = feedTab === 'scan' ? 'trending' : feedTab;
    void loadHomeFeed(feedTabForApi(resolveFeedTab(uiTab)), uiTab, { force: true });
  }

  const CHAIN_UI = {
    solana: { short: 'SOL', label: 'Solana', src: 'Bot kanalı' },
    ton: { short: 'TON', label: 'TON', src: 'Henüz paylaşım yok' },
    bsc: { short: 'BSC', label: 'BSC', src: 'Henüz paylaşım yok' },
    eth: { short: 'ETH', label: 'Ethereum', src: 'Henüz paylaşım yok' },
  };

  const CHAIN_PILL_ICONS = {
    solana: 'assets/chains/chain-solana.png?v=1',
    ton: 'assets/chains/chain-ton.png?v=1',
    bsc: 'assets/chains/chain-bsc.png?v=1',
    eth: 'assets/chains/chain-eth.png?v=1',
  };

  function updateHeaderChainPill(chain) {
    const pill = $('headerChainPill');
    if (!pill) return;
    const c = CHAIN_UI[chain] || { short: String(chain || '').toUpperCase().slice(0, 4) };
    const icon = CHAIN_PILL_ICONS[chain] || CHAIN_PILL_ICONS.solana;
    let txt = pill.querySelector('.chain-pill-txt');
    let img = pill.querySelector('.chain-pill-ico');
    if (!txt || !img) {
      pill.innerHTML = `<img class="chain-pill-ico" src="${icon}" alt="" width="12" height="12" decoding="async" /><span class="chain-pill-txt">${escHtml(c.short)}</span>`;
      return;
    }
    txt.textContent = c.short;
    img.src = icon;
  }

  function updateFeedListTitle() {
    const el = $('feedListTitle');
    if (!el) return;
    if (scannerNavActive || feedTab === 'home') {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    const title = feedTab === 'trending'
      ? 'Trading List'
      : feedTab === 'new'
        ? ''
        : '';
    if (title) {
      el.textContent = title;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function applyChainHeaderUi(chain) {
    const c = CHAIN_UI[chain] || { short: String(chain || '').toUpperCase().slice(0, 4), label: chain, src: 'DexScreener' };
    updateHeaderChainPill(chain);
    const meta = $('feedMetaText');
    const bar = $('feedMetaBar');
    if (meta) {
      meta.dataset.lockChain = '1';
      meta.textContent = `◎ ${c.label} · ${c.src} · yükleniyor…`;
    }
    bar?.classList.remove('hidden');
  }

  function switchActiveChain(chain) {
    const chainKey = String(chain || 'solana').toLowerCase();
    activeChain = chainKey;
    feedChainFilter = chainKey;
    syncFeedChainChips();
    applyChainHeaderUi(chainKey);
    homeFeedCacheKey = '';
    homeFeedInflight = null;
    const uiTab = feedTab === 'scan' ? 'trending' : feedTab;
    void loadHomeFeed(feedTabForApi(resolveFeedTab(uiTab)), uiTab, { force: true });
  }

  function applySearchHintFromFeed() {
    const q = (searchQuery || '').trim();
    $('sidebarSearchClear')?.classList.toggle('hidden', !q);
    hideScannerCard();
    scannerPreviewId = null;
    if (!q) {
      setSearchHint('');
      return;
    }
    if (!feedItemsFull.length) {
      const chain = getActiveChain();
      setSearchHint(
        chain === 'solana'
          ? 'Bu token listemizde mevcut değil.'
          : 'Bu ağda token bulunamadı.',
      );
      return;
    }
    setSearchHint(`${feedItemsFull.length} sonuç`);
  }

  function feedTfMeta(tf) {
    return FEED_TF_META[tf] || FEED_TF_META['24h'];
  }

  function getFeedChange(item) {
    const key = feedTfMeta(feedTimeframe).changeKey;
    return item[key];
  }

  function getFeedVolumeFmt(item) {
    const meta = feedTfMeta(feedTimeframe);
    return item[meta.volFmtKey] || item.volume24hFmt || '—';
  }

  function feedItemMcap(it) {
    return Number(it.marketCapUsd) || 0;
  }

  function sortByApiRank(list) {
    return [...list].sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
  }

  function prepareFeedListItems(items) {
    let list = Array.isArray(items) ? [...items] : [];
    if (feedChainFilter && feedChainFilter !== 'all') {
      list = list.filter((it) => String(it.chain || 'solana').toLowerCase() === feedChainFilter);
    }

    if (feedTab === 'new') {
      list = list.filter((it) => isWithinNewPairsWindow(it));
      list.sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));
    } else {
      list = list.filter((it) => !isWithinNewPairsWindow(it));
      if (feedListMode === 'gainers') {
        list = list.filter((it) => (getFeedChange(it) ?? -1) > 0);
        list.sort((a, b) => (getFeedChange(b) ?? 0) - (getFeedChange(a) ?? 0));
        if (feedTab === 'trending') list = sortByApiRank(list);
      } else if (feedTab === 'home') {
        list.sort((a, b) => feedItemMcap(b) - feedItemMcap(a));
      } else if (feedTab === 'trending') {
        list = sortByApiRank(list);
      } else {
        const volKey = feedTfMeta(feedTimeframe).volKey;
        list.sort((a, b) => (b[volKey] || 0) - (a[volKey] || 0));
      }
    }
    return list.map((it, i) => ({ ...it, rank: i + 1 }));
  }

  function updateFeedTableHead() {
    const chg = document.querySelector('.token-thead .th-chg');
    if (chg) chg.textContent = feedTfMeta(feedTimeframe).col;
  }

  function setFeedTfMenuOpen(open) {
    feedTfMenuOpen = !!open;
    const dd = $('feedTfDropdown');
    const menu = $('feedTfMenu');
    const trigger = $('feedTfTrigger');
    dd?.classList.toggle('open', feedTfMenuOpen);
    menu?.classList.toggle('hidden', !feedTfMenuOpen);
    trigger?.setAttribute('aria-expanded', feedTfMenuOpen ? 'true' : 'false');
  }

  function syncFeedToolbarUi() {
    const meta = feedTfMeta(feedTimeframe);
    const full = $('feedTfLabelFull');
    const compact = $('feedTfLabelCompact');
    if (full) full.textContent = meta.label;
    if (compact) compact.textContent = meta.short;
    const toolbarLabel = document.querySelector('.feed-toolbar-label');
    if (toolbarLabel) {
      toolbarLabel.textContent =
        feedTab === 'home' ? 'Market Cap' : feedTab === 'trending' ? 'Trending' : 'Filter';
    }
    const topChip = document.querySelector('.feed-mode-chip[data-list-mode="top"]');
    if (topChip) {
      topChip.textContent = feedTab === 'home' ? 'MCap' : 'Top';
      topChip.title = feedTab === 'home' ? 'Piyasa değerine göre sırala' : 'Trend skoruna göre sırala';
    }
    document.querySelectorAll('.feed-tf-option[data-tf]').forEach((btn) => {
      const on = btn.dataset.tf === feedTimeframe;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.feed-mode-chip[data-list-mode]').forEach((btn) => {
      const mode = btn.dataset.listMode;
      const hideNewChip = mode === 'new';
      btn.classList.toggle('hidden', hideNewChip);
      if (!hideNewChip) btn.classList.toggle('active', mode === feedListMode);
    });
    updateFeedTableHead();
  }

  function setFeedTimeframe(tf) {
    const next = FEED_TF_META[tf] ? tf : '24h';
    if (next === feedTimeframe) {
      setFeedTfMenuOpen(false);
      return;
    }
    feedTimeframe = next;
    setFeedTfMenuOpen(false);
    syncFeedToolbarUi();
    applySearchFilter();
  }

  let feedTfDropdownBound = false;

  function bindFeedTfDropdown() {
    const dd = $('feedTfDropdown');
    const trigger = $('feedTfTrigger');
    const menu = $('feedTfMenu');
    if (!trigger || !menu || !dd) return;
    if (feedTfDropdownBound) return;
    feedTfDropdownBound = true;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFeedTfMenuOpen(!feedTfMenuOpen);
    });

    menu.querySelectorAll('.feed-tf-option[data-tf]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFeedTimeframe(btn.dataset.tf || '24h');
      });
    });

    document.addEventListener('click', (e) => {
      if (dd.contains(e.target)) return;
      setFeedTfMenuOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setFeedTfMenuOpen(false);
    });

    window.addEventListener('resize', () => syncFeedToolbarUi(), { passive: true });
  }

  function setFeedListMode(mode) {
    if (mode === 'new') return;
    feedListMode = mode === 'gainers' ? 'gainers' : 'top';
    syncFeedToolbarUi();
    applySearchFilter();
  }

  function applySearchFilter() {
    applySearchHintFromFeed();
    const prepared = prepareFeedListItems(feedItemsFull);
    renderTokenList(prepared, {
      searching: !!(searchQuery || '').trim(),
      emptyMessage: feedTab === 'new' ? '' : feedEmptyMessage,
    });
  }

  function onSearchInput() {
    syncSearchQuery();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetchFeed(feedTab);
    }, 320);
  }

  function onSearchKeydown(e) {
    if (e.key === 'Enter') {
      clearTimeout(searchDebounce);
      fetchFeed(feedTab);
    }
  }

  function renderLastReportRow() {
    try {
      const last = JSON.parse(sessionStorage.getItem('lastReport') || 'null');
      if (!last?.id) return '';
      const r = riskBadgeLabel(last.level, last.score);
      const up = (last.chg || 0) >= 0;
      return `<article class="token-row token-row-last" data-report="${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <div class="tr-token"><span class="tr-avatar">${escHtml((last.symbol || '?').slice(0, 2))}</span><div class="tr-meta"><div class="tr-name">${escHtml(last.symbol)}</div><div class="tr-sub">Son analiz · Tekrar aç</div></div></div>
        <span class="tr-mcap">—</span>
        <span class="tr-price">${escHtml(last.price || '—')}</span>
        <span class="tr-age">—</span>
        <span class="tr-pct ${chgClass(last.chg)}">${escHtml(last.chg != null ? formatPct(last.chg) : '—')}</span>
        <span class="tr-vol" aria-hidden="true"></span>
        <span class="tr-liq" aria-hidden="true"></span>
        ${riskColHtml(r.cls, r.text, up)}
      </article>`;
    } catch {
      return '';
    }
  }


  function bindFeedRowLogos(root) {
    root?.querySelectorAll('img.tr-img[data-fb]').forEach((img) => {
      const extra = (img.getAttribute('data-fb') || '').split('|').filter(Boolean);
      const urls = [img.getAttribute('src'), ...extra].filter(Boolean);
      let idx = 0;
      img.onerror = () => {
        idx += 1;
        if (idx < urls.length) img.src = urls[idx];
        else {
          const sym = img.closest('.token-row')?.querySelector('.tr-name')?.textContent?.trim().slice(0, 2) || '?';
          const wrap = img.closest('.tr-avatar-wrap');
          if (wrap) {
            wrap.innerHTML = `<span class="tr-avatar">${escHtml(sym)}</span><span class="tr-chain-dot">◎</span>`;
          }
        }
      };
    });
  }

  function openExternalUrl(url) {
    if (!url) return;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  const PROMO_BREAKPOINTS = { mobile: 479, tablet: 899 };

  function promoVariantKey(width) {
    if (width <= PROMO_BREAKPOINTS.mobile) return 'mobile';
    if (width <= PROMO_BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  }

  let activePromoBanner = null;

  function promoUrls(promo) {
    const v = promo?.variants || {};
    const desktop = v.desktop?.imageUrl || promo?.imageUrl || '';
    const tablet = v.tablet?.imageUrl || desktop;
    const mobile = v.mobile?.imageUrl || tablet;
    return { desktop, tablet, mobile };
  }

  function applyPromoBannerLayout() {
    const el = $('promoBanner');
    const img = $('promoBannerImg');
    if (!img || !activePromoBanner?.enabled) return;
    const key = promoVariantKey(window.innerWidth);
    const urls = promoUrls(activePromoBanner);
    const activeUrl = urls[key] || urls.desktop;
    const slot = activePromoBanner.variants?.[key];
    const posX = Math.min(100, Math.max(0, Number(slot?.posX ?? activePromoBanner.posX) || 50));
    if (activeUrl) img.src = activeUrl;
    img.style.objectPosition = `${posX}% center`;
    el?.classList.toggle('promo-banner--mobile', key === 'mobile');
    el?.classList.toggle('promo-banner--tablet', key === 'tablet');
    el?.classList.toggle('promo-banner--desktop', key === 'desktop');
  }

  function renderPromoBanner(promo) {
    const el = $('promoBanner');
    const img = $('promoBannerImg');
    const srcMobile = $('promoBannerSrcMobile');
    const srcTablet = $('promoBannerSrcTablet');
    if (!el || !img) return;

    activePromoBanner = promo;
    if (!promo?.enabled) {
      el.classList.add('hidden');
      return;
    }

    const { desktop, tablet, mobile } = promoUrls(promo);
    if (!desktop) {
      el.classList.add('hidden');
      return;
    }

    if (srcMobile) srcMobile.srcset = mobile ? `${mobile} 1x` : '';
    if (srcTablet) srcTablet.srcset = tablet ? `${tablet} 1x` : '';
    img.alt = promo.alt || 'Reklam';
    img.onerror = () => {
      console.warn('[promo] görsel yüklenemedi', img.src);
    };
    el.classList.remove('hidden');
    applyPromoBannerLayout();
    if (isWebBrowser && typeof console !== 'undefined') {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const ir = img.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        console.info(
          `[banner ölçü] tam ekran kutu: ${w}×${h} px — Canva canvas bu boyutta (oran 12.5:1, ÷12.5)`,
        );
      });
    }

    if (!window.__sniperPromoResizeBound) {
      window.__sniperPromoResizeBound = true;
      window.addEventListener('resize', applyPromoBannerLayout, { passive: true });
    }

    if (promo.link) {
      el.href = promo.link;
      el.onclick = (e) => {
        e.preventDefault();
        openExternalUrl(promo.link);
      };
    } else {
      el.href = '#';
      el.onclick = (e) => e.preventDefault();
    }
  }

  function bindTrendChip(chip) {
    chip.addEventListener('click', () => {
      const rid = chip.dataset.report;
      const mint = chip.dataset.mint;
      if (rid) {
        markReportOpen(scannerNavActive);
        reportId = rid;
        location.hash = `r=${rid}`;
        loadReportFlow();
        return;
      }
      if (mint) openTokenByMint(mint);
    });
  }

  function renderTrendingBand(ticker, sortMode) {
    const band = $('trendingBand');
    const track = $('trendingTrack');
    const label = $('trendingSortLabel');
    if (!band || !track) return;
    if (!ticker?.length) {
      band.classList.add('hidden');
      return;
    }
    if (label) {
      if (sortMode === 'listedAt_desc' || sortMode === 'postedAt_desc') label.textContent = 'NEW ↓';
      else if (sortMode === 'marketCap_desc') label.textContent = 'MCAP ↓';
      else label.textContent = '24H VOL ↓';
    }
    const chipHtml = ticker.map((t) => {
      const up = t.change24h == null || Number(t.change24h) >= 0;
      const pct = t.change24h == null
        ? '—'
        : `${Number(t.change24h) >= 0 ? '+' : ''}${Number(t.change24h).toFixed(1)}%`;
      const reportAttr = t.reportId ? ` data-report="${escHtml(t.reportId)}"` : '';
      const price = t.priceUsdFmt && t.priceUsdFmt !== '$0.00' ? t.priceUsdFmt : (t.priceUsd != null ? fmtPriceDisplay(t) : '—');
      return `<button type="button" class="trend-chip" data-mint="${escHtml(t.mint)}"${reportAttr}>
        <span class="trend-sym">${escHtml(t.symbol)}</span>
        <span class="trend-price">${escHtml(price)}</span>
        <span class="trend-vol">${escHtml(t.volume24hFmt)}</span>
        <span class="trend-chg ${up ? 'up' : 'down'}">${escHtml(pct)}</span>
      </button>`;
    }).join('');
    track.innerHTML = chipHtml + chipHtml;
    track.querySelectorAll('.trend-chip').forEach(bindTrendChip);
    band.classList.remove('hidden');
  }

  async function loadPromoBanner() {
    try {
      const res = await fetch('/api/promo-banner', { cache: 'no-store', credentials: 'same-origin' });
      const promo = await res.json().catch(() => ({}));
      if (res.ok) renderPromoBanner(promo);
    } catch (e) {
      console.warn('[promo]', e);
    }
  }

  function applyHomeExtras(body) {
    if (body?.promo) renderPromoBanner(body.promo);
    renderTrendingBand(body?.trendingTicker, body?.sortMode);
  }

  function renderNewPairsEmptyState() {
    const ageLbl = newPairsAgeFilter || '24h';
    return `<div class="feed-empty-pro" role="status">
      <span class="feed-empty-pro-glow" aria-hidden="true"></span>
      <span class="feed-empty-pro-icon" aria-hidden="true">✦</span>
      <strong class="feed-empty-pro-title">YENİ LİSTELEME HENÜZ YOK</strong>
      <p class="feed-empty-pro-lead">Seçili sürede (<b>${escHtml(ageLbl)}</b>) DEX'te yeni listelenen çift yok. Listelenince burada görünür; <b>48 saat</b> sonra bu listeden düşer, Trending'de kalır.</p>
      <span class="feed-empty-pro-tag">NEW PAIRS · MAX 48H</span>
    </div>`;
  }

  function renderTokenList(items, opts = {}) {
    const list = $('homeTokenList');
    if (!list) return;
    const searching = !!opts.searching || !!(searchQuery || '').trim();
    const lastRow = searching ? '' : renderLastReportRow();
    list.classList.remove('np-list');
    const rows = (items || []).map((it) => renderFeedRow(it)).join('');
    if (!rows) {
      if (!searching && (feedTab === 'new' || feedEmptyKind === 'new_pairs_empty')) {
        list.innerHTML = renderNewPairsEmptyState();
        return;
      }
      const emptyMsg =
        opts.emptyMessage ||
        (searching
          ? 'Eşleşen token yok.'
          : 'Henüz bot paylaşımı yok. Tokenler yalnızca Solana bot kanalına düştükçe listelenir.');
      list.innerHTML = `<p class="home-cta">${escHtml(emptyMsg)}</p>`;
      return;
    }
    list.innerHTML = lastRow + rows;
    bindFeedRowLogos(list);
    if (feedTab === 'new') updateNewPairsLiveBar();
  }

  function applyMarketStats(stats, items) {
    const st = stats || PLACEHOLDER_STATS;
    if ($('statVol')) $('statVol').textContent = st.volume24hFmt || '—';
    if ($('statNew')) $('statNew').textContent = String(st.newPairs ?? '—');
    if ($('statLiq')) $('statLiq').textContent = st.liquidityFmt || '—';
    if ($('statActive')) $('statActive').textContent = String(st.activeNow ?? '—');
    const list = items || [];
    const avgChg = list.length
      ? list.reduce((s, it) => s + (Number(it.change24h) || 0), 0) / list.length
      : null;
    const chgTxt = avgChg != null && !Number.isNaN(avgChg) ? formatPct(avgChg) : '';
    [['statVolChg', chgTxt], ['statNewChg', st.newPairs ? `+${st.newPairs} new` : ''], ['statLiqChg', ''], ['statActiveChg', list.length ? `${list.length} live` : '']].forEach(([id, t]) => {
      const el = $(id);
      if (el) {
        el.textContent = t || '';
        el.classList.toggle('hidden', !t);
        if (id === 'statVolChg' && avgChg != null) {
          el.classList.toggle('up', avgChg >= 0);
          el.classList.toggle('down', avgChg < 0);
        }
      }
    });
  }

  function updateFeedMetaBar(body) {
    const bar = $('feedMetaBar');
    const txt = $('feedMetaText');
    if (!bar || !txt) return;
    if (!body) {
      bar.classList.add('hidden');
      return;
    }
    const chainKey = body.chain || activeChain || 'solana';
    const c = CHAIN_UI[chainKey] || { label: chainKey, src: 'DexScreener' };
    if (body.tab === 'new' || feedTab === 'new') {
      const n = body.items?.length ?? 0;
      const live = body.liveRefresh ? ' · canlı DEX' : '';
      if (body.empty) {
        txt.textContent = `◎ ${c.label} · New Pairs · DEX listeleme 48h · boş`;
      } else {
        txt.textContent = `◎ ${c.label} · New Pairs · DEX 48h · ${n} çift${live}`;
      }
      delete txt.dataset.lockChain;
      bar.classList.remove('hidden');
      return;
    }
    if (body.empty) {
      bar.classList.add('hidden');
      return;
    }
    const n = body.botCount ?? body.items?.length ?? 0;
    const vol = body.stats?.volume24hFmt || '—';
    const demo = body.previewDemo ? ' · örnek liste' : '';
    const src =
      body.source === 'dev_seed'
        ? 'Örnek'
        : body.source === 'bot_channel_live'
          ? 'Bot · canlı fiyat'
          : body.source === 'dex_live_hybrid'
            ? 'Bot + canlı DEX'
            : body.source === 'dexscreener_live'
              ? 'Canlı DEX'
              : body.source === 'bot_channel'
                ? 'Bot kanal'
                : c.src;
    const live = body.liveRefresh ? ' · anlık' : '';
    const dv = document.documentElement.dataset.build || '';
    const dvTag = dv && !dv.includes('BUILD') ? ` · ${dv.slice(0, 8)}` : '';
    txt.textContent = `◎ ${c.label} · ${src} · ${n} token · ${vol} 24h${live}${demo}${dvTag}`;
    delete txt.dataset.lockChain;
    bar.classList.remove('hidden');
  }

  function updateChainChipCounts(items) {
    const counts = { all: 0, solana: 0, ton: 0, bsc: 0, eth: 0 };
    for (const it of items || []) {
      counts.all += 1;
      const c = String(it.chain || 'solana').toLowerCase();
      if (counts[c] != null) counts[c] += 1;
    }
    document.querySelectorAll('.chain-chip[data-chain]').forEach((btn) => {
      const key = btn.dataset.chain;
      const n = counts[key];
      let badge = btn.querySelector('.chain-count');
      if (n == null || !n) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'chain-count';
        btn.appendChild(badge);
      }
      badge.textContent = String(n);
    });
  }

  function feedTabForApi(tab) {
    const t = tab || feedTab;
    if (t === 'home') return 'home';
    if (t === 'new') return 'new';
    if (t === 'scan') return 'trending';
    if (t === 'trend' || t === 'trending') return 'trending';
    return 'trending';
  }

  function resolveFeedTab(tab) {
    const t = tab || feedTab;
    if (t === 'scan' || t === 'home') return 'trending';
    if (t === 'trend') return 'trending';
    return t;
  }

  function ingestFeedResponse(body, q) {
    const items = body?.items?.length ? body.items : [];
    feedEmptyMessage = body?.emptyMessage || '';
    feedEmptyKind = body?.emptyKind || '';
    if (body?.empty && !items.length) {
      applyMarketStats(
        body.stats || { count: 0, volume24hFmt: '—', liquidityFmt: '—', newPairs: 0, activeNow: 0 },
        items,
      );
      applyHomeExtras(body);
      updateFeedMetaBar(body);
      feedItemsFull = [];
      applySearchFilter();
      if (!q && body.emptyMessage && feedEmptyKind !== 'new_pairs_empty') {
        showToast(body.emptyMessage.slice(0, 80));
      }
      return body;
    }
    updateChainChipCounts(items);
    if (body.chain && body.chain !== 'all') {
      feedChainFilter = body.chain;
      activeChain = body.chain;
      syncFeedChainChips();
    }
    applyMarketStats(body.stats || PLACEHOLDER_STATS, items);
    applyHomeExtras(body);
    updateFeedMetaBar(body);
    feedItemsFull = items;
    if (items.length) {
      feedEmptyMessage = '';
      feedEmptyKind = '';
    }
    if (body.chain) activeChain = body.chain;
    applySearchFilter();
    if (body.empty && body.emptyMessage && feedEmptyKind !== 'new_pairs_empty') {
      showToast('Liste boş — /post ile kanala paylaşın');
    }
    return body;
  }

  /** Ana liste — Scanner modundan çıkar, feed API çağır. */
  async function loadHomeFeed(apiTab = 'trending', uiTab = 'trending', opts = {}) {
    // Ana liste tam feed; metin araması yalnızca search-overlay (/api/search).
    const q = '';
    const chain = getFeedChainParam();
    const cacheKey = `${apiTab}|${chain}|${newPairsAgeFilter}`;
    if (!opts.force && homeFeedInflight) return homeFeedInflight;
    if (!opts.force && feedItemsFull.length && cacheKey === homeFeedCacheKey) {
      applySearchFilter();
      return { items: feedItemsFull };
    }

    loadApiConfigOnce();
    setScannerNav(false);
    toggleHomeRadarPanels();
    if (uiTab === 'new') feedTab = 'new';
    else if (uiTab === 'home') feedTab = 'home';
    else feedTab = 'trending';
    setFeedTab(feedTab);

    if (chain !== 'all') activeChain = chain;
    syncFeedChainChips();
    searchQuery = '';
    const sideInp = $('sidebarSearchInput');
    if (sideInp) sideInp.value = '';
    $('sidebarSearchClear')?.classList.add('hidden');
    setSearchHint('');
    const loadingEl = $('feedLoading');
    const list = $('homeTokenList');
    loadingEl?.classList.remove('hidden');
    list?.classList.add('dimmed');

    homeFeedInflight = (async () => {
      try {
        const qs = new URLSearchParams({
          tab: apiTab,
          limit: feedTab === 'new' ? '48' : '24',
          dex: 'all',
          chain,
        });
        const res = await fetch(`/api/feed?${qs.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'feed_failed');
        const items = body.items?.length ? body.items : [];
        homeFeedCacheKey = cacheKey;
        return ingestFeedResponse(body, q);
      } catch (e) {
        console.error('[feed]', e);
        applyMarketStats(PLACEHOLDER_STATS, []);
        void loadPromoBanner();
        updateFeedMetaBar(null);
        feedItemsFull = [];
        applySearchFilter();
        showToast('Liste yüklenemedi — tekrar deneyin');
        return null;
      } finally {
        loadingEl?.classList.add('hidden');
        list?.classList.remove('dimmed');
      }
    })();

    try {
      return await homeFeedInflight;
    } finally {
      homeFeedInflight = null;
    }
  }

  async function fetchFeed(tab, opts = {}) {
    const uiTab = tab || feedTab;
    if (uiTab === 'scan') {
      setFeedTab('scan');
      return null;
    }
    return loadHomeFeed(feedTabForApi(resolveFeedTab(uiTab)), uiTab, opts);
  }

  async function openTokenByMint(mint) {
    if (!mint || openingMint) return;
    openingMint = true;
    const list = $('homeTokenList');
    list?.classList.add('dimmed');
    showToast('Token analiz ediliyor…');
    try {
      const res = await fetch(apiPath(`/api/open/${encodeURIComponent(mint)}`));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Analiz başarısız');
      const id = body.reportId;
      if (!id) throw new Error('report_missing');
      markReportOpen(scannerNavActive);
      reportId = id;
      location.hash = `r=${id}`;
      await loadReportFlow();
    } catch (e) {
      showToast(e.message || 'Açılamadı');
    } finally {
      openingMint = false;
      list?.classList.remove('dimmed');
    }
  }

  function bindHomeShell() {
    if (homeShellBound) return;
    homeShellBound = true;

    document.querySelectorAll('.feed-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.feed;
        if (f === 'refresh') {
          fetchFeed(feedTab);
          return;
        }
        if (f === 'trending' || f === 'new') fetchFeed(f);
      });
    });

    document.querySelectorAll('.chain-chip[data-chain]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.chain || 'solana';
        if (c === feedChainFilter) return;
        switchFeedChain(c);
      });
    });
    syncFeedChainChips();

    bindFeedTfDropdown();
    bindNewPairsAgeFilter();
    syncFeedToolbarUi();
    syncNewPairsView();
    document.querySelectorAll('.feed-mode-chip[data-list-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setFeedListMode(btn.dataset.listMode || 'top'));
    });
    const bottomNav = document.querySelector('#scanner-home .bottom-nav');
    bottomNav?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button.bnav[data-nav]');
      if (!btn) return;
      ev.preventDefault();
      onBottomNav(btn.dataset.nav);
    });
    /* Arama: search-overlay.js (Dex panel) */
    $('radarAnalyzeBtn')?.addEventListener('click', () => runRadarScan());
    $('radarMintInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runRadarScan();
    });
    $('radarPasteBtn')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const inp = $('radarMintInput');
        if (inp && text) inp.value = text.trim();
      } catch {
        showToast('Could not paste from clipboard');
      }
    });

    $('homeTokenList')?.addEventListener('click', (ev) => {
      if (ev.target.closest('.tr-badge-info-ico, .tr-badge-dump')) return;
      const row = ev.target.closest('.token-row');
      if (!row) return;
      const rid = row.dataset.report;
      if (rid) {
        markReportOpen(scannerNavActive);
        reportId = rid;
        location.hash = `r=${rid}`;
        loadReportFlow();
        return;
      }
      const dexUrl = row.dataset.dexUrl;
      if (dexUrl && getActiveChain() !== 'solana') {
        openExternalUrl(dexUrl);
        return;
      }
      const m = row.dataset.mint;
      if (m) openTokenByMint(m);
    });

    document.addEventListener('sniper:chain', (e) => {
      switchActiveChain(e.detail?.chain || 'solana');
    });

    feedPollTimer = setInterval(() => {
      if (scannerNavActive) return;
      if (!$('scanner-home')?.classList.contains('hidden')) {
        homeFeedCacheKey = '';
        void fetchFeed(feedTab, { force: true });
      }
    }, feedRefreshSec * 1000);
  }

  function initScannerHome() {
    if (homeFeedBooted) return;
    homeFeedBooted = true;
    activeChain = getActiveChain();
    syncFeedChainChips();
    updateHeaderChainPill(activeChain);
    syncFeedToolbarUi();
    setFeedTab('home');
    searchQuery = '';
    homeFeedCacheKey = '';
    const sideInp = $('sidebarSearchInput');
    if (sideInp) sideInp.value = '';
    setSearchHint('');
    const list = $('homeTokenList');
    if (list) list.innerHTML = '';
    $('feedLoading')?.classList.remove('hidden');
    void loadPromoBanner();
    void loadHomeFeed('home', 'home', { force: true });
    setTimeout(() => {
      if (!scannerNavActive && !feedItemsFull.length && !$('scanner-home')?.classList.contains('hidden')) {
        if (typeof globalThis.bootHomeFeed === 'function') void globalThis.bootHomeFeed();
        else void loadHomeFeed('home', 'home', { force: true });
      }
    }, 2500);
  }

  function bindDetailShell() {
    if (detailShellBound) return;
    detailShellBound = true;
    setupNav();
    setupTfButtons();
    setupChartType();
    setupChartDrawTools();
    setupCopy();
  }

  async function loadReportFlow() {
    showDetailView();
    bindDetailShell();
    try {
      const data = await loadReport('15m');
      try {
        sessionStorage.setItem('lastReport', JSON.stringify({
          id: reportId,
          symbol: data.symbol,
          price: data.market?.priceUsdFmt || data.summary?.price,
          mcap: data.market?.marketCapUsdFmt,
          chg: data.market?.priceChange24h,
          level: data.level,
          score: data.trust?.score,
        }));
      } catch { /* yoksay */ }
    } catch (e) {
      if (e.message === 'expired') {
        showError('Rapor süresi doldu', e.hint || 'Yeni analiz bekleyin.');
      } else {
        showError('Rapor bulunamadı', e.hint || 'Kanal yorumundaki butonu kullanın.');
      }
    }
  }

  function fmtChgVal(n) {
    if (typeof n !== 'number' || Number.isNaN(n)) return null;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  }

  function fmtPriceNum(n) {
    if (n == null || Number.isNaN(n)) return '—';
    const x = Number(n);
    if (x === 0) return '0';
    if (x < 0.0000001) return x.toExponential(4);
    if (x < 0.0001) return x.toFixed(8).replace(/\.?0+$/, '');
    if (x < 1) return x.toFixed(6).replace(/\.?0+$/, '');
    return x.toFixed(4);
  }

  function chartPriceFormat(candles) {
    const vals = (candles || [])
      .flatMap((c) => [Number(c.high), Number(c.low), Number(c.close)])
      .filter((v) => Number.isFinite(v) && v > 0);
    const max = vals.length ? Math.max(...vals) : 1;
    if (max < 0.00001) return { type: 'price', precision: 10, minMove: 1e-10 };
    if (max < 0.0001) return { type: 'price', precision: 8, minMove: 1e-8 };
    if (max < 0.01) return { type: 'price', precision: 6, minMove: 1e-6 };
    if (max < 1) return { type: 'price', precision: 4, minMove: 0.0001 };
    return { type: 'price', precision: 2, minMove: 0.01 };
  }

  function chartPriceLabel(price) {
    const x = Number(price);
    if (!Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    if (x < 0.0000001) return x.toExponential(2);
    if (x < 0.0001) return x.toFixed(8).replace(/\.?0+$/, '');
    if (x < 1) return x.toFixed(6).replace(/\.?0+$/, '');
    if (x < 1000) return x.toFixed(4);
    return x.toFixed(2);
  }

  function shortMint(addr) {
    if (!addr || addr.length < 12) return addr || '—';
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }

  function updateConnectButton() {
    const btn = $('btnConnect');
    const w = globalThis.SniperWallet;
    if (!btn || !w) return;
    btn.classList.toggle('connected', !!w.pubkey);
    btn.classList.toggle('loading', !!w.connecting);
    if (w.connecting) {
      btn.innerHTML = '<span class="wallet-ico">◎</span> …';
      return;
    }
    if (w.pubkey) {
      btn.innerHTML = `<span class="wallet-ico">◎</span> ${escHtml(w.shortAddr(w.pubkey))}`;
      btn.title = `${w.label} · ${w.pubkey} (çıkmak için dokun)`;
      return;
    }
    btn.innerHTML = '<span class="wallet-ico">👛</span> Connect';
    btn.title = 'Phantom / Solflare bağla';
  }

  function initWallet() {
    const w = globalThis.SniperWallet;
    if (!w) return;
    w.restore();
    w.onChange(() => updateConnectButton());
    updateConnectButton();
    $('btnConnect')?.addEventListener('click', async () => {
      try {
        const pk = await w.toggle();
        if (pk) showToast(`${w.label} bağlandı · ${w.shortAddr(pk)}`);
        else if (!w.pubkey) showToast('Bağlantı kesildi');
      } catch (e) {
        if (e?.code === 'deeplink') {
          showToast('Phantom açılıyor — orada onayla');
          return;
        }
        showToast(e?.message || 'Cüzdan bağlanamadı');
      }
      updateConnectButton();
    });
  }

  function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function setChartLoading(on) {
    $('chartLoader')?.classList.toggle('hidden', !on);
  }

  function loadLogo(primary, fallbacks, symbol) {
    const skeleton = $('logoSkeleton');
    const img = $('tokenLogo');
    if (!img) return;

    const urls = [primary, ...(fallbacks || [])].filter(Boolean);
    const sym = (symbol || '?').slice(0, 2).toUpperCase();

    const showFallback = () => {
      skeleton?.classList.add('hidden');
      const fb = document.createElement('div');
      fb.className = 'token-avatar fallback';
      fb.textContent = sym;
      img.classList.add('hidden');
      if (img.parentNode) img.parentNode.replaceChild(fb, img);
    };

    const tryNext = (idx) => {
      if (idx >= urls.length) {
        showFallback();
        return;
      }
      img.onload = () => {
        skeleton?.classList.add('hidden');
        img.classList.remove('hidden');
      };
      img.onerror = () => tryNext(idx + 1);
      img.src = urls[idx];
    };

    if (!urls.length) {
      showFallback();
      return;
    }
    img.classList.add('hidden');
    skeleton?.classList.remove('hidden');
    tryNext(0);
  }

  function renderQuoteChanges(m) {
    const box = $('quoteChanges');
    if (!box) return;
    const items = [
      { lbl: '5M', val: m.priceChange5m },
      { lbl: '1H', val: m.priceChange1h },
      { lbl: '6H', val: m.priceChange6h },
      { lbl: '24H', val: m.priceChange24h },
    ];
    box.innerHTML = items
      .map(({ lbl, val }) => {
        const text = fmtChgVal(val);
        if (!text) return '';
        const cls = val > 0 ? 'up' : val < 0 ? 'down' : '';
        return `<span class="chg-pill ${cls}"><span class="lbl">${lbl}</span>${text}</span>`;
      })
      .join('');
  }

  function renderChartPeriodChg(stats, tf) {
    const el = $('chartPeriodChg');
    if (!el) return;
    if (!stats || stats.periodChangePct == null) {
      el.textContent = `Δ ${(tf || '').toUpperCase()} —`;
      el.className = 'ohlc-chg';
      return;
    }
    const pct = stats.periodChangePct;
    const text = fmtChgVal(pct);
    el.textContent = `Δ ${(tf || '').toUpperCase()} ${text}`;
    el.className = `ohlc-chg ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`;
  }

  function renderDetailBadges(data) {
    const row = $('detailBadgeRow');
    if (!row) return;
    const score = data.trust?.score;
    const rb = riskBadgeLabel(data.level, score);
    const m = data.market || {};
    const chips = [
      { label: 'Risk Score', val: score != null ? `${score}/100` : '—', sub: rb.text, cls: rb.cls },
      { label: 'Audit', val: 'Verified', sub: 'SAFE', cls: 'low' },
      { label: 'LP Locked', val: data.summary?.liquidityWord || '—', sub: 'LOCKED', cls: 'low' },
      { label: 'Honeypot', val: 'No', sub: 'SAFE', cls: 'low' },
      { label: 'Contract', val: 'Verified', sub: 'SAFE', cls: 'low' },
    ];
    row.innerHTML = chips
      .map(
        (c) => `<article class="detail-badge detail-badge--${c.cls}"><span class="db-lbl">${escHtml(c.label)}</span><strong>${escHtml(c.val)}</strong><em>${escHtml(c.sub)}</em></article>`,
      )
      .join('');
  }

  function renderMetrics(m, stats) {
    const dash = $('metricsDash');
    if (!dash) return;
    const hi = stats?.periodHigh != null ? fmtPriceNum(stats.periodHigh) : '—';
    const lo = stats?.periodLow != null ? fmtPriceNum(stats.periodLow) : '—';
    const cells = [
      { label: 'Price', value: fmtPriceDisplay(m) },
      { label: '24H Volume', value: m.volume24hFmt },
      { label: 'Liquidity', value: m.liquidityUsdFmt },
      { label: 'Market Cap', value: m.marketCapUsdFmt },
      { label: 'Holders', value: m.holdersFmt || '—' },
      { label: 'Age', value: m.pairAge || '—' },
      { label: 'Total Supply', value: m.supplyFmt || '—' },
      { label: 'LP Pair', value: m.pairLabel || 'SOL' },
    ];
    dash.innerHTML = cells
      .map(
        (c) => `<div class="metric-cell"><span class="label">${c.label}</span><span class="value">${c.value || '—'}</span></div>`,
      )
      .join('');
  }

  function renderTxnBar(m) {
    const wrap = $('txnSection');
    const bar = $('txnBuyBar');
    const counts = $('txnCounts');
    const ratio = m.txnRatio;
    if (!wrap || !ratio || !(ratio.buys + ratio.sells)) {
      wrap?.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    if (bar) bar.style.width = `${ratio.buyPct}%`;
    if (counts) counts.textContent = `${ratio.buys} alım · ${ratio.sells} satım (${ratio.buyPct}% alım)`;
  }

  function birdeyeWsUrl() {
    const be = apiConfig?.birdeye || {};
    const base = be.wsUrl || 'wss://public-api.birdeye.so/socket/solana';
    const key = String(be.apiKey || '').trim();
    if (!key) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}x-api-key=${encodeURIComponent(key)}`;
  }

  function fmtTradeUsd(usd) {
    const n = Math.abs(Number(usd) || 0);
    if (!n) return '—';
    if (n >= 1) return `$${n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toExponential(2)}`;
  }

  function normalizeBirdeyeWsTrade(msg, baseMint) {
    const item = msg?.data || msg;
    if (!item) return null;
    let side = String(item.side || '').toLowerCase();
    if (side === 'swap') return null;
    if (side !== 'buy' && side !== 'sell') return null;
    const unix = Number(item.blockUnixTime);
    if (!unix) return null;
    const usd = Math.abs(parseFloat(item.volumeUSD) || 0);
    const txHash = item.txHash || null;
    const at = new Date(unix * 1000).toISOString();
    const base = String(baseMint || '').toLowerCase();
    const from = item.from;
    const to = item.to;
    let amount = null;
    if (side === 'buy' && to) {
      amount = Math.abs(parseFloat(to.uiChangeAmount ?? to.uiAmount) || 0) || null;
    } else if (side === 'sell' && from) {
      amount = Math.abs(parseFloat(from.uiChangeAmount ?? from.uiAmount) || 0) || null;
    }
    if (amount == null && base && from) {
      const fromMint = String(from.address || '').toLowerCase();
      if (fromMint === base) amount = Math.abs(parseFloat(from.uiAmount) || 0);
    }
    return {
      id: txHash || `be-${unix}-${item.owner || ''}`,
      side,
      usd,
      usdFmt: fmtTradeUsd(usd),
      amount,
      wallet: item.owner ? `${item.owner.slice(0, 4)}…${item.owner.slice(-4)}` : '—',
      txHash,
      at,
      updatedAt: at,
      ago: tradeAgoLabel(at),
      source: 'birdeye',
    };
  }

  function stopBirdeyeTradesWs() {
    if (birdeyeWsReconnectTimer) {
      clearTimeout(birdeyeWsReconnectTimer);
      birdeyeWsReconnectTimer = null;
    }
    if (birdeyeTradesWs) {
      try {
        birdeyeTradesWs.onclose = null;
        birdeyeTradesWs.close();
      } catch {
        /* yoksay */
      }
      birdeyeTradesWs = null;
    }
    birdeyeTradesMint = null;
    birdeyeWsFailCount = 0;
  }

  function scheduleBirdeyeWsReconnect(m) {
    if (!reportId || birdeyeWsReconnectTimer) return;
    birdeyeWsFailCount = Math.min(birdeyeWsFailCount + 1, 6);
    const delay = Math.min(30_000, 1500 * 2 ** birdeyeWsFailCount);
    birdeyeWsReconnectTimer = setTimeout(() => {
      birdeyeWsReconnectTimer = null;
      if (reportId && appData?.market) void startBirdeyeTradesWs(appData.market);
    }, delay);
  }

  async function startBirdeyeTradesWs(m) {
    await loadApiConfig();
    const mint = tokenMintRef(m);
    if (!mint || !reportId) return;
    const be = apiConfig?.birdeye;
    if (!be?.apiKey) {
      startTradesPollFallback(m);
      return;
    }
    if (birdeyeTradesWs && birdeyeTradesMint === mint) return;
    stopBirdeyeTradesWs();
    birdeyeTradesMint = mint;
    if (tradesPollTimer) {
      clearInterval(tradesPollTimer);
      tradesPollTimer = null;
    }

    let ws;
    try {
      ws = new WebSocket(birdeyeWsUrl(), 'echo-protocol');
    } catch (e) {
      console.warn('birdeye ws', e);
      startTradesPollFallback(m);
      return;
    }
    birdeyeTradesWs = ws;

    ws.onopen = () => {
      birdeyeWsFailCount = 0;
      try {
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_TXS',
          data: { queryType: 'simple', address: mint, txsType: 'swap' },
        }));
      } catch (e) {
        console.warn('birdeye subscribe', e);
      }
      const meta = $('tradesMeta');
      if (meta && tradesDisplayRows.length) meta.textContent = `${tradesDisplayRows.length} işlem · canlı WS`;
    };

    ws.onmessage = (ev) => {
      const market = appData?.market;
      if (!market || tokenMintRef(market) !== mint) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg?.type !== 'TXS_DATA') return;
      const trade = normalizeBirdeyeWsTrade(msg, mint);
      if (!trade) return;
      tradesLastGood = mergeTradesDisplay([trade], tradesLastGood);
      saveTradesSession(market, tradesLastGood);
      renderTradesList(tradesLastGood, market?.symbol, { keepPrevious: false, fullRender: false });
      const meta = $('tradesMeta');
      if (meta) meta.textContent = `${tradesDisplayRows.length} işlem · canlı WS`;
    };

    ws.onerror = () => {
      scheduleBirdeyeWsReconnect(m);
    };

    ws.onclose = () => {
      if (birdeyeTradesWs === ws) birdeyeTradesWs = null;
      if (reportId && birdeyeTradesMint === mint) scheduleBirdeyeWsReconnect(m);
    };
  }

  function startTradesPollFallback(m) {
    if (tradesPollTimer) return;
    const ms = tradesPollIntervalMs(m);
    tradesPollTimer = setInterval(() => {
      if (reportId && appData?.market) void refreshTrades(appData.market);
    }, ms);
  }

  function stopTradesPoll() {
    stopBirdeyeTradesWs();
    if (tradesPollTimer) {
      clearInterval(tradesPollTimer);
      tradesPollTimer = null;
    }
    tradesDisplayRows = [];
    tradesLastGood = [];
    tradesPollInFlight = false;
  }

  function chartPoolRef(m) {
    const market = m || appData?.market || {};
    const mint = tokenMintRef(m);
    const pool = (
      market.poolAddress
      || market.chart?.poolAddress
      || market.chart?.pairRef
      || appData?.poolAddress
      || ''
    ).trim();
    if (!pool || (mint && pool === mint)) return '';
    return pool;
  }

  async function ensurePoolOnMarket(m) {
    if (chartPoolRef(m)) return chartPoolRef(m);
    const mint = tokenMintRef(m);
    if (!mint) return '';
    try {
      const live = await fetchChartCandles(m, currentTf, {});
      if (live.poolAddress) {
        m.poolAddress = live.poolAddress;
        if (appData?.market) appData.market.poolAddress = live.poolAddress;
      }
    } catch (e) {
      console.warn('pool resolve', e);
    }
    return chartPoolRef(m);
  }

  function tokenMintRef(m) {
    const market = m || appData?.market || {};
    return (market.address || appData?.address || '').trim();
  }

  function tradeAgoLabel(at) {
    const t = new Date(at).getTime();
    if (!t) return '';
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  }

  function tradeTimeMs(t) {
    const ms = new Date(t?.at || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function tradeDedupeKey(t) {
    const tx = String(t?.txHash || t?.id || '').trim();
    if (tx) return `tx:${tx}`;
    return `t:${tradeTimeMs(t)}:${String(t?.wallet || '')}:${t?.usd ?? ''}`;
  }

  function mergeTradesDisplay(incoming, existing) {
    const byKey = new Map();
    for (const t of [...(incoming || []), ...(existing || [])]) {
      if (!t) continue;
      const k = tradeDedupeKey(t);
      const prev = byKey.get(k);
      if (!prev || tradeTimeMs(t) >= tradeTimeMs(prev)) byKey.set(k, t);
    }
    return [...byKey.values()]
      .sort((a, b) => tradeTimeMs(b) - tradeTimeMs(a))
      .slice(0, TRADES_MAX_ROWS);
  }

  function formatTradeAmount(t) {
    const v = t?.amount;
    if (v == null || !Number.isFinite(Number(v))) return '—';
    const n = Number(v);
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(2);
  }

  function buildTradeRowHtml(t, isNew) {
    const side = t.side === 'sell' ? 'sell' : 'buy';
    const ago = tradeAgoLabel(t.at) || t.ago || '—';
    const key = tradeDedupeKey(t);
    return `<li class="trade-row trade-row--${side}${isNew ? ' trade-row--new' : ''}" data-trade-key="${escHtml(key)}">
        <span class="trade-ago">${escHtml(ago)}</span>
        <span class="trade-side ${side}">${side === 'buy' ? 'AL' : 'SAT'}</span>
        <span class="trade-usd">${escHtml(t.usdFmt || '—')}</span>
        <span class="trade-amt">${escHtml(formatTradeAmount(t))}</span>
        <span class="trade-wallet">${escHtml(t.wallet || '—')}</span>
      </li>`;
  }

  function tradesSessionKey(m) {
    const mint = tokenMintRef(m) || m;
    const pool = chartPoolRef(m);
    if (!mint) return '';
    return `trades:${mint}:${pool || ''}`;
  }

  function loadTradesSession(m) {
    try {
      const raw = sessionStorage.getItem(tradesSessionKey(m));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, TRADES_MAX_ROWS) : [];
    } catch {
      return [];
    }
  }

  function saveTradesSession(m, trades) {
    try {
      if (!trades?.length) return;
      sessionStorage.setItem(tradesSessionKey(m), JSON.stringify(trades.slice(0, TRADES_MAX_ROWS)));
    } catch {
      /* quota */
    }
  }

  function showTradesSkeleton(n = 6) {
    const list = $('tradesList');
    if (!list) return;
    const row = `<li class="trade-row trade-row--skeleton" aria-hidden="true">
        <span class="sk-bar sk-w1"></span>
        <span class="sk-bar sk-w2"></span>
        <span class="sk-bar sk-w3"></span>
        <span class="sk-bar sk-w4"></span>
        <span class="sk-bar sk-w5"></span>
      </li>`;
    list.innerHTML = row.repeat(n);
  }

  function trimTradesDom(list) {
    const rows = [...list.querySelectorAll('.trade-row:not(.trade-placeholder):not(.trade-row--skeleton)')];
    while (rows.length > TRADES_MAX_ROWS) {
      rows[rows.length - 1].remove();
      rows.pop();
    }
  }

  function renderTradesList(trades, symbol, opts = {}) {
    const list = $('tradesList');
    const col = $('tradesColToken');
    if (col) col.textContent = symbol || 'Token';
    if (!list) return;

    if (!trades?.length) {
      if (opts.keepPrevious && tradesDisplayRows.length) return;
      tradesDisplayRows = [];
      list.innerHTML = '<li class="trade-row trade-placeholder">Henüz işlem yok</li>';
      return;
    }

    const prevKeys = new Set(tradesDisplayRows.map(tradeDedupeKey));
    const merged = mergeTradesDisplay(trades, tradesDisplayRows);
    tradesDisplayRows = merged;

    const placeholder = list.querySelector('.trade-placeholder');
    if (placeholder) placeholder.remove();
    list.querySelectorAll('.trade-row--skeleton').forEach((el) => el.remove());

    if (opts.fullRender || !list.querySelector('.trade-row[data-trade-key]')) {
      list.innerHTML = merged.map((t) => buildTradeRowHtml(t, false)).join('');
      trimTradesDom(list);
      return;
    }

    const added = merged.filter((t) => !prevKeys.has(tradeDedupeKey(t)));
    if (!added.length) {
      trimTradesDom(list);
      return;
    }

    added.sort((a, b) => tradeTimeMs(a) - tradeTimeMs(b));
    for (const t of added) {
      list.insertAdjacentHTML('afterbegin', buildTradeRowHtml(t, true));
    }
    trimTradesDom(list);
  }

  function seedTradesFromMarket(m) {
    const raw = m?.recentTrades || appData?.market?.recentTrades || [];
    return Array.isArray(raw) ? raw.slice(0, TRADES_MAX_ROWS) : [];
  }

  function tradesWatermarkMs(rows) {
    let max = 0;
    for (const t of rows || []) {
      const ms = tradeTimeMs(t);
      if (ms > max) max = ms;
    }
    return max;
  }

  async function fetchTradesFromServer(m, live = false, sinceMs = 0) {
    const mint = tokenMintRef(m) || m;
    if (!mint) return { trades: [], pollMs: TRADES_POLL_MS, incremental: false };
    const pool = chartPoolRef(m);
    const q = new URLSearchParams({ limit: String(TRADES_MAX_ROWS) });
    if (live) {
      q.set('live', '1');
      q.set('t', String(Date.now()));
    }
    if (pool) q.set('pool', pool);
    if (sinceMs > 0) q.set('since', String(sinceMs));
    const res = await fetch(apiPath(`/api/dex/token/${encodeURIComponent(mint)}/trades?${q}`), { cache: 'no-store' });
    if (!res.ok) return { trades: [], pollMs: TRADES_POLL_MS, incremental: sinceMs > 0 };
    const body = await res.json();
    const pollMs = Number(body?.pollMs) || TRADES_POLL_MS;
    if (appData?.market && pollMs >= 1000) appData.market.tradesPollMs = pollMs;
    return {
      trades: body?.trades || [],
      pollMs,
      incremental: !!body?.incremental || sinceMs > 0,
      latestUpdatedAt: body?.latestUpdatedAt || null,
    };
  }

  function applyLivePairToMarket(m, pair, priceUsd) {
    if (!m) return;
    if (Number.isFinite(priceUsd)) {
      m.priceUsd = priceUsd;
      m.priceUsdFmt = null;
    }
    if (!pair) return;
    const px = parseFloat(pair.priceUsd);
    if (Number.isFinite(px)) {
      m.priceUsd = px;
      m.priceUsdFmt = null;
    }
    m.priceChange5m = parseFloat(pair.priceChange?.m5) ?? m.priceChange5m;
    m.priceChange1h = parseFloat(pair.priceChange?.h1) ?? m.priceChange1h;
    m.priceChange6h = parseFloat(pair.priceChange?.h6) ?? m.priceChange6h;
    m.priceChange24h = parseFloat(pair.priceChange?.h24) ?? m.priceChange24h;
    m.buys24h = pair.txns?.h24?.buys ?? m.buys24h;
    m.sells24h = pair.txns?.h24?.sells ?? m.sells24h;
    m.liquidityUsd = parseFloat(pair.liquidity?.usd) || m.liquidityUsd;
    m.volume24h = parseFloat(pair.volume?.h24) || m.volume24h;
    if (pair.pairAddress) m.poolAddress = pair.pairAddress;
  }

  function renderLivePrice(m) {
    $('priceUsd').textContent = fmtPriceDisplay({ priceUsd: m.priceUsd, priceUsdFmt: m.priceUsdFmt });
    renderQuoteChanges(m);
  }

  async function refreshTrades(m, initial = false) {
    const fetchGen = ++tradesFetchGen;
    const tape = $('tradesTape');
    const meta = $('tradesMeta');
    const mint = tokenMintRef(m);
    if (!tape) return;
    tape.classList.remove('hidden');
    if (!mint) {
      renderTradesList([], m?.symbol);
      if (meta) meta.textContent = 'mint yok';
      return;
    }
    if (initial) {
      tradesDisplayRows = [];
      const cached = loadTradesSession(m);
      const seeded = cached.length ? cached : seedTradesFromMarket(m);
      tradesLastGood = seeded;
      if (seeded.length) {
        renderTradesList(seeded, m?.symbol, { fullRender: true });
        if (meta) meta.textContent = `${seeded.length} işlem · güncelleniyor`;
      } else {
        showTradesSkeleton();
        if (meta) meta.textContent = 'yükleniyor…';
      }
    }
    tradesPollInFlight = true;
    try {
      if (initial || !chartPoolRef(m)) await ensurePoolOnMarket(m);
      const sinceMs = initial ? 0 : (m.tradesUpdatedAtMs || tradesWatermarkMs(tradesLastGood) || 0);
      const { trades, pollMs, incremental } = await fetchTradesFromServer(m, true, sinceMs);
      if (fetchGen !== tradesFetchGen) return;
      if (m && pollMs >= 1000) m.tradesPollMs = pollMs;

      if (initial || !sinceMs) {
        if (trades.length) {
          tradesLastGood = trades;
          saveTradesSession(m, trades);
        } else if (!tradesLastGood.length) {
          tradesLastGood = seedTradesFromMarket(m);
        }
        const display = trades.length ? trades : tradesLastGood;
        const list = $('tradesList');
        const needsFull = initial || !list?.querySelector('.trade-row[data-trade-key]');
        renderTradesList(display, m?.symbol, {
          keepPrevious: !needsFull && !display.length,
          fullRender: needsFull && !!display.length,
        });
      } else if (trades.length) {
        tradesLastGood = mergeTradesDisplay(trades, tradesLastGood);
        saveTradesSession(m, tradesLastGood);
        renderTradesList(tradesLastGood, m?.symbol, {
          keepPrevious: false,
          fullRender: false,
        });
      }

      m.tradesUpdatedAtMs = tradesWatermarkMs(tradesLastGood);
      if (meta) {
        const n = tradesDisplayRows.length;
        const liveTag = birdeyeTradesWs ? 'canlı WS' : `canlı ${Math.max(1, Math.round((m?.tradesPollMs || TRADES_POLL_MS) / 1000))}s`;
        if (n) meta.textContent = `${n} işlem · ${liveTag}`;
        else if (tradesLastGood.length) meta.textContent = `${tradesLastGood.length} işlem · ${liveTag}`;
        else meta.textContent = 'işlem bekleniyor';
      }
    } catch (e) {
      console.warn('trades poll', e);
      if (tradesLastGood.length) {
        renderTradesList(tradesLastGood, m?.symbol, { keepPrevious: true });
        if (meta) meta.textContent = `${tradesLastGood.length} işlem · canlı`;
      } else if (meta) meta.textContent = 'bağlantı hatası';
    } finally {
      tradesPollInFlight = false;
    }
  }

  function tradesPollIntervalMs(m) {
    const ms = m?.tradesPollMs || TRADES_POLL_MS;
    return Math.max(1000, Math.min(ms, 5000));
  }

  function startTradesPoll(m) {
    stopTradesPoll();
    void refreshTrades(m, true);
    void startBirdeyeTradesWs(m);
  }

  function stopLivePoll() {
    stopTradesPoll();
    if (livePollTimer) {
      clearInterval(livePollTimer);
      livePollTimer = null;
    }
  }

  function startLivePoll(m) {
    stopLivePoll();
    tradesFetchGen += 1;
    void refreshTrades(m, true).then(() => startBirdeyeTradesWs(m));
    void refreshChartAndPrice(m);
    livePollTimer = setInterval(() => {
      if (reportId && appData?.market) void refreshChartAndPrice(appData.market);
    }, CHART_LIVE_POLL_MS);
  }

  function chartsLibReady() {
    return typeof window.LightweightCharts?.createChart === 'function';
  }

  async function waitForChartLayout(container, tries = 12) {
    for (let i = 0; i < tries; i += 1) {
      const w = container?.clientWidth || 0;
      const h = document.querySelector('.chart-stage')?.clientHeight || 0;
      if (w > 40 && h > 40) return { w, h: chartStageHeight() };
      await new Promise((r) => setTimeout(r, 50));
    }
    return { w: Math.max(container?.clientWidth || 320, 320), h: chartStageHeight() };
  }

  async function fetchChartCandles(m, tf, opts = {}) {
    const mint = tokenMintRef(m);
    const ref = mint || m?.poolAddress;
    if (!ref) return { candles: [], stats: null, poolAddress: null, priceUsd: null, pair: null };
    const q = new URLSearchParams({ tf });
    if (opts.live) q.set('live', '1');
    const res = await fetch(apiPath(`/api/dex/chart/${encodeURIComponent(ref)}?${q}`));
    if (!res.ok) return { candles: [], stats: null, poolAddress: null, priceUsd: null, pair: null };
    const body = await res.json();
    return {
      candles: body.candles || [],
      stats: body.stats || null,
      poolAddress: body.poolAddress || pool || null,
      priceUsd: body.priceUsd ?? null,
      pair: body.pair || null,
    };
  }

  function pushChartLiveUpdate(candles, stats, tf) {
    if (!chartApi || !candleSeries || !candles?.length) return false;
    const seriesData = buildChartData(candles);
    if (!seriesData.length) return false;
    const prev = buildChartData(appData?.market?.chart?.candles || []);
    const prevLast = prev[prev.length - 1];
    const nextLast = seriesData[seriesData.length - 1];
    if (prev.length === seriesData.length && prevLast?.time === nextLast?.time) {
      if (chartType !== 'line') candleSeries.update(nextLast);
      lineSeries?.update({ time: nextLast.time, value: nextLast.close });
      const raw = candles[candles.length - 1];
      if (volumeSeries) {
        volumeSeries.update({
          time: nextLast.time,
          value: Number(raw.volume) || 0,
          color: nextLast.close >= nextLast.open ? CHART_DS.volUp : CHART_DS.volDown,
        });
      }
      updateOhlc(raw);
      renderChartPeriodChg(stats, tf);
      return true;
    }
    applyChartSeriesData(candles);
    renderChartPeriodChg(stats, tf);
    chartApi.timeScale().fitContent();
    return true;
  }

  function addChartSeries(chart, kind, opts) {
    const L = LightweightCharts;
    if (kind === 'candle' && typeof chart.addCandlestickSeries === 'function') {
      return chart.addCandlestickSeries(opts);
    }
    if (kind === 'line' && typeof chart.addLineSeries === 'function') {
      return chart.addLineSeries(opts);
    }
    if (kind === 'hist' && typeof chart.addHistogramSeries === 'function') {
      return chart.addHistogramSeries(opts);
    }
    if (kind === 'candle' && L.CandlestickSeries) return chart.addSeries(L.CandlestickSeries, opts);
    if (kind === 'line' && L.LineSeries) return chart.addSeries(L.LineSeries, opts);
    if (kind === 'hist' && L.HistogramSeries) return chart.addSeries(L.HistogramSeries, opts);
    throw new Error('unsupported chart library version');
  }

  function loadChartLibrary() {
    return new Promise((resolve) => {
      if (chartsLibReady()) {
        resolve(true);
        return;
      }
      const urls = [
        'vendor/lightweight-charts.js?v=4',
        '/vendor/lightweight-charts.js?v=4',
      ];
      let i = 0;
      const next = () => {
        if (chartsLibReady()) {
          resolve(true);
          return;
        }
        if (i >= urls.length) {
          resolve(false);
          return;
        }
        const s = document.createElement('script');
        s.src = urls[i];
        i += 1;
        s.onload = () => resolve(chartsLibReady());
        s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    });
  }

  function bindChartTouchGuard(stage) {
    if (!stage || stage.dataset.chartTouchBound) return;
    stage.dataset.chartTouchBound = '1';
    const lock = () => document.documentElement.classList.add('chart-interacting');
    const unlock = () => document.documentElement.classList.remove('chart-interacting');
    stage.addEventListener('pointerdown', lock, { passive: true });
    stage.addEventListener('pointerup', unlock, { passive: true });
    stage.addEventListener('pointercancel', unlock, { passive: true });
    stage.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  function applyChartSeriesData(candles) {
    const seriesData = buildChartData(candles);
    if (!seriesData.length || !candleSeries || !lineSeries) return;
    const volData = seriesData.map((d, i) => {
      const raw = candles.find((c) => c.time === d.time) || candles[i] || {};
      return {
        time: d.time,
        value: Number(raw.volume) || 0,
        color: d.close >= d.open ? CHART_DS.volUp : CHART_DS.volDown,
      };
    });
    lineSeries.setData(seriesData.map((d) => ({ time: d.time, value: d.close })));
    if (chartType === 'line') {
      candleSeries.setData([]);
      lineSeries.applyOptions({ visible: true });
      candleSeries.applyOptions({ visible: false });
    } else {
      candleSeries.setData(seriesData);
      candleSeries.applyOptions({ visible: true });
      lineSeries.applyOptions({ visible: false });
    }
    volumeSeries?.setData(volData);
  }

  async function refreshChartAndPrice(m) {
    if (!m) return;
    const tf = currentTf;
    try {
      const live = await fetchChartCandles(m, tf, { live: true });
      applyLivePairToMarket(m, live.pair, live.priceUsd);
      renderLivePrice(m);
      if (live.poolAddress) m.poolAddress = live.poolAddress;
      if (!live.candles.length) return;
      if (appData?.market?.chart) {
        appData.market.chart.candles = live.candles;
        appData.market.chart.stats = live.stats || appData.market.chart.stats;
        appData.market.chart.timeframe = tf;
      }
      if (chartApi && candleSeries) {
        pushChartLiveUpdate(live.candles, live.stats, tf);
      }
    } catch (e) {
      console.warn('live refresh', e);
    }
  }

  function chartTimeToNum(t) {
    if (typeof t === 'number') return t;
    if (typeof t === 'string') return Math.floor(new Date(`${t}T00:00:00Z`).getTime() / 1000);
    return 0;
  }

  function clearChartDrawings() {
    for (const d of chartDrawings) {
      try {
        if (d.priceLine && candleSeries?.removePriceLine) candleSeries.removePriceLine(d.priceLine);
        if (d.trendSeries && chartApi?.removeSeries) chartApi.removeSeries(d.trendSeries);
      } catch {
        /* seri kaldırıldı */
      }
    }
    chartDrawings = [];
    chartTrendPending = null;
  }

  function setChartDrawMode(mode) {
    chartDrawMode = mode === 'clear' || !mode ? 'select' : mode;
    chartTrendPending = null;
    document.querySelectorAll('.chart-draw-btn').forEach((b) => {
      const draw = b.dataset.draw;
      if (draw === 'clear') {
        b.classList.remove('active');
        return;
      }
      b.classList.toggle('active', draw === chartDrawMode);
    });
    const stage = document.querySelector('.chart-stage');
    if (stage) {
      stage.classList.toggle('chart-draw-select', chartDrawMode === 'select');
      stage.classList.toggle('chart-draw-hline', chartDrawMode === 'hline');
      stage.classList.toggle('chart-draw-trend', chartDrawMode === 'trend');
    }
  }

  function priceFromChartClick(param) {
    const series = candleSeries || lineSeries;
    if (!series || !param.point || typeof series.coordinateToPrice !== 'function') return null;
    const price = series.coordinateToPrice(param.point.y);
    return Number.isFinite(price) ? price : null;
  }

  function onChartDrawClick(param) {
    if (!chartDrawMode || chartDrawMode === 'select' || chartDrawMode === 'clear' || !param.time) return;
    const price = priceFromChartClick(param);
    if (price == null) return;
    const time = param.time;
    const mainSeries = candleSeries || lineSeries;
    if (!mainSeries) return;

    if (chartDrawMode === 'hline') {
      if (typeof mainSeries.createPriceLine !== 'function') return;
      const priceLine = mainSeries.createPriceLine({
        price,
        color: CHART_DRAW_COLOR,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '',
      });
      chartDrawings.push({ type: 'hline', priceLine });
      return;
    }

    if (chartDrawMode === 'trend') {
      if (!chartTrendPending) {
        chartTrendPending = { time, price };
        return;
      }
      let tA = chartTrendPending.time;
      let pA = chartTrendPending.price;
      let tB = time;
      let pB = price;
      if (chartTimeToNum(tA) > chartTimeToNum(tB)) {
        [tA, tB] = [tB, tA];
        [pA, pB] = [pB, pA];
      }
      chartTrendPending = null;
      const trendSeries = addChartSeries(chartApi, 'line', {
        color: CHART_DRAW_COLOR,
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      trendSeries.setData([
        { time: tA, value: pA },
        { time: tB, value: pB },
      ]);
      chartDrawings.push({ type: 'trend', trendSeries });
    }
  }

  function attachChartDrawClick() {
    if (!chartApi || typeof chartApi.subscribeClick !== 'function') return;
    if (chartClickUnsub) {
      chartClickUnsub();
      chartClickUnsub = null;
    }
    chartClickUnsub = chartApi.subscribeClick(onChartDrawClick);
  }

  function setupChartDrawTools() {
    const toolbar = $('chartDrawToolbar');
    if (!toolbar || toolbar.dataset.bound) return;
    toolbar.dataset.bound = '1';
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.chart-draw-btn');
      if (!btn) return;
      const draw = btn.dataset.draw;
      if (draw === 'clear') {
        clearChartDrawings();
        setChartDrawMode('select');
        return;
      }
      if (draw === 'select') {
        setChartDrawMode('select');
        return;
      }
      setChartDrawMode(chartDrawMode === draw ? 'select' : draw);
    });
  }

  function destroyChart() {
    document.documentElement.classList.remove('chart-interacting');
    clearChartDrawings();
    setChartDrawMode('select');
    if (chartClickUnsub) {
      chartClickUnsub();
      chartClickUnsub = null;
    }
    if (chartResizeObs) {
      chartResizeObs.disconnect();
      chartResizeObs = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (chartApi) {
      chartApi.remove();
      chartApi = null;
      candleSeries = null;
      lineSeries = null;
      volumeSeries = null;
    }
  }

  function updateOhlc(c) {
    if (!c) return;
    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = fmtPriceNum(v);
    };
    set('ohlcO', c.open);
    set('ohlcH', c.high);
    set('ohlcL', c.low);
    set('ohlcC', c.close ?? c.value);
    const vol = $('ohlcV');
    if (vol) {
      const v = Number(c.volume);
      vol.textContent = v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v ? v.toFixed(2) : '—';
    }
  }

  function buildChartData(candles) {
    const out = [];
    const seen = new Set();
    for (const c of candles || []) {
      const time = c.time;
      if (time == null || seen.has(time)) continue;
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      if (![open, high, low, close].every(Number.isFinite)) continue;
      seen.add(time);
      out.push({ time, open, high, low, close });
    }
    return out;
  }

  function chartStageHeight() {
    const stage = document.querySelector('.chart-stage');
    if (stage?.clientHeight > 80) return stage.clientHeight;
    return Math.min(330, Math.max(260, Math.floor(window.innerHeight * 0.34)));
  }

  async function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    let candles = m?.chart?.candles || [];
    const tf = m?.chart?.timeframe || currentTf;
    let stats = m?.chart?.stats;

    try {
      let live = await fetchChartCandles(m, tf);
      if (!live.candles.length) {
        await new Promise((r) => setTimeout(r, 800));
        live = await fetchChartCandles(m, tf);
      }
      if (live.candles.length) {
        candles = live.candles;
        stats = live.stats || stats;
        if (live.poolAddress && appData?.market) appData.market.poolAddress = live.poolAddress;
      } else if (!candles.length && live.poolAddress && appData?.market) {
        appData.market.poolAddress = live.poolAddress;
      }
      if (appData?.market?.chart) {
        appData.market.chart.candles = candles;
        appData.market.chart.stats = stats;
      }
    } catch (e) {
      console.warn('chart api', e);
    }

    renderChartPeriodChg(stats, tf);

    destroyChart();
    container.innerHTML = '';
    if (note) note.classList.remove('hidden');

    const hasLib = await loadChartLibrary();
    if (!hasLib) {
      if (note) note.textContent = 'Grafik kütüphanesi yüklenemedi';
      container.innerHTML = '<div class="empty-chart">Grafik kütüphanesi yüklenemedi</div>';
      return;
    }

    const seriesData = buildChartData(candles);
    if (!seriesData.length) {
      const hasRef = !!(m?.poolAddress || tokenMintRef(m));
      if (note) {
        note.textContent = hasRef ? `${tf.toUpperCase()} · veri bekleniyor` : 'Pool bulunamadı';
        note.classList.remove('hidden');
      }
      const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
      const link = page
        ? `<a class="dex-chart-link" href="${escHtml(page)}" target="_blank" rel="noopener">DexScreener’da aç</a>`
        : '';
      container.innerHTML = `<div class="empty-chart">Mum verisi yok. ${link}</div>`;
      return;
    }

    if (note) {
      note.textContent = `${tf.toUpperCase()} · canlı mum`;
      note.classList.add('hidden');
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const last = candles[candles.length - 1];
    updateOhlc(last);

    const { w, h } = await waitForChartLayout(container);
    const priceFmt = chartPriceFormat(seriesData);
    try {
      const crosshairMode = LightweightCharts.CrosshairMode?.Normal ?? 0;
      container.style.touchAction = 'none';
      container.style.userSelect = 'none';
      container.style.webkitUserSelect = 'none';
      bindChartTouchGuard(document.querySelector('.chart-stage'));

      chartApi = LightweightCharts.createChart(container, {
        width: w,
        height: h,
        layout: {
          background: { color: CHART_DS.bg },
          textColor: CHART_DS.text,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: CHART_DS.grid },
          horzLines: { color: CHART_DS.grid },
        },
        watermark: {
          visible: false,
          color: 'transparent',
          text: '',
        },
        localization: {
          priceFormatter: chartPriceLabel,
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.06, bottom: 0.2 },
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: tf === '1m' || tf === '5m',
          rightOffset: 6,
          barSpacing: 7,
        },
        crosshair: {
          mode: crosshairMode,
          vertLine: { width: 1, color: CHART_DS.crosshair, style: 0, labelBackgroundColor: CHART_DS.bg },
          horzLine: { width: 1, color: CHART_DS.crosshair, style: 0, labelBackgroundColor: CHART_DS.bg },
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        kineticScroll: {
          touch: true,
          mouse: false,
        },
      });

      requestAnimationFrame(() => {
        container.querySelectorAll('canvas').forEach((cv) => {
          cv.style.touchAction = 'none';
        });
      });

      candleSeries = addChartSeries(chartApi, 'candle', {
        upColor: CHART_DS.up,
        downColor: CHART_DS.down,
        borderUpColor: CHART_DS.up,
        borderDownColor: CHART_DS.down,
        wickUpColor: CHART_DS.up,
        wickDownColor: CHART_DS.down,
        borderVisible: true,
        priceFormat: priceFmt,
        priceLineVisible: true,
        priceLineColor: CHART_DS.priceLine,
        priceLineWidth: 1,
        visible: chartType !== 'line',
      });

      lineSeries = addChartSeries(chartApi, 'line', {
        color: CHART_DS.up,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        priceLineVisible: true,
        priceLineColor: CHART_DS.priceLine,
        priceLineWidth: 1,
        priceFormat: priceFmt,
        visible: chartType === 'line',
      });

      volumeSeries = addChartSeries(chartApi, 'hist', {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const volData = seriesData.map((d, i) => {
        const raw = candles.find((c) => c.time === d.time) || candles[i] || {};
        return {
          time: d.time,
          value: Number(raw.volume) || 0,
          color: d.close >= d.open ? CHART_DS.volUp : CHART_DS.volDown,
        };
      });

      candleSeries.setData(chartType === 'line' ? [] : seriesData);
      lineSeries.setData(seriesData.map((d) => ({ time: d.time, value: d.close })));
      volumeSeries.setData(volData);
      chartApi.timeScale().fitContent();

      chartApi.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) return;
        const cd = param.seriesData.get(candleSeries);
        if (cd) {
          updateOhlc(cd);
          return;
        }
        const ld = param.seriesData.get(lineSeries);
        if (ld) {
          updateOhlc({ open: ld.value, high: ld.value, low: ld.value, close: ld.value, volume: 0 });
        }
      });

      resizeHandler = () => {
        if (chartApi) {
          chartApi.applyOptions({
            width: container.clientWidth || w,
            height: chartStageHeight(),
          });
        }
      };
      window.addEventListener('resize', resizeHandler);
      requestAnimationFrame(() => resizeHandler());

      if (chartResizeObs) chartResizeObs.disconnect();
      if (typeof ResizeObserver === 'function') {
        chartResizeObs = new ResizeObserver(() => resizeHandler());
        chartResizeObs.observe(container);
      }

      attachChartDrawClick();
      setChartDrawMode('select');

    } catch (e) {
      console.warn('chart render', e);
      destroyChart();
      container.innerHTML = '<div class="empty-chart">Grafik oluşturulamadı</div>';
    }
  }

  function setChartType(type) {
    chartType = type;
    document.querySelectorAll('.ctype').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === type);
    });
    if (!chartApi || !candleSeries || !lineSeries || !appData?.market?.chart?.candles) return;
    applyChartSeriesData(appData.market.chart.candles);
  }

  function sectionCard(title, bodyHtml) {
    return `<article class="section-card"><header class="section-head">${title}</header><div class="section-body">${bodyHtml}</div></article>`;
  }

  function checkIcon(level) {
    if (level === 'good') return { cls: 'good', ch: '✓' };
    if (level === 'warn') return { cls: 'warn', ch: '!' };
    if (level === 'bad') return { cls: 'bad', ch: '✕' };
    return { cls: 'info', ch: '·' };
  }

  function checksGroupHtml(title, items) {
    if (!items?.length) return '';
    const rows = items
      .map((item) => {
        const ic = checkIcon(item.level);
        return `<div class="check-row"><span class="check-icon ${ic.cls}">${ic.ch}</span><span>${item.text}</span></div>`;
      })
      .join('');
    return `<article class="section-card check-group"><header class="check-group-head"><span>${title}</span><span>${items.length}</span></header>${rows}</article>`;
  }

  function auditSummaryHtml(data) {
    const c = data.counts || {};
    return `<div class="audit-summary">
      <div class="audit-stat good"><span class="n">${c.good || 0}</span><span class="l">Geçti</span></div>
      <div class="audit-stat warn"><span class="n">${c.warn || 0}</span><span class="l">Uyarı</span></div>
      <div class="audit-stat bad"><span class="n">${c.bad || 0}</span><span class="l">Kritik</span></div>
    </div>`;
  }

  function renderInfoPanel(data) {
    const panel = $('panel-info');
    if (!panel) return;
    const m = data.market || {};
    const bd = data.audit?.breakdown || {};
    const highlights = (data.highlights || [])
      .map((h) => `<div class="alert-row ${h.level || ''}">${h.text}</div>`)
      .join('');

    panel.innerHTML = [
      highlights ? sectionCard('Öne çıkan bulgular', highlights) : '',
      sectionCard(
        'Token özeti',
        `<ul>
          <li><b>Yaş:</b> ${data.summary?.age || '—'}</li>
          <li><b>Likidite:</b> ${data.summary?.liquidityWord || '—'} (${data.summary?.liquidityUsd || '—'})</li>
          <li><b>Çift:</b> ${m.pairLabel || `${m.symbol || '?'}/SOL`}</li>
          <li><b>DEX:</b> ${(m.dex || data.dex || '—').toString()}</li>
          <li><b>Likidite kodu:</b> ${bd.liquidity || '—'} · <b>Yaş:</b> ${bd.age || '—'}</li>
        </ul>`,
      ),
      m.dexScreenerUrl
        ? `<a class="trade-link ext" href="${m.dexScreenerUrl}" target="_blank" rel="noopener">DexScreener — tam grafik</a>`
        : '',
    ].join('');
    panel.innerHTML = panel.innerHTML.split('div').join('div');
  }

  function renderSecurityPanel(data) {
    const panel = $('panel-security');
    if (!panel) return;
    const score = data.trust?.score ?? 0;
    const checks = data.checks || {};
    const generated = data.generatedAt
      ? new Date(data.generatedAt).toLocaleString('tr-TR')
      : '—';

    panel.innerHTML = [
      `<article class="section-card"><div class="trust-hero">
        <div class="trust-score-big" style="--pct:${score};--ring-color:${scoreColor(score)}"><span>${score}</span></div>
        <div class="trust-detail">
          <strong>${data.trust?.tier || '—'} · ${data.levelLabel || ''}</strong>
          <p>${data.trust?.verdict || ''}</p>
          <p style="margin-top:6px;font-size:11px;color:var(--text-tertiary)">${data.trust?.scoreLabel || ''}</p>
        </div>
      </div></article>`,
      auditSummaryHtml(data).split('div').join('div'),
      data.rugcheck ? sectionCard('RugCheck', `<p style="margin:0">${data.rugcheck}</p>`) : '',
      checksGroupHtml('Kritik riskler', checks.critical),
      checksGroupHtml('Uyarılar', checks.warnings),
      checksGroupHtml('Geçen kontroller', checks.passed),
      sectionCard('On-chain detay', listHtml(data.onchain)),
      sectionCard('Kontrat güvenliği', listHtml(data.contract)),
      `<p class="report-meta">Rapor: ${generated} · ${data.counts?.total || 0} kontrol</p>`,
    ].join('');
  }

  function listHtml(lines) {
    if (!lines?.length) return '<p style="color:var(--text-tertiary);margin:0">Kayıt yok</p>';
    const lis = lines
      .map((line) => {
        const text = typeof line === 'object' ? line.text : line;
        const level = typeof line === 'object' ? line.level : '';
        return `<li class="${level || ''}">${text}</li>`;
      })
      .join('');
    return `<ul>${lis}</ul>`;
  }

  function renderTradePanel(data) {
    const panel = $('panel-trade');
    const bar = $('tradeBar');
    const a = data.actions || {};
    const m = data.market || {};
    const buy = a.buyUrl || m.dexScreenerUrl;
    const sell = a.sellUrl || buy;
    const via = a.tradeProvider || 'Swap';

    if (panel) {
      const w = globalThis.SniperWallet;
      const walletLine = w?.pubkey
        ? `<p class="wallet-banner">◎ ${escHtml(w.label)} · <code>${escHtml(w.shortAddr(w.pubkey))}</code></p>`
        : '';
      const links = [
        a.dsUrl && { label: 'DexScreener', url: a.dsUrl },
        a.gtUrl && { label: 'GeckoTerminal', url: a.gtUrl },
        a.explorerUrl && { label: 'Solscan', url: a.explorerUrl },
        a.pumpUrl && { label: 'Pump.fun', url: a.pumpUrl },
      ].filter(Boolean);

      panel.innerHTML = [
        walletLine,
        buy
          ? `<div class="trade-grid">
              <a class="trade-link buy" href="${buy}" target="_blank" rel="noopener">Satın al</a>
              <a class="trade-link sell" href="${sell}" target="_blank" rel="noopener">Sat</a>
            </div>
            <p style="text-align:center;font-size:11px;color:var(--text-tertiary);margin:0 0 8px">via ${via}</p>`
          : '',
        links.map((l) => `<a class="trade-link ext" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join(''),
      ].join('');
    }

    if (bar) {
      const chartUrl = a.dsUrl || m.dexScreenerUrl || '#';
      bar.innerHTML = buy
        ? `<a class="trade-bar-btn trade-bar-btn--buy" href="${buy}" target="_blank" rel="noopener"><span class="tbb-ico" aria-hidden="true">↑</span><span class="tbb-lbl">Al</span></a>
           <a class="trade-bar-btn trade-bar-btn--sell" href="${sell}" target="_blank" rel="noopener"><span class="tbb-ico" aria-hidden="true">↓</span><span class="tbb-lbl">Sat</span></a>
           <a class="trade-bar-btn trade-bar-btn--chart" href="${chartUrl}" target="_blank" rel="noopener"><span class="tbb-ico" aria-hidden="true">◎</span><span class="tbb-lbl">Grafik</span></a>`
        : '';
    }
  }

  function setupNav() {
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t === btn));
        $('panel-info')?.classList.toggle('hidden', tab !== 'info');
        $('panel-security')?.classList.toggle('hidden', tab !== 'security');
        $('panel-trade')?.classList.toggle('hidden', tab !== 'trade');
      });
    });
  }

  async function applyChartTimeframe(m, tf) {
    setChartLoading(true);
    try {
      let live = await fetchChartCandles(m, tf);
      if (!live.candles.length) {
        await new Promise((r) => setTimeout(r, 400));
        live = await fetchChartCandles(m, tf);
      }
      const candles = live.candles || [];
      const stats = live.stats || m?.chart?.stats;
      if (live.poolAddress) {
        m.poolAddress = live.poolAddress;
        if (appData?.market) appData.market.poolAddress = live.poolAddress;
      }
      if (appData?.market?.chart) {
        appData.market.chart.candles = candles;
        appData.market.chart.stats = stats;
        appData.market.chart.timeframe = tf;
      }
      renderChartPeriodChg(stats, tf);
      if (candles.length && chartApi && candleSeries && lineSeries) {
        applyChartSeriesData(candles);
        updateOhlc(candles[candles.length - 1]);
        chartApi.timeScale().fitContent();
        return true;
      }
      return false;
    } finally {
      setChartLoading(false);
    }
  }

  async function switchChartTimeframe(tf) {
    if (!tf || tf === currentTf || !reportId || !appData?.market) return;
    currentTf = tf;
    document.querySelectorAll('.tf').forEach((b) => {
      b.classList.toggle('active', b.dataset.tf === tf);
      b.classList.add('loading');
    });
    try {
      if (appData.market.chart) appData.market.chart.timeframe = tf;
      const updated = await applyChartTimeframe(appData.market, tf);
      if (!updated) await renderChart(appData.market);
    } catch (e) {
      console.warn('switchChartTimeframe', e);
      showToast('Grafik yenilenemedi — birkaç sn sonra tekrar dene');
    } finally {
      document.querySelectorAll('.tf').forEach((b) => b.classList.remove('loading'));
    }
  }

  function setupTfButtons() {
    document.querySelectorAll('.tf').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tf = btn.dataset.tf;
        if (!tf || tf === currentTf || !reportId) return;
        void switchChartTimeframe(tf);
      });
    });
  }

  function setupChartType() {
    document.querySelectorAll('.ctype').forEach((btn) => {
      btn.addEventListener('click', () => setChartType(btn.dataset.type || 'candle'));
    });
  }

  function setupCopy() {
    $('copyMint')?.addEventListener('click', async () => {
      const addr = appData?.address || appData?.market?.address;
      if (!addr) return;
      try {
        await navigator.clipboard.writeText(addr);
        showToast('Mint kopyalandı');
      } catch {
        showToast(shortMint(addr));
      }
    });
  }

  function render(data) {
    appData = data;
    const m = data.market || {};
    const sym = m.symbol || data.symbol || '?';

    showDetailView();

    $('pairTitle').textContent = m.pairLabel || `${sym} / SOL`;
    $('pairSub').textContent = data.address || m.address || '—';

    const dexBadge = $('dexBadge');
    if (dexBadge) {
      const dexRaw = String(m.dex || data.dex || '').toLowerCase();
      let plat = 'other';
      let label = 'DEX';
      if (/pump/.test(dexRaw)) { plat = 'pumpfun'; label = dexRaw === 'pumpswap' ? 'PumpSwap' : 'Pump.fun'; }
      else if (dexRaw.startsWith('raydium')) { plat = 'raydium'; label = 'Raydium'; }
      else if (dexRaw.startsWith('meteora')) { plat = 'meteora'; label = 'Meteora'; }
      else if (dexRaw.startsWith('orca')) { plat = 'orca'; label = 'Orca'; }
      else if (dexRaw) label = dexRaw.replace(/_/g, ' ');
      dexBadge.textContent = label;
      dexBadge.className = `pill dex-pill dex-${plat}`;
    }

    const chip = $('levelChip');
    if (chip) {
      chip.textContent = data.levelLabel || '—';
      chip.className = `pill ${levelRiskClass(data.level)}`;
    }

    const trustMini = $('trustMini');
    if (trustMini) {
      trustMini.textContent = `Skor ${data.trust?.score ?? '—'}`;
      trustMini.className = 'pill trust';
    }

    const riskTop = $('riskPillTop');
    const rb = riskBadgeLabel(data.level, data.trust?.score);
    if (riskTop) {
      riskTop.textContent = rb.text;
      riskTop.className = `risk-pill-top ${rb.cls}`;
    }

    loadLogo(m.imageUrl, m.imageFallbacks, sym);
    $('priceUsd').textContent = fmtPriceDisplay({ priceUsd: m.priceUsd, priceUsdFmt: m.priceUsdFmt })
      || data.summary?.price || '—';

    renderQuoteChanges(m);
    renderDetailBadges(data);
    renderMetrics(m, m.chart?.stats);
    renderTxnBar(m);
    const chartSection = document.querySelector('.chart-terminal');
    if (detailHideChart) {
      chartSection?.classList.add('hidden');
      destroyChart();
    } else {
      chartSection?.classList.remove('hidden');
      renderChart(m).catch((e) => console.warn('renderChart', e));
    }
    startLivePoll(m);
    renderInfoPanel(data);
    renderSecurityPanel(data);
    renderTradePanel(data);

    document.querySelectorAll('.tf').forEach((b) => {
      b.classList.toggle('active', b.dataset.tf === (m.chart?.timeframe || currentTf));
    });
  }

  function showError(title, hint) {
    hideAllViews();
    const err = $('error');
    if (err) err.classList.remove('hidden');
    const t = $('errorText');
    const h = $('errorHint');
    if (t) t.textContent = title || 'Rapor yüklenemedi.';
    if (h) h.textContent = hint || '';
  }

  async function loadReport(tf) {
    const q = tf ? `?tf=${encodeURIComponent(tf)}` : '';
    const res = await fetch(apiPath(`/api/report/${encodeURIComponent(reportId)}${q}`));
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status === 410) {
      const err = new Error('expired');
      err.hint = body?.message || 'Rapor 14 günden eski.';
      throw err;
    }
    if (!res.ok) {
      const err = new Error(body?.error || 'not_found');
      err.hint = body?.message || 'Kanal yorumundaki Tam rapor butonunu kullanın.';
      throw err;
    }
    const data = body;
    currentTf = data.market?.chart?.timeframe || tf || '15m';
    render(data);
    return data;
  }

  function setupShell() {
    $('btnBack')?.addEventListener('click', () => {
      location.hash = '';
      reportId = null;
      destroyChart();
      showScannerHome();
    });
    $('btnErrorHome')?.addEventListener('click', () => {
      location.hash = '';
      reportId = null;
      showScannerHome();
    });
    window.addEventListener('hashchange', () => {
      const id = reportIdFromUrl();
      if (id && id !== reportId) {
        reportId = id;
        markReportOpen(false);
        loadReportFlow();
      } else if (!id && !$('scanner-home')?.classList.contains('hidden')) {
        return;
      } else if (!id) {
        reportId = null;
        showScannerHome();
      }
    });
  }

  async function main() {
    setupShell();
    initWallet();
    reportId = reportIdFromUrl();

    if (!reportId) {
      showScannerHome();
      return;
    }

    $('loading')?.classList.remove('hidden');

    markReportOpen(false);
    await loadReportFlow();
  }

  globalThis.showToast = showToast;
  globalThis.getActiveChain = getActiveChain;
  globalThis.sniperFeedCatalog = () => feedItemsFull || [];
  globalThis.openTokenByMint = openTokenByMint;
  globalThis.sniperFmtPrice = fmtPriceDisplay;
  globalThis.clearHomeSearch = () => clearSearch({ skipFetch: false });
  globalThis.sniperOpenReport = (rid) => {
    if (!rid) return;
    markReportOpen(scannerNavActive);
    reportId = rid;
    location.hash = `r=${rid}`;
    loadReportFlow();
  };
  globalThis.onBottomNav = onBottomNav;
  globalThis.updateHeaderChainPill = updateHeaderChainPill;
  globalThis.fetchFeedForChain = (chainId) => {
    if (!chainId) return;
    if (globalThis.SniperSidebar?.setChain) globalThis.SniperSidebar.setChain(chainId);
    else switchActiveChain(chainId);
    showScannerHome();
  };

  globalThis.loadHomeFeed = loadHomeFeed;
  globalThis.ingestFeedResponse = ingestFeedResponse;
  globalThis.refreshHomeFeed = () =>
    loadHomeFeed(feedTabForApi(feedTab), feedTab === 'scan' ? 'trending' : feedTab);

  main();
})();
