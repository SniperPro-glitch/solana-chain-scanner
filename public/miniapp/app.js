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
  let livePollTimer = null;

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
  let dexTradesEmbedRef = '';
  const CHART_LIVE_POLL_MS = 2000;
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
    const b = band === 'none' || label === '—' ? 'none' : band;
    const lbl = label === '—' ? '—' : label;
    const title = b === 'none' ? ' title="Henüz SNIPER taraması yok"' : '';
    return `<div class="tr-risk-col">${spark}<span class="risk-badge ${b}"${title}>${escHtml(lbl)}</span></div>`;
  }

  const PLACEHOLDER_TOKENS = [
    { rank: 1, symbol: 'BONK', pairLabel: 'BONK/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', reportId: 'dev', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263.png?size=sm' },
    { rank: 2, symbol: 'WIF', pairLabel: 'WIF/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', reportId: 'dev', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm.png?size=sm' },
    { rank: 3, symbol: 'POPCAT', pairLabel: 'POPCAT/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'mid', label: 'MEDIUM RISK' }, mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t1GHn2a4gyyg9WH', reportId: 'dev', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t1GHn2a4gyyg9WH.png?size=sm' },
    { rank: 4, symbol: 'JUP', pairLabel: 'JUP/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: 'JUPyiwrYJFskUPiHa7HPQc8J4iHmuxcKoCx8xNv4Sol', reportId: 'dev', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/JUPyiwrYJFskUPiHa7HPQc8J4iHmuxcKoCx8xNv4Sol.png?size=sm' },
    { rank: 5, symbol: 'RAY', pairLabel: 'RAY/SOL', priceUsdFmt: '…', change1h: null, change24h: null, volume24hFmt: '—', liquidityUsdFmt: '—', marketCapUsdFmt: '—', risk: { band: 'low', label: 'LOW RISK' }, mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', reportId: 'dev', imageUrl: 'https://dd.dexscreener.com/ds-data/tokens/solana/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png?size=sm' },
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

  const SWAP_BADGE_SRC = 'assets/swap-badge.png?v=2';

  /** Üçüncü taraf marka adlarını kullanıcı metninden çıkar (Sniper hariç). */
  function stripExternalBrands(text) {
    let s = String(text ?? '');
    const rules = [
      [/dex\s*screener/gi, 'canlı piyasa'],
      [/goplus/gi, 'güvenlik taraması'],
      [/rug\s*check/gi, 'rug analizi'],
      [/geckoterminal/gi, 'grafik'],
      [/solscan/gi, 'explorer'],
      [/pump\.fun/gi, 'launchpad'],
      [/pumpswap/gi, 'bonding AMM'],
      [/jupiter/gi, 'swap'],
      [/birdeye/gi, 'piyasa verisi'],
    ];
    for (const [re, rep] of rules) s = s.replace(re, rep);
    return s;
  }

  function tradeViaLabel(provider) {
    return stripExternalBrands(provider || 'Swap') || 'Swap';
  }

  function pumpDexLabel(dexKey) {
    return dexKey === 'pumpswap' ? 'Bonding AMM' : 'Launchpad';
  }

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
    const fromSearch = new URLSearchParams(location.search).get('r');
    if (fromSearch) return fromSearch;
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash || hash.includes('tgWebApp')) return null;
    const params = new URLSearchParams(hash.includes('=') ? hash : `r=${hash}`);
    return params.get('r');
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

  function syncAppChrome() {
    refreshTgViewport();
  }

  function showScannerHome() {
    stopTradesPoll();
    stopLivePoll();
    if (typeof globalThis.closeSearchOverlay === 'function') globalThis.closeSearchOverlay();
    document.documentElement.classList.remove('detail-mode');
    syncAppChrome();
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
    document.querySelector('.detail-body .detail-end-spacer')?.remove();
  }

  let activeDetailTab = 'chart';

  function switchDetailTab(tabId) {
    const id = String(tabId || 'chart');
    activeDetailTab = id;
    document.querySelectorAll('.detail-tab').forEach((el) => {
      const on = el.id === `dtab-${id}`;
      el.classList.toggle('active', on);
      el.classList.toggle('hidden', !on);
    });
    document.querySelectorAll('.dbn-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.dtab === id);
    });
    const scrollEl = document.querySelector('.detail-body');
    if (scrollEl) scrollEl.scrollTop = 0;
    if ((id === 'chart' || id === 'txns') && appData?.market) {
      void startDexTradesPanel(appData.market);
      scheduleDexTradesCrop();
    }
    if (id === 'chart' && appData?.market) {
      void renderChart(appData.market).then(() => scheduleDexTradesCrop());
    }
    if (id === 'info' && appData) {
      const im = appData.market || {};
      renderInfoPanel(appData);
      renderMetrics(im, appData);
      renderInfoAuditCard(appData);
      renderTxnBar(im);
    }
    if (id === 'security' && appData) {
      renderSecurityPanel(appData);
    }
    if (id === 'txns' && appData) {
      globalThis.SniperTrade?.render?.(appData);
    }
    const bar = $('tradeBar');
    if (bar) {
      bar.classList.toggle('trade-bar--terminal', id === 'txns');
    }
  }

  function openDetailWithChartTab() {
    switchDetailTab('chart');
  }

  function showDetailView() {
    hideAllViews();
    document.documentElement.classList.add('detail-mode');
    syncAppChrome();
    $('view-detail')?.classList.remove('hidden');
    ensureDetailSpacer();
    openDetailWithChartTab();
    if (globalThis.SniperDexCrop?.onDetailOpen) SniperDexCrop.onDetailOpen();
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
    $('trendingBand')?.classList.toggle('hidden', isNp);
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
    const c = CHAIN_UI[chain] || { short: String(chain || '').toUpperCase().slice(0, 4), label: chain, src: 'Canlı piyasa' };
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
    const c = CHAIN_UI[chainKey] || { label: chainKey, src: 'Canlı piyasa' };
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

  function isLocalDevHost() {
    try {
      const h = String(location.hostname || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1';
    } catch {
      return false;
    }
  }

  function ingestFeedResponse(body, q) {
    let items = body?.items?.length ? body.items : [];
    if (!items.length && isLocalDevHost()) {
      items = PLACEHOLDER_TOKENS.map((x) => ({ ...x }));
      body = {
        ...body,
        items,
        empty: false,
        emptyMessage: '',
        emptyKind: '',
        stats: body?.stats || PLACEHOLDER_STATS,
      };
    }
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

  async function copyMintAddress() {
    const addr = appData?.address || appData?.market?.address;
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      showToast('Mint kopyalandı');
    } catch {
      showToast(shortMint(addr));
    }
  }

  function bindDetailShell() {
    if (detailShellBound) return;
    detailShellBound = true;
    setupNav();
    setupTfButtons();
    setupChartType();
    setupCopy();
    $('dtab-info')?.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.info-copy-addr');
      if (!btn) return;
      const addr = btn.dataset.copyAddr;
      if (!addr) return;
      try {
        await navigator.clipboard.writeText(addr);
        showToast('Adres kopyalandı');
      } catch {
        showToast(shortMint(addr));
      }
    });
    $('btnAiSummary')?.addEventListener('click', () => switchDetailTab('security'));
    $('btnShareReport')?.addEventListener('click', async () => {
      const url = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Sniper rapor', url });
          return;
        }
        await navigator.clipboard.writeText(url);
        showToast('Link kopyalandı');
      } catch {
        showToast('Paylaşım iptal');
      }
    });
    $('btnWatchlist')?.addEventListener('click', () => showToast('Watchlist yakında'));
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

  function fmtUsdShort(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return '—';
    if (x >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
    if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
    if (x >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
    return `$${x.toFixed(2)}`;
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

  function bindTradeBar() {
    const bar = $('tradeBar');
    if (!bar || bar.dataset.tradeBound) return;
    bar.dataset.tradeBound = '1';
    bar.addEventListener('click', (ev) => {
      const tabBtn = ev.target.closest('[data-trade-tab]');
      if (tabBtn?.dataset.tradeTab) {
        switchDetailTab(tabBtn.dataset.tradeTab);
        if (appData) globalThis.SniperTrade?.render?.(appData);
        return;
      }
      const quick = ev.target.closest('[data-trade-quick]');
      if (!quick?.dataset.tradeQuick) return;
      const side = quick.dataset.tradeQuick;
      if (activeDetailTab !== 'txns') {
        switchDetailTab('txns');
        if (appData) globalThis.SniperTrade?.render?.(appData);
      }
      globalThis.SniperTrade?.quickTrade?.(side);
    });
  }

  function initWallet() {
    const w = globalThis.SniperWallet;
    if (!w) return;
    w.restore();
    w.onChange(() => updateConnectButton());
    updateConnectButton();
    bindTradeBar();
    $('btnConnect')?.addEventListener('click', async () => {
      try {
        if (w.pubkey) {
          await w.disconnect();
          showToast('Bağlantı kesildi');
        } else {
          globalThis.SniperTrade?.openWalletModal?.();
        }
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

  function renderHeroShell(data) {
    const m = data.market || {};
    const score = data.trust?.score;
    const rb = riskBadgeLabel(data.level, score);

    const chip = $('heroRiskChip');
    if (chip) {
      chip.textContent = rb.text;
      chip.className = `hero-risk-chip ${rb.cls}`;
    }

    const chg24 = $('heroChg24');
    if (chg24) {
      const val = m.priceChange24h;
      const text = formatPct(val);
      chg24.textContent = text ? `24H ${text}` : '24H —';
      chg24.className = `hero-chg24 ${chgClass(val)}`;
    }

    const stats = $('heroStats');
    if (!stats) return;
    const cells = [
      { lbl: '24H Vol', val: m.volume24hFmt || '—' },
      { lbl: 'Likidite', val: m.liquidityUsdFmt || data.summary?.liquidityUsd || '—' },
      { lbl: 'MCap', val: m.marketCapUsdFmt || '—' },
      { lbl: 'Skor', val: score != null ? String(score) : '—', cls: 'hero-stat-score' },
    ];
    stats.innerHTML = cells
      .map(
        (c) =>
          `<div class="hero-stat"><span class="hero-stat-lbl">${escHtml(c.lbl)}</span><span class="hero-stat-val ${c.cls || ''}">${escHtml(c.val)}</span></div>`,
      )
      .join('');
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

  function normalizeSocialUrl(raw, platform) {
    let u = String(raw || '').trim();
    if (!u) return null;
    const plat = String(platform || '').toLowerCase();
    if (u.startsWith('@')) {
      const handle = u.slice(1).replace(/^\/+/, '');
      if (!handle) return null;
      if (plat.includes('telegram') || plat.includes('twitter') || plat.includes('x')) {
        return plat.includes('telegram') ? `https://t.me/${handle}` : `https://x.com/${handle}`;
      }
      return `https://t.me/${handle}`;
    }
    if (/^(t\.me|telegram\.me)\//i.test(u)) u = `https://${u}`;
    if (!/^https?:\/\//i.test(u)) {
      if (/^(t\.me|telegram\.me|x\.com|twitter\.com)\//i.test(u)) u = `https://${u}`;
      else if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) u = `https://${u}`;
      else if (plat.includes('telegram')) u = `https://t.me/${u.replace(/^\/+/, '')}`;
      else return null;
    }
    return u;
  }

  function socialHostname(url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function isTwitterUrl(url) {
    const h = socialHostname(url);
    return h === 'x.com' || h === 'twitter.com' || h.endsWith('.twitter.com');
  }

  function isTelegramUrl(url) {
    const h = socialHostname(url);
    return h === 't.me' || h === 'telegram.me' || h.endsWith('.telegram.me');
  }

  function canonicalTwitterUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      const h = socialHostname(url);
      if (h !== 'x.com' && h !== 'twitter.com' && !h.endsWith('.twitter.com')) return url;
      const parts = u.pathname.split('/').filter(Boolean);
      const handle = parts[0];
      if (!handle) return url;
      return `https://x.com/${handle}`;
    } catch {
      return url;
    }
  }

  function pickBestTwitterUrl(urls) {
    const list = [...new Set((urls || []).map((u) => canonicalTwitterUrl(u)).filter(Boolean))];
    if (!list.length) return null;
    const xHost = list.find((u) => socialHostname(u) === 'x.com');
    return xHost || list[0];
  }

  function classifySocialUrl(url, typeHint) {
    const type = String(typeHint || '').toLowerCase();
    if (type.includes('telegram')) return 'telegram';
    if (type.includes('twitter') || type === 'x') return 'twitter';
    if (isTelegramUrl(url)) return 'telegram';
    if (isTwitterUrl(url)) return 'twitter';
    return 'website';
  }

  function extractSocialFromText(text) {
    const src = String(text || '');
    const tg = src.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[\w_+/.-]+/i);
    const tw = src.match(/(?:https?:\/\/)?(?:twitter\.com|x\.com)\/[\w_/.-]+/i);
    return {
      telegram: tg ? normalizeSocialUrl(tg[0]) : null,
      twitter: tw ? normalizeSocialUrl(tw[0]) : null,
    };
  }

  function parseInfoSocialLinks(data) {
    const act = data.actions || {};
    const m = data.market || {};
    const mint = data.address || m.address || '';
    const out = {
      website: null,
      twitter: null,
      telegram: null,
      explorer: act.explorerUrl || (mint ? `https://solscan.io/token/${mint}` : null),
    };

    const twitterCandidates = [];
    const seenSocial = new Set();

    const assign = (kind, raw, typeHint) => {
      const url = normalizeSocialUrl(raw, typeHint || kind);
      if (!url) return;
      const bucket = classifySocialUrl(url, typeHint || kind);
      const dedupeKey =
        bucket === 'twitter'
          ? `twitter:${canonicalTwitterUrl(url)}`
          : bucket === 'telegram'
            ? `telegram:${socialHostname(url)}:${url.replace(/\/$/, '').toLowerCase()}`
            : `${bucket}:${url.replace(/\/$/, '').toLowerCase()}`;
      if (seenSocial.has(dedupeKey)) return;
      seenSocial.add(dedupeKey);

      if (bucket === 'telegram') {
        if (!out.telegram) out.telegram = url;
        return;
      }
      if (bucket === 'twitter') {
        twitterCandidates.push(url);
        return;
      }
      if (isTwitterUrl(url) || isTelegramUrl(url)) return;
      if (!out.website) out.website = url;
    };

    const socialList = [...(m.socials || []), ...(data.socials || [])];
    for (const s of socialList) {
      const type = String(s?.type || s?.platform || s?.label || '').toLowerCase();
      const raw = s?.url || s?.link || s?.handle || '';
      if (type === 'x' || type === 'twitter') assign('twitter', raw, 'twitter');
      else assign(type.includes('telegram') ? 'telegram' : type, raw, type);
    }

    for (const w of m.websites || []) {
      const raw = typeof w === 'string' ? w : w?.url || w?.link || w?.handle || '';
      const label = typeof w === 'object' ? String(w?.label || w?.type || '').toLowerCase() : '';
      if (label === 'x' || label === 'twitter') assign('twitter', raw, 'twitter');
      else assign(label || 'website', raw, label);
    }

    const fromDesc = extractSocialFromText(m.description);
    if (!out.telegram && fromDesc.telegram) out.telegram = fromDesc.telegram;
    if (fromDesc.twitter) twitterCandidates.push(fromDesc.twitter);

    out.twitter = pickBestTwitterUrl(twitterCandidates);

    const pump = String(act.pumpUrl || '').trim();
    if (pump.startsWith('http') && !out.website && !/t\.me|telegram\./i.test(pump)) {
      out.website = pump;
    }

    if (out.website && isTwitterUrl(out.website)) {
      out.twitter = pickBestTwitterUrl([...twitterCandidates, out.website]);
      out.website = null;
    }
    if (out.website && isTelegramUrl(out.website)) {
      if (!out.telegram) out.telegram = out.website;
      out.website = null;
    }
    if (out.website && out.twitter && canonicalTwitterUrl(out.website) === canonicalTwitterUrl(out.twitter)) {
      out.website = null;
    }

    return out;
  }

  const INFO_CHAIN_ICONS = {
    solana: 'assets/chains/chain-solana.png?v=1',
  };

  const INFO_SOCIAL_ICONS = {
    website: null,
    telegram: 'assets/social-telegram.png?v=1',
    x: 'assets/social-x.png?v=1',
    explorer: 'assets/chains/chain-solana.png?v=1',
  };

  const INFO_SOCIAL_ORDER = [
    { key: 'website', label: 'Web sitesi' },
    { key: 'telegram', label: 'Telegram' },
    { key: 'twitter', label: 'X', iconKey: 'x' },
    { key: 'explorer', label: 'Explorer' },
  ];

  const INFO_DEX_ICONS = {
    pumpfun: 'assets/dex-pumpfun.png?v=1',
    pumpswap: 'assets/dex-pumpfun.png?v=1',
    raydium: 'assets/dex-raydium.png?v=1',
    meteora: 'assets/dex-meteora.png?v=1',
    orca: 'assets/dex-orca.png?v=1',
  };

  function infoDexPlatform(dexRaw) {
    const dex = String(dexRaw || '').toLowerCase().replace(/-v\d+$/, '').trim();
    if (!dex) return null;
    if (dex === 'pumpswap' || dex.includes('pumpswap')) {
      return { key: 'pumpswap', label: pumpDexLabel('pumpswap') };
    }
    if (dex === 'pumpfun' || dex === 'pump') {
      return { key: 'pumpfun', label: pumpDexLabel('pumpfun') };
    }
    if (dex.startsWith('raydium')) return { key: 'raydium', label: 'Raydium' };
    if (dex.startsWith('meteora')) return { key: 'meteora', label: 'Meteora' };
    if (dex.startsWith('orca')) return { key: 'orca', label: 'Orca' };
    return { key: 'other', label: dex.replace(/_/g, ' ') };
  }

  function infoLaunchPlatform(swapKey) {
    if (swapKey === 'pumpswap') return { key: 'pumpfun', label: pumpDexLabel('pumpfun') };
    return null;
  }

  function infoRouteIcon(src, dexStyle) {
    if (!src) return '';
    return `<img class="info-route-ico${dexStyle ? ' info-route-ico--dex' : ''}" src="${src}" alt="" width="14" height="14" decoding="async" />`;
  }

  function infoRouteSeg(label, iconSrc, dexStyle) {
    return `<span class="info-route-seg">${infoRouteIcon(iconSrc, dexStyle)}<span>${escHtml(label)}</span></span>`;
  }

  function renderInfoHeroRoute(data) {
    const el = $('infoHeroRoute');
    if (!el) return;
    const m = data.market || {};
    const dexRaw = m.dex || data.dex || '';
    const swap = infoDexPlatform(dexRaw);
    const launch = swap ? infoLaunchPlatform(swap.key) : null;
    const chainIcon = INFO_CHAIN_ICONS.solana;
    const parts = [infoRouteSeg('Solana', chainIcon, false)];
    if (swap) {
      const swapIcon = INFO_DEX_ICONS[swap.key] || null;
      parts.push(
        '<span class="info-route-sep" aria-hidden="true">›</span>',
        infoRouteSeg(swap.label, swapIcon, true),
      );
      if (launch && launch.label !== swap.label) {
        const launchIcon = INFO_DEX_ICONS[launch.key] || null;
        parts.push(
          '<span class="info-route-sep" aria-hidden="true">›</span>',
          '<span class="info-route-via">via</span>',
          infoRouteSeg(launch.label, launchIcon, true),
        );
      }
    }
    el.innerHTML = parts.join('');
  }

  function infoSocialIconHtml(kind) {
    const src = INFO_SOCIAL_ICONS[kind];
    if (src) {
      return `<img class="info-social-ico-img" src="${escHtml(src)}" alt="" width="12" height="12" decoding="async" />`;
    }
    if (kind === 'website') {
      return `<svg class="info-social-ico-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6-4 9s1.5 6.2 4 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    }
    return '';
  }

  function infoSocialBtn(label, kind, url) {
    const icon = infoSocialIconHtml(kind);
    const inner = `<span class="info-social-ico">${icon}</span>
      <span class="info-social-lbl">${escHtml(label)}</span>
      <span class="info-social-ext" aria-hidden="true">${url ? '↗' : '—'}</span>`;
    if (!url) {
      return `<span class="info-social-btn is-disabled" role="listitem" aria-disabled="true" title="Bağlantı yok">${inner}</span>`;
    }
    return `<a class="info-social-btn" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" role="listitem">
      ${inner}
    </a>`;
  }

  function renderInfoHero(data) {
    const m = data.market || {};
    const sym = m.symbol || data.symbol || '?';
    const name = m.name || sym;

    const nameEl = $('infoHeroName');
    if (nameEl) nameEl.textContent = name;
    const symEl = $('infoHeroSym');
    if (symEl) symEl.textContent = sym;
    renderInfoHeroRoute(data);

    const descEl = $('infoHeroDesc');
    const desc = m.description || '';
    if (descEl) {
      if (desc) {
        descEl.textContent = desc;
        descEl.classList.remove('hidden');
      } else {
        descEl.textContent = '';
        descEl.classList.add('hidden');
      }
    }

    const logo = $('infoHeroLogo');
    const fb = $('infoHeroLogoFb');
    if (logo && fb) {
      if (m.imageUrl) {
        logo.src = m.imageUrl;
        logo.alt = sym;
        logo.classList.remove('hidden');
        fb.classList.add('hidden');
        logo.onerror = () => {
          logo.classList.add('hidden');
          fb.textContent = sym.slice(0, 2);
          fb.classList.remove('hidden');
        };
      } else {
        logo.classList.add('hidden');
        fb.textContent = sym.slice(0, 2);
        fb.classList.remove('hidden');
      }
    }

    const social = parseInfoSocialLinks(data);
    const row = $('infoSocialRow');
    if (row) {
      row.setAttribute('role', 'list');
      const btns = INFO_SOCIAL_ORDER.map((item) => {
        const url = social[item.key] || null;
        const iconKey = item.iconKey || item.key;
        return infoSocialBtn(item.label, iconKey, url);
      });
      row.innerHTML = btns.join('');
      row.classList.remove('hidden');
    }
  }

  function infoMetricVal(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || s === '—' || s === '?') return null;
    return s;
  }

  function fmtCompactCount(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    const x = Number(n);
    if (x >= 100_000) return '>100k';
    if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
    if (x >= 1_000) return `${(x / 1_000).toFixed(2)}K`;
    return x.toLocaleString('tr-TR');
  }

  function fmtCompactAmountClient(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    if (x >= 1_000_000_000) return `${(x / 1_000_000_000).toFixed(2)}B`;
    if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
    if (x >= 1_000) return `${(x / 1_000).toFixed(2)}K`;
    if (x >= 1) return x.toFixed(2);
    return x.toFixed(4);
  }

  function formatPoolCreatedAtClient(ms) {
    if (!ms || !Number.isFinite(ms)) return null;
    try {
      const d = new Date(ms);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
    } catch {
      return null;
    }
  }

  function formatPairAgeClient(createdAtMs) {
    if (!createdAtMs || !Number.isFinite(createdAtMs)) return null;
    const mins = Math.max(0, Math.round((Date.now() - createdAtMs) / 60_000));
    if (mins < 60) return `${mins}dk`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}sa`;
    const days = Math.floor(mins / (60 * 24));
    const hours = Math.floor((mins % (60 * 24)) / 60);
    return hours > 0 ? `${days}g ${hours}sa` : `${days}g`;
  }

  function renderMetricCell(c) {
    if (!c?.val) return '';
    const sub = c.sub
      ? `<span class="info-metric-sub ${c.subCls || ''}">${escHtml(c.sub)}</span>`
      : '';
    const bar =
      c.barPct != null && Number.isFinite(c.barPct)
        ? `<span class="info-metric-bar" aria-hidden="true"><span class="info-metric-bar-fill" style="width:${Math.min(100, Math.max(0, c.barPct))}%"></span></span>`
        : '';
    const hint = c.hint ? `<span class="info-metric-hint">${escHtml(c.hint)}</span>` : '';
    return `<div class="info-metric">
      <span class="info-metric-lbl">${escHtml(c.lbl)}</span>
      <span class="info-metric-val">${escHtml(c.val)}</span>${sub}${bar}${hint}
    </div>`;
  }

  const INFO_COPY_SVG =
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function renderMetricsHead(m, data) {
    const head = $('metricsHead');
    if (!head) return;
    const sym = m.symbol || data?.symbol || '?';
    const mint = data?.address || m.address || '';
    const pool = m.poolAddress || '';
    const chip = (symText, caLbl, addr) => {
      if (!addr) return '';
      return `<div class="info-market-chip">
        <span class="info-market-chip-sym">${escHtml(symText)}</span>
        <div class="info-market-ca">
          <span class="info-market-ca-lbl">${escHtml(caLbl)}</span>
          <code class="info-market-ca-addr" title="${escHtml(addr)}">${escHtml(shortMint(addr))}</code>
          <button type="button" class="info-addr-btn info-copy-addr info-market-copy" data-copy-addr="${escHtml(addr)}" title="Kopyala" aria-label="Kopyala">${INFO_COPY_SVG}</button>
        </div>
      </div>`;
    };
    head.innerHTML = chip(sym, 'C.A.', mint) + chip('PAIR', 'Pool', pool);
  }

  function renderMetrics(m, data) {
    const dash = $('metricsDash');
    if (!dash) return;
    renderMetricsHead(m, data || appData);

    const chg24 = m.priceChange24h;
    const chgText = typeof chg24 === 'number' && !Number.isNaN(chg24) ? formatPct(chg24) : null;
    const totalTxns =
      typeof m.buys24h === 'number' && typeof m.sells24h === 'number' ? m.buys24h + m.sells24h : null;
    const quoteSym = (m.quoteSymbol || 'SOL').toUpperCase();
    const pooledTokenLbl = m.symbol ? `Havuz ${String(m.symbol).toUpperCase()}` : 'Havuz token';
    const pooledQuoteLbl = `Havuz ${quoteSym}`;

    const cells = [
      { lbl: 'Piyasa değeri', val: infoMetricVal(m.marketCapUsdFmt) },
      { lbl: 'Likidite', val: infoMetricVal(m.liquidityUsdFmt) },
      { lbl: 'Toplam değer (FDV)', val: infoMetricVal(m.fdvUsdFmt) },
      { lbl: '24s hacim', val: infoMetricVal(m.volume24hFmt) },
      {
        lbl: 'MCAP / FDV',
        val:
          m.circSupplyPct != null && Number.isFinite(m.circSupplyPct)
            ? `${m.circSupplyPct.toFixed(2)}%`
            : null,
        barPct: m.circSupplyPct,
      },
      { lbl: '6s hacim', val: infoMetricVal(m.volume6hFmt) },
      {
        lbl: 'Fiyat',
        val: infoMetricVal(fmtPriceDisplay(m)),
        sub: chgText,
        subCls: chgClass(chg24),
      },
      { lbl: '1s hacim', val: infoMetricVal(m.volume1hFmt) },
      { lbl: pooledTokenLbl, val: infoMetricVal(m.liquidityBaseFmt) },
      { lbl: pooledQuoteLbl, val: infoMetricVal(m.liquidityQuoteFmt) },
      {
        lbl: 'Toplam işlem (24s)',
        val: totalTxns != null && totalTxns > 0 ? fmtCompactCount(totalTxns) : null,
      },
      { lbl: 'Havuz oluşturma', val: infoMetricVal(m.poolCreatedAtFmt) },
      {
        lbl: 'Fiyat SOL',
        val: infoMetricVal(m.priceNativeFmt ? `${m.priceNativeFmt} SOL` : null),
      },
      { lbl: 'Çift yaşı', val: infoMetricVal(m.pairAge) },
      {
        lbl: 'Holder',
        val: m.holdersCount != null && m.holdersCount > 0 ? fmtCompactCount(m.holdersCount) : null,
      },
    ];

    dash.innerHTML = cells.map((c) => renderMetricCell(c)).filter(Boolean).join('');
  }

  function renderTxnBar(m) {
    const wrap = $('txnSection');
    const rows = $('infoActivityRows');
    const buys = m.buys24h;
    const sells = m.sells24h;
    if (
      !wrap
      || !rows
      || typeof buys !== 'number'
      || typeof sells !== 'number'
      || buys + sells <= 0
    ) {
      wrap?.classList.add('hidden');
      return;
    }
    const total = buys + sells;
    const buyPct = Math.round((buys / total) * 100);
    wrap.classList.remove('hidden');
    rows.innerHTML = `<div class="info-act-block">
      <div class="info-act-labels"><span class="buy-lbl">Alım</span><span class="sell-lbl">Satım</span></div>
      <div class="info-act-bar"><span class="info-act-bar-fill" style="width:${buyPct}%"></span></div>
      <div class="info-act-vals"><span class="buy-val">${buys.toLocaleString('tr-TR')}</span><span class="sell-val">${sells.toLocaleString('tr-TR')}</span></div>
    </div>`;
  }

  function infoAddrRow(label, addr, explorerUrl) {
    const a = String(addr || '').trim();
    if (!a) return '';
    return `<div class="info-addr-row">
      <div class="info-addr-meta">
        <span class="info-addr-lbl">${escHtml(label)}</span>
        <span class="info-addr-val" title="${escHtml(a)}">${escHtml(shortMint(a))}</span>
      </div>
      <div class="info-addr-actions">
        <button type="button" class="info-addr-btn info-copy-addr" data-copy-addr="${a}" title="Kopyala">⧉</button>
        ${explorerUrl ? `<a class="info-addr-btn" href="${escHtml(explorerUrl)}" target="_blank" rel="noopener" title="Explorer">↗</a>` : ''}
      </div>
    </div>`;
  }

  function formatLaunchTime(ms) {
    if (!ms || !Number.isFinite(ms)) return '—';
    try {
      return new Date(ms).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
        + ' UTC';
    } catch {
      return '—';
    }
  }

  function dexDisplayLabel(dexRaw) {
    const dex = String(dexRaw || '').toLowerCase();
    if (/pump/.test(dex)) return pumpDexLabel(dex === 'pumpswap' ? 'pumpswap' : 'pumpfun');
    if (dex.startsWith('raydium')) return 'Raydium';
    if (dex.startsWith('meteora')) return 'Meteora';
    if (dex.startsWith('orca')) return 'Orca';
    return dex ? dex.replace(/_/g, ' ') : '—';
  }

  function dexScreenerTradesUrl(poolOrMint) {
    const ref = String(poolOrMint || '').trim();
    if (!ref) return null;
    const q = new URLSearchParams({
      embed: '1',
      theme: 'dark',
      trades: '1',
      info: '0',
      tabs: '0',
      chartLeftToolbar: '0',
      chartTheme: 'dark',
      interval: '15',
    });
    return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q}`;
  }

  function mountDexTradesEmbed(m) {
    const iframe = $('dexTradesEmbed');
    if (!iframe) return;
    const mint = tokenMintRef(m);
    const pool = chartPoolRef(m) || m?.poolAddress;
    const ref = pool && pool !== mint ? pool : (pool || mint);
    if (!ref) {
      iframe.classList.add('hidden');
      iframe.src = 'about:blank';
      return;
    }
    const url = dexScreenerTradesUrl(ref);
    if (!url) return;
    if (dexTradesEmbedRef !== ref || iframe.src !== url) {
      dexTradesEmbedRef = ref;
      iframe.src = url;
    }
    iframe.classList.remove('hidden');
    const meta = $('tradesMeta');
    if (meta) meta.textContent = 'Canlı işlemler';
    scheduleDexTradesCrop();
  }

  function startDexTradesPanel(m) {
    const tape = $('tradesTape');
    if (tape) tape.classList.add('trades-tape--dex-embed');
    mountDexTradesEmbed(m);
    if (!chartPoolRef(m)) {
      void ensurePoolOnMarket(m).then((pool) => {
        if (pool && reportId) mountDexTradesEmbed(m);
      });
    }
  }

  function stopDexTradesPanel() {
    dexTradesEmbedRef = '';
    const iframe = $('dexTradesEmbed');
    if (iframe) {
      iframe.src = 'about:blank';
      iframe.classList.add('hidden');
    }
  }

  function stopTradesPoll() {
    stopDexTradesPanel();
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
    return pool || '';
  }

  async function ensurePoolOnMarket(m) {
    if (chartPoolRef(m)) return chartPoolRef(m);
    const mint = tokenMintRef(m);
    if (!mint) return '';
    try {
      const res = await fetch(apiPath(`/api/dex/token/${encodeURIComponent(mint)}/pool`), {
        cache: 'no-store',
      });
      if (res.ok) {
        const body = await res.json();
        if (body.poolAddress) {
          m.poolAddress = body.poolAddress;
          if (appData?.market) appData.market.poolAddress = body.poolAddress;
          return body.poolAddress;
        }
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
    const liqUsd = parseFloat(pair.liquidity?.usd);
    if (Number.isFinite(liqUsd)) {
      m.liquidityUsd = liqUsd;
      m.liquidityUsdFmt = fmtUsdShort(liqUsd);
    }
    const vol24 = parseFloat(pair.volume?.h24);
    if (Number.isFinite(vol24)) {
      m.volume24h = vol24;
      m.volume24hFmt = fmtUsdShort(vol24);
    }
    const vol6 = parseFloat(pair.volume?.h6);
    if (Number.isFinite(vol6)) m.volume6hFmt = fmtUsdShort(vol6);
    const vol1 = parseFloat(pair.volume?.h1);
    if (Number.isFinite(vol1)) m.volume1hFmt = fmtUsdShort(vol1);
    const mcap = parseFloat(pair.marketCap);
    if (Number.isFinite(mcap)) {
      m.marketCapUsd = mcap;
      m.marketCapUsdFmt = fmtUsdShort(mcap);
    }
    const fdv = parseFloat(pair.fdv);
    if (Number.isFinite(fdv)) {
      m.fdvUsd = fdv;
      m.fdvUsdFmt = fmtUsdShort(fdv);
      if (Number.isFinite(mcap) && fdv > 0) {
        m.circSupplyPct = Math.min(100, (mcap / fdv) * 100);
      }
    }
    const liqBase = parseFloat(pair.liquidity?.base);
    if (Number.isFinite(liqBase)) m.liquidityBaseFmt = fmtCompactAmountClient(liqBase);
    const liqQuote = parseFloat(pair.liquidity?.quote);
    if (Number.isFinite(liqQuote)) m.liquidityQuoteFmt = fmtCompactAmountClient(liqQuote);
    if (pair.quoteToken?.symbol) m.quoteSymbol = pair.quoteToken.symbol;
    const priceNative = parseFloat(pair.priceNative);
    if (Number.isFinite(priceNative)) {
      m.priceNative = priceNative;
      m.priceNativeFmt = priceNative.toFixed(8).replace(/\.?0+$/, '');
    }
    const createdAtMs = pair.pairCreatedAt || null;
    if (createdAtMs) {
      m.pairCreatedAt = createdAtMs;
      m.pairAge = formatPairAgeClient(createdAtMs);
      m.poolCreatedAtFmt = formatPoolCreatedAtClient(createdAtMs);
    }
    if (pair.pairAddress) m.poolAddress = pair.pairAddress;
    const info = pair.info;
    if (info) {
      if (info.description) m.description = info.description;
      if (Array.isArray(info.websites) && info.websites.length) m.websites = info.websites;
      if (Array.isArray(info.socials) && info.socials.length) m.socials = info.socials;
      if (info.imageUrl) m.imageUrl = info.imageUrl;
    }
    if (appData?.market === m && (info?.socials?.length || info?.websites?.length)) {
      renderInfoHero(appData);
    }
  }

  function renderLivePrice(m) {
    const el = $('priceUsd');
    if (!el) return;
    const prev = el.dataset.lastPx;
    const next = String(m.priceUsd ?? '');
    el.textContent = fmtPriceDisplay({ priceUsd: m.priceUsd, priceUsdFmt: m.priceUsdFmt });
    el.classList.remove('flash-up', 'flash-down');
    if (prev && next && prev !== next && Number.isFinite(Number(prev)) && Number.isFinite(Number(next))) {
      el.classList.add(Number(next) > Number(prev) ? 'flash-up' : 'flash-down');
    }
    el.dataset.lastPx = next;
    if (appData) renderHeroShell(appData);
    renderQuoteChanges(m);
    globalThis.SniperTrade?.tickLive?.(m);
  }

  function initHeroPriceBuy() {
    if (globalThis.__heroPriceBuyBound) return;
    globalThis.__heroPriceBuyBound = true;
    $('priceUsd')?.addEventListener('click', () => {
      const m = appData?.market;
      if (!m || !appData) return;
      globalThis.SniperTrade?.openBuyAtPrice?.({
        priceNative: m.priceNative,
        priceUsd: m.priceUsd,
        data: appData,
      });
    });
  }

  function startTradesPoll(m) {
    stopTradesPoll();
    void startDexTradesPanel(m);
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
    void startDexTradesPanel(m);
    void refreshChartAndPrice(m);
    livePollTimer = setInterval(() => {
      if (reportId && appData?.market) void refreshChartAndPrice(appData.market);
    }, CHART_LIVE_POLL_MS);
  }

  function scheduleDexTradesCrop() {
    if (!globalThis.SniperDexCrop) return;
    if (SniperDexCrop.shouldSkipAutoCrop?.()) return;
    const run = () => {
      if (SniperDexCrop.shouldSkipAutoCrop?.()) return;
      if (SniperCropProfile?.apply) SniperCropProfile.apply();
      if (SniperDexCrop.applyCropNow) SniperDexCrop.applyCropNow();
      else if (SniperDexCrop.apply) SniperDexCrop.apply();
    };
    const burst = () => {
      run();
      [150, 500, 1200, 2500, 4000, 6500].forEach((ms) => setTimeout(run, ms));
    };
    if (SniperDexCrop.ensureProfilesReady) {
      void SniperDexCrop.ensureProfilesReady().then(() => {
        burst();
        if (SniperDexCrop.ensureMotorOnce) SniperDexCrop.ensureMotorOnce();
      });
      return;
    }
    burst();
    if (SniperDexCrop.ensureMotorOnce) SniperDexCrop.ensureMotorOnce();
  }

  function dexEmbedUrlFor(poolOrMint, tf, ctype) {
    const ref = String(poolOrMint || chartPoolRef(appData?.market) || '').trim();
    if (!ref) return null;
    const intervals = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': '1D' };
    const interval = intervals[String(tf || '15m').toLowerCase()] || '15';
    const type = ctype === 'line' ? 'line' : 'candle';
    const q = new URLSearchParams({
      embed: '1',
      theme: 'dark',
      trades: '0',
      info: '0',
      tabs: '0',
      chartLeftToolbar: '1',
      chartTheme: 'dark',
      chartType: type,
      interval,
    });
    return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q}`;
  }

  function setChartEmbedMode(on) {
    document.querySelector('.chart-terminal')?.classList.toggle('chart-terminal--dex-embed', !!on);
  }

  function showDexEmbedChart(container, m, note, tf) {
    const poolRef = chartPoolRef(m) || tokenMintRef(m);
    const embed = m?.chart?.dexScreenerEmbedUrl || dexEmbedUrlFor(poolRef, tf, chartType);
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    if (embed) {
      setChartEmbedMode(true);
      container.innerHTML = `<iframe class="dex-embed-chart" src="${escHtml(embed)}" title="Canlı grafik" loading="eager" allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
      const chartIfr = container.querySelector('iframe.dex-embed-chart');
      if (note) {
        note.textContent = `${(tf || '15m').toUpperCase()} · canlı`;
        note.classList.remove('hidden');
      }
      if (chartIfr) {
        chartIfr.addEventListener('load', scheduleDexTradesCrop);
        scheduleDexTradesCrop();
      }
      return true;
    }
    setChartEmbedMode(false);
    const link = page
      ? `<a class="dex-chart-link" href="${escHtml(page)}" target="_blank" rel="noopener">Harici grafikte aç</a>`
      : '';
    container.innerHTML = `<div class="empty-chart">Grafik yüklenemedi. ${link}</div>`;
    return false;
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
      poolAddress: body.poolAddress || null,
      priceUsd: body.priceUsd ?? null,
      pair: body.pair || null,
    };
  }

  function destroyChart() {
    const container = $('priceChart');
    if (container) container.innerHTML = '';
    document.querySelector('.chart-terminal')?.classList.remove('chart-terminal--dex-embed');
  }

  async function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    const tf = m?.chart?.timeframe || currentTf;
    const stats = m?.chart?.stats;
    renderChartPeriodChg(stats, tf);

    destroyChart();
    setChartEmbedMode(false);
    container.innerHTML = '';
    if (note) note.classList.remove('hidden');

    if (showDexEmbedChart(container, m, note, tf)) {
      const candles = m?.chart?.candles || [];
      const last = candles[candles.length - 1];
      if (last) updateOhlc(last);
      return;
    }

    if (note) {
      note.textContent = 'Canlı grafik — pool/mint bekleniyor';
      note.classList.remove('hidden');
    }
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    const link = page
      ? `<a class="dex-chart-link" href="${escHtml(page)}" target="_blank" rel="noopener">Harici grafikte aç</a>`
      : '';
    container.innerHTML = `<div class="empty-chart">Grafik için havuz veya mint gerekli. ${link}</div>`;
  }

  async function refreshChartAndPrice(m) {
    if (!m) return;
    try {
      const live = await fetchChartCandles(m, currentTf, { live: true });
      applyLivePairToMarket(m, live.pair, live.priceUsd);
      renderLivePrice(m);
      if (activeDetailTab === 'info' && appData) {
        renderMetrics(m, appData);
        renderTxnBar(m);
      }
      if (activeDetailTab === 'txns' && appData) {
        globalThis.SniperTrade?.tickLive?.(m);
      }
      if (live.poolAddress) {
        m.poolAddress = live.poolAddress;
        if (appData?.market) appData.market.poolAddress = live.poolAddress;
        mountDexTradesEmbed(m);
      }
    } catch (e) {
      console.warn('live refresh', e);
    }
  }

  function setChartType(type) {
    chartType = type;
    document.querySelectorAll('.ctype').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === type);
    });
    if (appData?.market) void renderChart(appData.market);
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
        return `<div class="check-row"><span class="check-icon ${ic.cls}">${ic.ch}</span><span>${escHtml(stripExternalBrands(item.text))}</span></div>`;
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

  let infoAuditUiBound = false;

  function bindInfoAuditUi() {
    if (infoAuditUiBound) return;
    infoAuditUiBound = true;
    const toggle = $('infoAuditToggle');
    const section = $('infoAuditSection');
    toggle?.addEventListener('click', () => {
      const collapsed = section?.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    $('infoAuditCta')?.addEventListener('click', () => switchDetailTab('security'));
  }

  const LEGACY_AUDIT_IDS = new Set(['mint', 'trusted', 'freeze', 'meta']);

  function auditCardNeedsRebuild(card) {
    if (!card?.rows?.length) return true;
    if (card.rows.some((r) => LEGACY_AUDIT_IDS.has(r.id))) return true;
    const ids = new Set(card.rows.map((r) => r.id));
    if (ids.has('verified') && ids.has('proxy') && !ids.has('buyTax')) return true;
    return false;
  }

  function enrichAuditCardTax(card, data) {
    if (!card?.rows?.length) return card;
    const onchain = [...(data?.onchain || []), ...(data?.contract || [])].join(' ').toLowerCase();
    if (!/goplus/.test(onchain)) return card;
    if (card.rows.some((r) => r.id === 'buyTax')) return card;
    const rows = [
      ...card.rows,
      { id: 'buyTax', label: 'Buy tax', value: '0%', status: 'good' },
      { id: 'sellTax', label: 'Sell tax', value: '0%', status: 'good' },
    ];
    return { ...card, rows: sortAuditRows(rows) };
  }

  function resolveAuditCard(data) {
    let card = data?.auditCard;
    if (auditCardNeedsRebuild(card)) {
      card = buildAuditCardFromReport(data);
    }
    card = enrichAuditCardTax(card, data);
    if (card?.rows?.length) return card;
    return buildAuditCardFromReport(data);
  }

  function normAuditLine(s) {
    return String(s || '')
      .replace(/<[^>]+>/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** Sunucu auditCard yoksa (eski API) — kontrat satırlarından kart. */
  function buildAuditCardFromReport(data) {
    const labels = {
      verified: 'Kontrat doğrulandı',
      buyTax: 'Alım vergisi',
      sellTax: 'Satım vergisi',
      proxy: 'Proxy kontrat',
      yes: 'Evet',
      no: 'Hayır',
    };
    const counts = data?.counts || {};
    const rows = [];
    const seen = new Set();
    const push = (id, label, value, status) => {
      if (seen.has(id) || value == null || value === '') return;
      seen.add(id);
      rows.push({ id, label, value, status: status || 'neutral' });
    };

    const lines = [];
    for (const line of data?.contract || []) lines.push(String(line));
    for (const c of data?.checks?.all || []) {
      if (c?.text) lines.push(String(c.text));
    }
    for (const line of data?.onchain || []) lines.push(String(line));
    for (const s of data?.signals || []) {
      if (s?.text) lines.push(String(s.text));
    }

    for (const raw of lines) {
      const t = normAuditLine(raw);
      if (!t || t.includes('kontrat güvenliği')) continue;

      if (
        (/mint.*(kilitli|kapalı|locked|revoked|sabit arz)/.test(t) || /mint kapalı/.test(t))
        && !/mint.*(açık|open)/.test(t)
      ) {
        push('proxy', labels.proxy, labels.no, 'good');
      } else if (/mint.*(açık|open)|sahibi basabilir/.test(t)) {
        push('proxy', labels.proxy, labels.yes, 'bad');
      }

      if (/doğrulanmış token|verified token|contract.*verified/.test(t)) {
        push('verified', labels.verified, labels.yes, 'good');
      }

      const buyM = t.match(/(?:alım|buy)[\s-]*(?:vergisi|tax)?[^%]{0,24}?(\d+(?:[.,]\d+)?)\s*%/);
      if (buyM) {
        const v = buyM[1].replace(',', '.');
        push('buyTax', labels.buyTax, `${v}%`, Number(v) > 10 ? 'bad' : 'good');
      }
      const sellM = t.match(/(?:satım|sell)[\s-]*(?:vergisi|tax)?[^%]{0,24}?(\d+(?:[.,]\d+)?)\s*%/);
      if (sellM) {
        const v = sellM[1].replace(',', '.');
        push('sellTax', labels.sellTax, `${v}%`, Number(v) > 10 ? 'bad' : 'good');
      }

      if (/proxy\s*(kontrat|contract)/.test(t)) {
        const no = /(hayır|no\b|değil)/.test(t);
        push('proxy', labels.proxy, no ? labels.no : labels.yes, no ? 'good' : 'bad');
      }

      if (/güvenilir.*(değil|hayır|not)|not trusted|güvenilir token listesinde değil/.test(t)) {
        push('verified', labels.verified, labels.no, 'warn');
      } else if (/güvenilir liste|trusted token|güvenilir token/.test(t) && !/değil|hayır|not/.test(t)) {
        push('verified', labels.verified, labels.yes, 'good');
      }
    }

    const blob = lines.join(' ');
    if (/goplus/.test(blob) && !seen.has('buyTax')) {
      push('buyTax', labels.buyTax, '0%', 'good');
      push('sellTax', labels.sellTax, '0%', 'good');
    }

    if (!rows.length) return null;
    const issueCount = rows.filter((r) => r.status === 'warn' || r.status === 'bad').length;
    const reviewCount = (counts.warn || 0) + (counts.bad || 0);
    return {
      rows,
      issueCount,
      badgeCount: issueCount > 0 ? issueCount : reviewCount > 0 ? reviewCount : 1,
      totalChecks: counts.total || rows.length,
    };
  }

  const AUDIT_MOCKUP_LABELS = {
    verified: 'CONTRACT VERIFIED',
    buyTax: 'BUY TAX',
    sellTax: 'SELL TAX',
    proxy: 'PROXY CONTRACT',
    mint: 'MINT AUTHORITY',
    freeze: 'FREEZE AUTHORITY',
    meta: 'METADATA MUTABLE',
    trusted: 'TRUSTED TOKEN',
  };

  const AUDIT_ROW_ORDER = ['verified', 'buyTax', 'sellTax', 'proxy', 'mint', 'freeze', 'meta', 'trusted'];

  function auditMockupLabel(row) {
    if (row?.id && AUDIT_MOCKUP_LABELS[row.id]) return AUDIT_MOCKUP_LABELS[row.id];
    return String(row?.label || '')
      .toUpperCase()
      .replace(/İ/g, 'I')
      .replace(/ı/g, 'I');
  }

  function formatAuditValue(value) {
    const v = String(value || '').trim();
    const map = {
      Evet: 'YES',
      Hayır: 'NO',
      Yes: 'YES',
      No: 'NO',
      Kapalı: 'NO',
      Açık: 'YES',
      Revoked: 'NO',
      Active: 'YES',
      Var: 'YES',
      Yok: 'NO',
    };
    if (map[v]) return map[v];
    if (/%/.test(v)) return v;
    return v.toUpperCase().replace(/İ/g, 'I').replace(/ı/g, 'I');
  }

  function formatAuditValueHtml(value) {
    const raw = formatAuditValue(value);
    if (raw.includes(' - ')) {
      const parts = raw.split(' - ').map((p) => escHtml(p.trim()));
      return `<span class="info-audit-row-val is-range">${parts.join('<br>')}</span>`;
    }
    return `<span class="info-audit-row-val">${escHtml(raw)}</span>`;
  }

  function sortAuditRows(rows) {
    return [...rows].sort((a, b) => {
      const ia = AUDIT_ROW_ORDER.indexOf(a.id);
      const ib = AUDIT_ROW_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }

  function renderInfoAuditCard(data) {
    const section = $('infoAuditSection');
    const body = $('infoAuditBody');
    if (!section || !body) return;

    const card = resolveAuditCard(data);
    const rows = sortAuditRows(card?.rows || []);
    if (!rows.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    bindInfoAuditUi();

    const n = card.badgeCount || card.issueCount || 0;
    const badgeN = $('infoAuditBadgeN');
    if (badgeN) badgeN.textContent = String(n > 0 ? n : 1);

    const ctaLbl = $('infoAuditCtaLbl');
    if (ctaLbl) {
      const count = n > 0 ? n : 1;
      ctaLbl.textContent = count > 1 ? `${count} denetimi incele` : 'Denetimleri gör';
    }

    body.innerHTML = rows
      .map(
        (row) => `<div class="info-audit-row">
          <span class="info-audit-row-ico" aria-hidden="true">i</span>
          <div class="info-audit-row-content">
            <span class="info-audit-row-lbl">${escHtml(auditMockupLabel(row))}</span>
            <span class="info-audit-row-end">
              ${formatAuditValueHtml(row.value)}
              <span class="info-audit-dot ${escHtml(row.status || 'neutral')}" aria-hidden="true"></span>
            </span>
          </div>
        </div>`,
      )
      .join('');
  }

  function renderInfoPanel(data) {
    const m = data.market || {};
    const mint = data.address || m.address || '';
    const pool = m.poolAddress || '';
    renderInfoHero(data);

    const list = $('infoAddrList');
    if (list) {
      list.innerHTML = [
        infoAddrRow('Çift adresi', pool, pool ? `https://solscan.io/account/${pool}` : null),
        infoAddrRow('Token kontratı', mint, mint ? `https://solscan.io/token/${mint}` : null),
        infoAddrRow('Likidite havuzu', pool, pool ? `https://solscan.io/account/${pool}` : null),
      ].join('');
    }

    const foot = $('infoChainFoot');
    if (foot) {
      const launch = m.pairCreatedAt ? formatLaunchTime(m.pairCreatedAt) : null;
      foot.innerHTML = [
        '<div class="info-chain-cell"><span class="info-chain-lbl">Ağ</span><span class="info-chain-val">Solana</span></div>',
        infoDexPlatform(m.dex || data.dex)
          ? `<div class="info-chain-cell"><span class="info-chain-lbl">DEX</span><span class="info-chain-val">${escHtml(dexDisplayLabel(m.dex || data.dex))}</span></div>`
          : '',
        launch
          ? `<div class="info-chain-cell"><span class="info-chain-lbl">Lansman</span><span class="info-chain-val">${escHtml(launch)}</span></div>`
          : '',
      ].join('');
    }
  }

  function secCheckRow(item) {
    const ic = checkIcon(item.level);
    return `<div class="sec-check-row">
      <span class="check-icon ${ic.cls}">${ic.ch}</span>
      <span class="sec-check-txt">${escHtml(stripExternalBrands(item.text))}</span>
    </div>`;
  }

  function secFoldHtml(title, items, opts = {}) {
    if (!items?.length) return '';
    const open = opts.open ? ' open' : '';
    const tone = opts.tone || 'neutral';
    const body = items.map((item) => secCheckRow(item)).join('');
    return `<details class="sec-fold sec-fold--${tone}"${open}>
      <summary class="sec-fold-sum">
        <span class="sec-fold-title">${escHtml(title)}</span>
        <span class="sec-fold-badge">${items.length}</span>
      </summary>
      <div class="sec-fold-body">${body}</div>
    </details>`;
  }

  function secScoreHeroHtml(data, counts) {
    const score = data.trust?.score ?? 0;
    const c = counts || {};
    return `<section class="sec-hero glass">
      <div class="sec-hero-main">
        <div class="trust-score-big sec-score-ring" style="--pct:${score};--ring-color:${scoreColor(score)}"><span>${score}</span></div>
        <div class="sec-hero-text">
          <div class="sec-hero-badges">
            <span class="pill ${levelRiskClass(data.level)}">${escHtml(data.levelLabel || '—')}</span>
            <span class="pill trust">${score}/100</span>
          </div>
          <h3 class="sec-hero-title">${escHtml(data.trust?.tier || '—')}</h3>
          <p class="sec-hero-verdict">${escHtml(stripExternalBrands(data.trust?.verdict || ''))}</p>
          ${data.trust?.scoreLabel ? `<p class="sec-hero-sub">${escHtml(stripExternalBrands(data.trust.scoreLabel))}</p>` : ''}
        </div>
      </div>
      <div class="sec-stat-row">
        <div class="sec-stat sec-stat--good"><span class="n">${c.good || 0}</span><span class="l">Geçti</span></div>
        <div class="sec-stat sec-stat--warn"><span class="n">${c.warn || 0}</span><span class="l">Uyarı</span></div>
        <div class="sec-stat sec-stat--bad"><span class="n">${c.bad || 0}</span><span class="l">Kritik</span></div>
      </div>
    </section>`;
  }

  function secMetricsHtml(data, counts, bd) {
    const c = counts || {};
    const auditSub = c.bad > 0 ? `${c.bad} kritik` : c.warn > 0 ? `${c.warn} uyarı` : 'Temiz';
    const items = [
      { k: 'Likidite', v: data.summary?.liquidityWord || '—', s: bd.liquidity || '—' },
      { k: 'Çift yaşı', v: data.summary?.age || '—', s: bd.age || '—' },
      { k: 'Kontroller', v: `${c.total || 0}`, s: auditSub },
      { k: 'Kontrat', v: bd.contract || '—', s: data.levelLabel || '—' },
    ];
    return `<section class="sec-metrics glass">${items
      .map(
        (i) => `<div class="sec-metric">
          <span class="sec-metric-k">${escHtml(i.k)}</span>
          <strong class="sec-metric-v">${escHtml(String(i.v))}</strong>
          <span class="sec-metric-s">${escHtml(String(i.s))}</span>
        </div>`,
      )
      .join('')}</section>`;
  }

  function secAlertsHtml(highlights) {
    if (!highlights?.length) return '';
    const rows = highlights
      .slice(0, 4)
      .map(
        (h) => `<div class="sec-alert sec-alert--${h.level || 'info'}">${escHtml(stripExternalBrands(h.text))}</div>`,
      )
      .join('');
    return `<section class="sec-block glass">
      <h3 class="sec-block-title">Öne çıkan bulgular</h3>
      <div class="sec-alerts">${rows}</div>
    </section>`;
  }

  function secAuditGridHtml(card) {
    const rows = sortAuditRows(card?.rows || []);
    if (!rows.length) return '';
    return `<section class="sec-block glass">
      <h3 class="sec-block-title">Hızlı denetim</h3>
      <div class="sec-audit-grid">${rows
        .map(
          (row) => `<div class="sec-audit-item sec-audit-item--${escHtml(row.status || 'neutral')}">
            <span class="sec-audit-lbl">${escHtml(auditMockupLabel(row))}</span>
            <span class="sec-audit-val">${escHtml(formatAuditValue(row.value))}</span>
          </div>`,
        )
        .join('')}</div>
    </section>`;
  }

  function secTechListHtml(lines) {
    if (!lines?.length) return '';
    return lines
      .map((line) => {
        const text = typeof line === 'object' ? line.text : line;
        const level = typeof line === 'object' ? line.level : '';
        return `<li class="sec-tech-li ${level || ''}">${escHtml(stripExternalBrands(text))}</li>`;
      })
      .join('');
  }

  function secTechnicalHtml(data) {
    const onchain = data.onchain || [];
    const contract = data.contract || [];
    const n = onchain.length + contract.length;
    if (!n) return '';
    return `<details class="sec-fold sec-fold--tech">
      <summary class="sec-fold-sum">
        <span class="sec-fold-title">Teknik detaylar</span>
        <span class="sec-fold-badge">${n}</span>
      </summary>
      <div class="sec-fold-body sec-tech-body">
        ${onchain.length ? `<div class="sec-tech-group"><h4 class="sec-tech-head">Zincir üstü</h4><ul class="sec-tech-list">${secTechListHtml(onchain)}</ul></div>` : ''}
        ${contract.length ? `<div class="sec-tech-group"><h4 class="sec-tech-head">Kontrat</h4><ul class="sec-tech-list">${secTechListHtml(contract)}</ul></div>` : ''}
      </div>
    </details>`;
  }

  function renderSecurityPanel(data) {
    const panel = $('panel-security');
    if (!panel) return;

    const checks = data.checks || {};
    const counts = data.counts || {};
    const bd = data.audit?.breakdown || {};
    const generated = data.generatedAt
      ? new Date(data.generatedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const auditCard = resolveAuditCard(data);

    const checklistFolds = [
      secFoldHtml('Kritik riskler', checks.critical, { open: (counts.bad || 0) > 0, tone: 'bad' }),
      secFoldHtml('Uyarılar', checks.warnings, {
        open: (counts.bad || 0) === 0 && (counts.warn || 0) > 0,
        tone: 'warn',
      }),
      secFoldHtml('Geçen kontroller', checks.passed, { open: false, tone: 'good' }),
    ].join('');
    const checklist = `<section class="sec-block glass sec-checklist">
      <h3 class="sec-block-title">Kontrol listesi</h3>
      ${checklistFolds || '<p class="sec-empty">Bu rapor için kontrol listesi yok.</p>'}
    </section>`;

    const rugNote = data.rugcheck
      ? `<div class="sec-rug glass">${escHtml(stripExternalBrands(data.rugcheck))}</div>`
      : '';

    panel.innerHTML = [
      secScoreHeroHtml(data, counts),
      secMetricsHtml(data, counts, bd),
      secAlertsHtml(data.highlights),
      secAuditGridHtml(auditCard),
      rugNote,
      checklist,
      secTechnicalHtml(data),
      `<footer class="sec-foot"><span>Rapor · ${escHtml(generated)}</span><span>${counts.total || 0} kontrol</span></footer>`,
    ].join('');
  }

  function listHtml(lines) {
    if (!lines?.length) return '<p style="color:var(--text-tertiary);margin:0">Kayıt yok</p>';
    const lis = lines
      .map((line) => {
        const text = typeof line === 'object' ? line.text : line;
        const level = typeof line === 'object' ? line.level : '';
        return `<li class="${level || ''}">${escHtml(stripExternalBrands(text))}</li>`;
      })
      .join('');
    return `<ul>${lis}</ul>`;
  }

  function paintTradeBar() {
    const bar = $('tradeBar');
    if (!bar) return;
    bar.innerHTML = `<button type="button" class="trade-bar-btn trade-bar-btn--buy" data-trade-quick="buy"><span class="tbb-ico">↑</span><span class="tbb-lbl">Al</span></button>
      <button type="button" class="trade-bar-btn trade-bar-btn--sell" data-trade-quick="sell"><span class="tbb-ico">↓</span><span class="tbb-lbl">Sat</span></button>
      <button type="button" class="trade-bar-btn trade-bar-btn--chart" data-trade-tab="txns"><span class="tbb-ico">⚡</span><span class="tbb-lbl">Trade</span></button>`;
    bar.dataset.tradeBound = '';
    bindTradeBar();
  }

  function renderTradePanel(data) {
    paintTradeBar();
    if (globalThis.SniperTrade?.render) {
      globalThis.SniperTrade.render(data);
    }
  }

  function setupNav() {
    document.querySelectorAll('.dbn-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.dtab;
        if (tab) switchDetailTab(tab);
      });
    });
  }

  async function applyChartTimeframe(m, tf) {
    setChartLoading(true);
    try {
      currentTf = tf;
      if (appData?.market?.chart) appData.market.chart.timeframe = tf;
      await renderChart(m);
      scheduleDexTradesCrop();
      return true;
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
      await applyChartTimeframe(appData.market, tf);
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
      if (/pump/.test(dexRaw)) {
        plat = 'pumpfun';
        label = pumpDexLabel(dexRaw === 'pumpswap' ? 'pumpswap' : 'pumpfun');
      }
      else if (dexRaw.startsWith('raydium')) { plat = 'raydium'; label = 'Raydium'; }
      else if (dexRaw.startsWith('meteora')) { plat = 'meteora'; label = 'Meteora'; }
      else if (dexRaw.startsWith('orca')) { plat = 'orca'; label = 'Orca'; }
      else if (dexRaw) label = dexRaw.replace(/_/g, ' ');
      dexBadge.textContent = label;
      dexBadge.className = `pill dex-pill dex-${plat}`;
    }

    loadLogo(m.imageUrl, m.imageFallbacks, sym);
    $('priceUsd').textContent = fmtPriceDisplay({ priceUsd: m.priceUsd, priceUsdFmt: m.priceUsdFmt })
      || data.summary?.price || '—';

    renderHeroShell(data);
    renderQuoteChanges(m);
    renderMetrics(m, data);
    renderInfoAuditCard(data);
    renderTxnBar(m);
    startDexTradesPanel(m);
    const chartSection = document.querySelector('.chart-terminal');
    if (detailHideChart) {
      chartSection?.classList.add('hidden');
      destroyChart();
    } else {
      chartSection?.classList.remove('hidden');
      renderChart(m)
        .then(() => scheduleDexTradesCrop())
        .catch((e) => console.warn('renderChart', e));
    }
    startLivePoll(m);
    renderInfoPanel(data);
    renderSecurityPanel(data);
    renderTradePanel(data);
    void startDexTradesPanel(m);

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
    $('appBrandHome')?.addEventListener('click', () => {
      if (document.documentElement.classList.contains('detail-mode')) {
        location.hash = '';
        reportId = null;
        destroyChart();
        showScannerHome();
      }
    });
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
    syncAppChrome();
    initWallet();
    initHeroPriceBuy();
    void loadPromoBanner();
    reportId = reportIdFromUrl();

    if (!reportId) {
      showScannerHome();
      return;
    }

    $('loading')?.classList.remove('hidden');

    markReportOpen(false);
    await loadReportFlow();
  }

  globalThis.apiPath = apiPath;
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
  globalThis.switchDetailTab = switchDetailTab;
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
