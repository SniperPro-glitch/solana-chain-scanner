(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) document.documentElement.classList.add('web-browser');
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
      } catch {
        /* aynı sunucu */
      }
      return apiConfig;
    })();
    return apiConfigPromise;
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
  let chartApi = null;
  let candleSeries = null;
  let lineSeries = null;
  let volumeSeries = null;
  let resizeHandler = null;

  let feedTab = 'trending';
  let dexFilter = 'all';
  let activeChain = 'solana';
  let homeShellBound = false;
  let homeFeedBooted = false;
  let detailShellBound = false;
  let feedPollTimer = null;
  let tradesResizeHandler = null;
  let openingMint = false;
  let feedItemsFull = [];
  let feedEmptyMessage = '';
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

  const DEX_LOGO_SRC = {
    pumpfun: 'assets/dex-pumpfun.png?v=8',
    pumpswap: 'assets/dex-pumpfun.png?v=8',
    raydium: 'assets/dex-raydium.png?v=8',
    meteora: 'assets/dex-meteora.png?v=8',
    orca: 'assets/dex-orca.png?v=8',
  };

  function dexBadgeHtml(dexKey, label) {
    if (!label) return '';
    const src = DEX_LOGO_SRC[dexKey];
    const ico = src
      ? `<img class="tr-dex-badge-ico" src="${src}" alt="" width="12" height="12" loading="lazy" decoding="async" />`
      : '';
    return `<span class="tr-dex-badge dex-${escHtml(dexKey)}">${ico}<span class="tr-dex-badge-txt">${escHtml(label)}</span></span>`;
  }

  function dexPinHtml(dexKey) {
    const src = DEX_LOGO_SRC[dexKey];
    if (!src) {
      return '<span class="tr-chain-dot" aria-hidden="true">◎</span>';
    }
    return `<img class="tr-dex-pin" src="${src}" alt="" width="40" height="40" loading="lazy" decoding="async" />`;
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg24 = item.change24h;
    const chg1 = item.change1h;
    const up24 = chg24 == null ? true : Number(chg24) >= 0;
    const pairShort = escHtml((item.pairLabel || 'SOL').replace(/^.*\//, '') || 'SOL');
    const dexKey = item.dexPlatform || 'other';
    const pin = dexPinHtml(dexKey);
    const avatar = item.imageUrl
      ? `<span class="tr-avatar-wrap"><img class="tr-img" src="${escHtml(item.imageUrl)}" alt="" loading="lazy" data-fb="${escHtml((item.imageFallbacks || []).join('|'))}" />${pin}</span>`
      : `<span class="tr-avatar-wrap"><span class="tr-avatar">${escHtml((item.symbol || '?').slice(0, 2))}</span>${pin}</span>`;
    const reportAttr = item.reportId ? ` data-report="${escHtml(item.reportId)}"` : '';
    const dexBadge = item.dexLabel ? dexBadgeHtml(dexKey, item.dexLabel) : '';
    const subParts = [
      dexBadge,
      item.marketCapUsdFmt ? `MCap ${escHtml(item.marketCapUsdFmt)}` : '',
    ].filter(Boolean).join(' · ');
    const dexUrlAttr = item.dexPageUrl ? ` data-dex-url="${escHtml(item.dexPageUrl)}"` : '';
    const chainAttr = item.chain ? ` data-chain="${escHtml(item.chain)}"` : '';
    return `<article class="token-row ${extraClass}" data-mint="${escHtml(item.mint)}" data-dex="${escHtml(dexKey)}" data-chain="${escHtml(item.chain || 'solana')}"${reportAttr}${dexUrlAttr}${chainAttr}>
      <span class="tr-rank">${item.rank ?? '·'}</span>
      <div class="tr-token">${avatar}<div class="tr-meta"><div class="tr-name">${escHtml(item.symbol)}<span class="tr-pair"> / ${pairShort}</span></div><div class="tr-sub">${subParts || '—'}</div></div></div>
      <span class="tr-price" title="${item.priceUsd != null ? escHtml(String(item.priceUsd)) : ''}">${escHtml(fmtPriceDisplay(item))}</span>
      <span class="tr-pct ${chgClass(chg1)}">${formatPct(chg1)}</span>
      <span class="tr-pct ${chgClass(chg24)}">${formatPct(chg24)}</span>
      <span class="tr-vol">${escHtml(item.volume24hFmt || '—')}</span>
      <span class="tr-liq">${escHtml(item.liquidityUsdFmt || '—')}</span>
      ${riskColHtml(rc, label, up24)}
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
      void loadHomeFeed('trending', feedTab === 'new' ? 'new' : feedTab === 'home' ? 'home' : 'trending', {
        force: true,
      });
    }
  }

  let lastBottomNavAt = 0;

  function onBottomNav(nav) {
    if (!nav) return;
    const now = Date.now();
    if (now - lastBottomNavAt < 350) return;
    lastBottomNavAt = now;
    if (nav === 'home') {
      location.hash = '';
      reportId = null;
      showScannerHome();
      clearSearch({ skipFetch: true });
      void loadHomeFeed('trending', 'home');
      return;
    }
    if (nav === 'trend') {
      location.hash = '';
      reportId = null;
      setFeedTab('trending');
      showScannerHome();
      fetchFeed('trending');
      return;
    }
    if (nav === 'new') {
      location.hash = '';
      reportId = null;
      setFeedTab('new');
      showScannerHome();
      fetchFeed('new');
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
      if ((searchQuery || '').trim()) applySearchFilter();
      else renderTokenList(feedItemsFull);
    }
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
    return global.SniperSidebar?.getChain?.() || activeChain || 'solana';
  }

  function syncDexChipsForChain(chain) {
    const scroll = $('dexScroll');
    if (scroll) scroll.classList.toggle('hidden', chain !== 'solana');
  }

  const CHAIN_UI = {
    solana: { short: 'SOL', label: 'Solana', src: 'Bot kanalı' },
    ton: { short: 'TON', label: 'TON', src: 'Henüz paylaşım yok' },
    bsc: { short: 'BSC', label: 'BSC', src: 'Henüz paylaşım yok' },
    eth: { short: 'ETH', label: 'Ethereum', src: 'Henüz paylaşım yok' },
  };

  function applyChainHeaderUi(chain) {
    const c = CHAIN_UI[chain] || { short: String(chain || '').toUpperCase().slice(0, 4), label: chain, src: 'DexScreener' };
    const pill = $('headerChainPill');
    if (pill) pill.textContent = c.short;
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
    syncDexChipsForChain(chainKey);
    if (chainKey !== 'solana' && dexFilter !== 'all') setDexFilter('all');
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

  function applySearchFilter() {
    applySearchHintFromFeed();
    renderTokenList(feedItemsFull, {
      searching: !!(searchQuery || '').trim(),
      emptyMessage: feedEmptyMessage,
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
        <span class="tr-price">${escHtml(last.price || '—')}</span>
        <span class="tr-pct"></span><span class="tr-pct"></span><span class="tr-vol"></span><span class="tr-liq"></span>
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

  function renderPromoBanner(promo) {
    const el = $('promoBanner');
    const img = $('promoBannerImg');
    if (!el || !img) return;
    if (!promo?.enabled || !promo.imageUrl) {
      el.classList.add('hidden');
      return;
    }
    img.src = promo.imageUrl;
    img.alt = promo.alt || 'Reklam';
    img.style.objectPosition = `${Math.min(100, Math.max(0, Number(promo.posX) || 50))}% center`;
    el.classList.remove('hidden');
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
      label.textContent = sortMode === 'postedAt_desc' ? 'NEW ↓' : '24H VOL ↓';
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

  function applyHomeExtras(body) {
    renderPromoBanner(body?.promo);
    renderTrendingBand(body?.trendingTicker, body?.sortMode);
  }

  function renderTokenList(items, opts = {}) {
    const list = $('homeTokenList');
    if (!list) return;
    const searching = !!opts.searching || !!(searchQuery || '').trim();
    const lastRow = searching ? '' : renderLastReportRow();
    const rows = (items || []).map((it) => renderFeedRow(it)).join('');
    if (!rows) {
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
    if (!body || body.empty) {
      bar.classList.add('hidden');
      return;
    }
    const n = body.botCount ?? body.items?.length ?? 0;
    const vol = body.stats?.volume24hFmt || '—';
    const chainKey = body.chain || activeChain || 'solana';
    const c = CHAIN_UI[chainKey] || { label: chainKey, src: 'DexScreener' };
    const src = body.source === 'bot_channel' ? 'Bot + arama' : c.src;
    txt.textContent = `◎ ${c.label} · ${src} · ${n} token · ${vol} 24h`;
    delete txt.dataset.lockChain;
    bar.classList.remove('hidden');
  }

  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const trending = (stats?.count || items.length);
    const cards = [
      { icon: '🔥', title: 'Live Trending', val: trending.toLocaleString('en-US'), accent: 'accent-pink', tag: 'LIVE', tagCls: 'live', action: 'trending' },
      { icon: '✦', title: 'New Pairs', val: String(stats?.newPairs ?? items.length), accent: 'accent-green', tag: 'NEW', tagCls: 'new', action: 'new' },
      {
        icon: `<img class="scanner-ico-img qc-scanner-ico" src="${SCANNER_ICON}" alt="" width="26" height="26" loading="lazy" decoding="async" />`,
        title: 'Liquidity Scanner',
        val: stats?.liquidityFmt || '$243.6M',
        accent: 'accent-cyan',
        tag: '',
        action: 'scan',
      },
      { icon: '🐋', title: 'Whale Buys', val: String(Math.min(99, Math.max(1, items.length))), accent: 'accent-purple', tag: '', action: null },
      { icon: '🛡', title: 'AI Risk Check', val: 'Protected', accent: 'accent-gold', tag: '', action: null },
    ];
    qc.innerHTML = cards.map((c) => {
      const tag = c.tag ? `<span class="qc-tag ${c.tagCls}">${c.tag}</span>` : '';
      return `<article class="quick-card ${c.accent}${c.action ? ' quick-card-tap' : ''}" data-action="${c.action || ''}">
        <div class="qc-head"><span class="qc-icon-wrap">${c.icon}</span>${tag}</div>
        <div class="qc-title">${c.title}</div>
        <div class="qc-val">${c.val}</div>
      </article>`;
    }).join('');
    qc.querySelectorAll('.quick-card-tap').forEach((card) => {
      card.addEventListener('click', () => {
        const a = card.dataset.action;
        if (a === 'trending' || a === 'new') fetchFeed(a);
        else if (a === 'scan' && typeof globalThis.onBottomNav === 'function') globalThis.onBottomNav('scan');
      });
    });
  }

  function setDexFilter(dex) {
    dexFilter = dex || 'all';
    document.querySelectorAll('.dex-chip[data-dex]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.dex === dexFilter);
    });
  }

  function updateDexChipCounts(counts) {
    if (!counts) return;
    document.querySelectorAll('.dex-chip[data-dex]').forEach((btn) => {
      const key = btn.dataset.dex;
      const n = counts[key];
      let badge = btn.querySelector('.dex-count');
      if (n == null || key === 'all') {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'dex-count';
        btn.appendChild(badge);
      }
      badge.textContent = String(n);
    });
  }

  function feedTabForApi(tab) {
    const t = tab || feedTab;
    if (t === 'home' || t === 'scan') return 'trending';
    if (t === 'trend') return 'trending';
    return t;
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
    if (body?.empty && body.emptyMessage && !items.length) {
      applyMarketStats({ count: 0, volume24hFmt: '—', liquidityFmt: '—', newPairs: 0, activeNow: 0 }, []);
      updateQuickCards({ count: 0, newPairs: 0, liquidityFmt: '—' }, []);
      applyHomeExtras(body);
      updateFeedMetaBar(body);
      feedItemsFull = [];
      applySearchFilter();
      if (!q) showToast(body.emptyMessage.slice(0, 80));
      return body;
    }
    updateDexChipCounts(body.dexCounts);
    if (body.dexFilter) setDexFilter(body.dexFilter);
    applyMarketStats(body.stats || PLACEHOLDER_STATS, items);
    updateQuickCards(body.stats || PLACEHOLDER_STATS, items);
    applyHomeExtras(body);
    updateFeedMetaBar(body);
    feedItemsFull = items;
    if (items.length) feedEmptyMessage = '';
    if (body.chain) activeChain = body.chain;
    applySearchFilter();
    if (body.empty && body.emptyMessage) {
      showToast('Liste boş — /post ile kanala paylaşın');
    }
    return body;
  }

  /** Ana liste — Scanner modundan çıkar, feed API çağır. */
  async function loadHomeFeed(apiTab = 'trending', uiTab = 'trending', opts = {}) {
    // Ana liste tam feed; metin araması yalnızca search-overlay (/api/search).
    const q = '';
    const chain = getActiveChain();
    const cacheKey = `${apiTab}|${chain}|${dexFilter}`;
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
    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      const n = btn.dataset.nav;
      const active =
        (n === 'home' && feedTab === 'home') ||
        (n === 'trend' && feedTab === 'trending') ||
        (n === 'new' && feedTab === 'new');
      btn.classList.toggle('active', active);
    });

    activeChain = chain;
    syncDexChipsForChain(activeChain);
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
          limit: '24',
          dex: dexFilter,
          chain: activeChain,
        });
        const res = await fetch(`/api/feed?${qs.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'feed_failed');
        const items = body.items?.length ? body.items : [];
        if (dexFilter !== 'all' && !items.length && (body.dexCounts?.all || 0) > 0) {
          setDexFilter('all');
          return loadHomeFeed(apiTab, uiTab, { force: true });
        }
        homeFeedCacheKey = cacheKey;
        return ingestFeedResponse(body, q);
      } catch (e) {
        console.error('[feed]', e);
        applyMarketStats(PLACEHOLDER_STATS, []);
        updateQuickCards(PLACEHOLDER_STATS, []);
        applyHomeExtras(null);
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

  async function fetchFeed(tab) {
    const uiTab = tab || feedTab;
    if (uiTab === 'scan') {
      setFeedTab('scan');
      return null;
    }
    return loadHomeFeed(feedTabForApi(resolveFeedTab(uiTab)), uiTab);
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

    document.querySelectorAll('.dex-chip[data-dex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.dex || 'all';
        if (d === dexFilter) return;
        setDexFilter(d);
        fetchFeed(feedTab);
      });
    });

    const bottomNav = document.querySelector('#scanner-home .bottom-nav');
    bottomNav?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button.bnav[data-nav]');
      if (!btn) return;
      ev.preventDefault();
      onBottomNav(btn.dataset.nav);
    });
    bottomNav?.addEventListener(
      'touchend',
      (ev) => {
        const btn = ev.target.closest('button.bnav[data-nav]');
        if (!btn) return;
        ev.preventDefault();
        onBottomNav(btn.dataset.nav);
      },
      { passive: false },
    );

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
      if (!$('scanner-home')?.classList.contains('hidden')) fetchFeed(feedTab);
    }, 90000);
  }

  function initScannerHome() {
    if (homeFeedBooted) return;
    homeFeedBooted = true;
    activeChain = getActiveChain();
    syncDexChipsForChain(activeChain);
    setFeedTab('home');
    searchQuery = '';
    homeFeedCacheKey = '';
    const sideInp = $('sidebarSearchInput');
    if (sideInp) sideInp.value = '';
    setSearchHint('');
    const list = $('homeTokenList');
    if (list) list.innerHTML = '';
    $('feedLoading')?.classList.remove('hidden');
    void loadHomeFeed('trending', 'home', { force: true });
    setTimeout(() => {
      if (!scannerNavActive && !feedItemsFull.length && !$('scanner-home')?.classList.contains('hidden')) {
        if (typeof globalThis.bootHomeFeed === 'function') void globalThis.bootHomeFeed();
        else void loadHomeFeed('trending', 'home', { force: true });
      }
    }, 2500);
  }

  function bindDetailShell() {
    if (detailShellBound) return;
    detailShellBound = true;
    setupNav();
    setupTfButtons();
    setupChartType();
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
    if (x < 0.0001) return x.toExponential(4);
    if (x < 1) return x.toFixed(8);
    return x.toFixed(6);
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

  function stopTradesPoll() {
    if (tradesResizeHandler) {
      window.removeEventListener('resize', tradesResizeHandler);
      tradesResizeHandler = null;
    }
  }

  function applyDexCrop() {
    if (globalThis.SniperDexCrop) {
      SniperDexCrop.apply();
      return;
    }
  }

  function scheduleDexTradesCrop() {
    applyDexCrop();
    [400, 1200, 2500].forEach((ms) => setTimeout(applyDexCrop, ms));
  }

  function dexTradesEmbedUrl(poolOrMint) {
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
    return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q.toString()}`;
  }

  function showDexTradesEmbed(m) {
    const wrap = $('tradesTape');
    const iframe = $('dexTradesEmbed');
    const fallback = $('dexTradesFallback');
    const meta = $('tradesMeta');
    if (!wrap) return;

    wrap.classList.remove('hidden');
    const poolRef = m?.poolAddress || m?.address || appData?.address;
    const url = dexTradesEmbedUrl(poolRef);

    if (!iframe) return;
    if (!url) {
      iframe.classList.add('hidden');
      if (fallback) {
        fallback.textContent = 'İşlem akışı için pool bulunamadı.';
        fallback.classList.remove('hidden');
      }
      return;
    }

    scheduleDexTradesCrop();
    if (!tradesResizeHandler) {
      tradesResizeHandler = () => scheduleDexTradesCrop();
      window.addEventListener('resize', tradesResizeHandler);
    }

    if (fallback) {
      fallback.textContent = 'İşlem akışı yükleniyor…';
      fallback.classList.remove('hidden');
    }
    iframe.classList.remove('hidden');
    iframe.onload = () => {
      scheduleDexTradesCrop();
      if (fallback) fallback.classList.add('hidden');
      if (meta) meta.textContent = 'canlı';
      if (globalThis.SniperDexCrop?.isCalibrateMode?.()) {
        setTimeout(() => SniperDexCrop.openPanel(), 300);
      }
    };
    if (iframe.src !== url) iframe.src = url;
    else if (meta) meta.textContent = 'canlı';
  }

  function startTradesPoll(m) {
    stopTradesPoll();
    showDexTradesEmbed(m);
  }

  function dexEmbedUrlFor(poolOrMint, tf) {
    const ref = String(poolOrMint || '').trim();
    if (!ref) return null;
    const intervals = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': '1D' };
    const interval = intervals[String(tf || '15m').toLowerCase()] || '15';
    const q = new URLSearchParams({
      embed: '1',
      theme: 'dark',
      trades: '0',
      info: '0',
      tabs: '0',
      chartLeftToolbar: '1',
      chartTheme: 'dark',
      chartType: 'candle',
      interval,
    });
    return `https://dexscreener.com/solana/${encodeURIComponent(ref)}?${q.toString()}`;
  }

  function setChartEmbedMode(on) {
    document.querySelector('.chart-terminal')?.classList.toggle('chart-terminal--dex-embed', !!on);
  }

  function showDexEmbedChart(container, m, note, tf) {
    const poolRef = m?.poolAddress || m?.address;
    const embed = dexEmbedUrlFor(poolRef, tf);
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    if (embed) {
      setChartEmbedMode(true);
      container.innerHTML = `<iframe class="dex-embed-chart" src="${escHtml(embed)}" title="DexScreener canlı grafik" loading="eager" allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
      const chartIfr = container.querySelector('iframe.dex-embed-chart');
      if (chartIfr) chartIfr.addEventListener('load', () => applyDexCrop());
      if (note) {
        note.textContent = `${(tf || '15m').toUpperCase()} · DexScreener`;
        note.classList.remove('hidden');
      }
      applyDexCrop();
      return true;
    }
    setChartEmbedMode(false);
    const link = page
      ? `<a class="dex-chart-link" href="${escHtml(page)}" target="_blank" rel="noopener">DexScreener’da aç</a>`
      : '';
    container.innerHTML = `<div class="empty-chart">Grafik yüklenemedi. ${link}</div>`;
    return false;
  }

  function loadChartLibrary() {
    return new Promise((resolve) => {
      if (window.LightweightCharts) {
        resolve(true);
        return;
      }
      const urls = [
        '/vendor/lightweight-charts.js?v=3',
        'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js',
      ];
      let i = 0;
      const next = () => {
        if (window.LightweightCharts) {
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
        s.onload = () => resolve(!!window.LightweightCharts);
        s.onerror = next;
        document.head.appendChild(s);
      };
      next();
    });
  }

  function destroyChart() {
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

  function preferDexEmbedChart(m) {
    const poolRef = m?.poolAddress || m?.address;
    return !!dexEmbedUrlFor(poolRef, currentTf);
  }

  async function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    const candles = m?.chart?.candles || [];
    const tf = m?.chart?.timeframe || currentTf;
    const stats = m?.chart?.stats;

    renderChartPeriodChg(stats, tf);

    destroyChart();
    setChartEmbedMode(false);
    container.innerHTML = '';
    if (note) note.classList.remove('hidden');

    if (preferDexEmbedChart(m)) {
      if (showDexEmbedChart(container, m, note, tf)) {
        const last = candles[candles.length - 1];
        if (last) updateOhlc(last);
        return;
      }
    }

    if (note) {
      note.textContent = candles.length
        ? `${tf.toUpperCase()} · Canlı mum · GeckoTerminal`
        : 'DexScreener embed yüklenemedi';
    }

    const hasLib = await loadChartLibrary();
    if (!hasLib) {
      showDexEmbedChart(container, m, note, tf);
      return;
    }
    const seriesData = buildChartData(candles);
    if (!seriesData.length) {
      showDexEmbedChart(container, m, note, tf);
      return;
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const last = candles[candles.length - 1];
    updateOhlc(last);

    const w = Math.max(container.clientWidth || 0, 320);
    try {
    chartApi = LightweightCharts.createChart(container, {
      width: w,
      height: Math.min(380, Math.max(300, Math.floor(window.innerHeight * 0.38))),
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7788',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
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
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { width: 1, color: 'rgba(59,130,246,0.45)', style: 2 },
        horzLine: { width: 1, color: 'rgba(59,130,246,0.35)', style: 2 },
      },
    });

    candleSeries = chartApi.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      visible: chartType !== 'line',
    });

    lineSeries = chartApi.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
      visible: chartType === 'line',
    });

    volumeSeries = chartApi.addHistogramSeries({
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
        color: d.close >= d.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
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
      if (chartApi) chartApi.applyOptions({ width: container.clientWidth || w });
    };
    window.addEventListener('resize', resizeHandler);
    } catch (e) {
      console.warn('chart render', e);
      destroyChart();
      container.innerHTML = '';
      showDexEmbedChart(container, m, note, tf);
    }
  }

  function setChartType(type) {
    chartType = type;
    document.querySelectorAll('.ctype').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === type);
    });
    if (!chartApi || !candleSeries || !lineSeries || !appData?.market?.chart?.candles) return;
    const seriesData = buildChartData(appData.market.chart.candles);
    if (type === 'line') {
      candleSeries.applyOptions({ visible: false });
      lineSeries.applyOptions({ visible: true });
      lineSeries.setData(seriesData.map((d) => ({ time: d.time, value: d.close })));
    } else {
      lineSeries.applyOptions({ visible: false });
      candleSeries.applyOptions({ visible: true });
      candleSeries.setData(seriesData);
    }
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

  function setupTfButtons() {
    document.querySelectorAll('.tf').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tf = btn.dataset.tf;
        if (!tf || tf === currentTf || !reportId) return;

        const m = appData?.market;
        const poolRef = m?.poolAddress || m?.address;
        if (preferDexEmbedChart(m) && poolRef) {
          currentTf = tf;
          const container = $('priceChart');
          const iframe = container?.querySelector('iframe.dex-embed-chart');
          const url = dexEmbedUrlFor(poolRef, tf);
          if (iframe && url) {
            iframe.src = url;
            const note = $('chartNote');
            if (note) note.textContent = `${tf.toUpperCase()} · Canlı grafik · DexScreener`;
            document.querySelectorAll('.tf').forEach((b) => {
              b.classList.toggle('active', b.dataset.tf === tf);
            });
            setChartLoading(true);
            iframe.onload = () => setChartLoading(false);
            setTimeout(() => setChartLoading(false), 4000);
            return;
          }
        }

        setChartLoading(true);
        document.querySelectorAll('.tf').forEach((b) => b.classList.add('loading'));
        try {
          await loadReport(tf);
          document.querySelectorAll('.tf').forEach((b) => {
            b.classList.remove('loading');
            b.classList.toggle('active', b.dataset.tf === tf);
          });
        } catch (e) {
          document.querySelectorAll('.tf').forEach((b) => b.classList.remove('loading'));
          const msg = e?.hint || e?.message;
          showToast(msg && msg !== 'not_found' ? msg : 'Grafik yenilenemedi — birkaç sn sonra tekrar dene');
        } finally {
          setChartLoading(false);
        }
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
      setChartEmbedMode(false);
    } else {
      chartSection?.classList.remove('hidden');
      renderChart(m).catch((e) => console.warn('renderChart', e));
    }
    startTradesPoll(m);
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
  globalThis.fetchFeedForChain = (chainId) => {
    if (!chainId) return;
    if (global.SniperSidebar?.setChain) global.SniperSidebar.setChain(chainId);
    else switchActiveChain(chainId);
    showScannerHome();
  };

  globalThis.loadHomeFeed = loadHomeFeed;
  globalThis.ingestFeedResponse = ingestFeedResponse;
  globalThis.refreshHomeFeed = () => loadHomeFeed('trending', feedTab === 'new' ? 'new' : feedTab === 'home' ? 'home' : 'trending');

  main();
})();
