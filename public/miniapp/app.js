(function () {
  const tg = window.Telegram?.WebApp;
  let apiConfig = { botApiBase: '', webAppBase: '' };

  async function loadApiConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) apiConfig = await res.json();
    } catch {
      /* aynı sunucu */
    }
    return apiConfig;
  }

  function apiRoot() {
    const base = String(apiConfig.botApiBase || '').replace(/\/$/, '');
    return base;
  }

  function apiPath(path) {
    const root = apiRoot();
    return root ? `${root}${path}` : path;
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
  let homeShellBound = false;
  let detailShellBound = false;
  let feedPollTimer = null;
  let openingMint = false;

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

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg24 = item.change24h;
    const chg1 = item.change1h;
    const up24 = chg24 == null ? true : Number(chg24) >= 0;
    const pairShort = escHtml((item.pairLabel || 'SOL').replace(/^.*\//, '') || 'SOL');
    const avatar = item.imageUrl
      ? `<span class="tr-avatar-wrap"><img class="tr-img" src="${escHtml(item.imageUrl)}" alt="" loading="lazy" data-fb="${escHtml((item.imageFallbacks || []).join('|'))}" /><span class="tr-chain-dot">◎</span></span>`
      : `<span class="tr-avatar-wrap"><span class="tr-avatar">${escHtml((item.symbol || '?').slice(0, 2))}</span><span class="tr-chain-dot">◎</span></span>`;
    const reportAttr = item.reportId ? ` data-report="${escHtml(item.reportId)}"` : '';
    const dexKey = item.dexPlatform || 'other';
    const dexBadge = item.dexLabel
      ? `<span class="tr-dex-badge dex-${escHtml(dexKey)}">${escHtml(item.dexLabel)}</span>`
      : '';
    return `<article class="token-row ${extraClass}" data-mint="${escHtml(item.mint)}" data-dex="${escHtml(dexKey)}"${reportAttr}>
      <span class="tr-rank">${item.rank ?? '·'}</span>
      <div class="tr-token">${avatar}<div class="tr-meta"><div class="tr-name">${escHtml(item.symbol)}<span class="tr-pair"> / ${pairShort}</span>${dexBadge}</div><div class="tr-sub">MCap ${escHtml(item.marketCapUsdFmt)}</div></div>
      <span class="tr-price">${escHtml(item.priceUsdFmt)}</span>
      <span class="tr-pct ${chgClass(chg1)}">${formatPct(chg1)}</span>
      <span class="tr-pct ${chgClass(chg24)}">${formatPct(chg24)}</span>
      <span class="tr-vol">${escHtml(item.volume24hFmt || '—')}</span>
      <span class="tr-liq">${escHtml(item.liquidityUsdFmt || '—')}</span>
      <div class="tr-risk-col">${miniSparkline(up24)}<span class="risk-badge ${rc}">${escHtml(label)}</span></div>
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
    hideAllViews();
    $('scanner-home')?.classList.remove('hidden');
    refreshTgViewport();
    initScannerHome();
  }

  function showDetailView() {
    hideAllViews();
    $('view-detail')?.classList.remove('hidden');
    refreshTgViewport();
  }

  function setFeedTab(tab) {
    feedTab = tab === 'new' ? 'new' : 'trending';
    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      const n = btn.dataset.nav;
      const onTab =
        (feedTab === 'trending' && n === 'trend') || (feedTab === 'new' && n === 'new');
      btn.classList.toggle('active', n === 'home' || onTab);
    });
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
        <div class="tr-risk-col">${miniSparkline(up)}<span class="risk-badge ${r.cls}">${r.text}</span></div>
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
      return `<button type="button" class="trend-chip" data-mint="${escHtml(t.mint)}"${reportAttr}>
        <span class="trend-sym">${escHtml(t.symbol)}</span>
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

  function renderTokenList(items) {
    const list = $('homeTokenList');
    if (!list) return;
    const rows = renderLastReportRow() + (items || []).map((it) => renderFeedRow(it)).join('');
    list.innerHTML = rows || '<p class="home-cta">Henüz bot paylaşımı yok. Kanala token düştükçe burada listelenecek.</p>';
    bindFeedRowLogos(list);
  }

  function applyMarketStats(stats) {
    const st = stats || PLACEHOLDER_STATS;
    if ($('statVol')) $('statVol').textContent = st.volume24hFmt || '—';
    if ($('statNew')) $('statNew').textContent = String(st.newPairs ?? '—');
    if ($('statLiq')) $('statLiq').textContent = st.liquidityFmt || '—';
    if ($('statActive')) $('statActive').textContent = String(st.activeNow ?? '—');
    [['statVolChg', '+16.8%'], ['statNewChg', '+23.5%'], ['statLiqChg', '+19.2%'], ['statActiveChg', '+12.3%']].forEach(([id, t]) => {
      const el = $(id);
      if (el) el.textContent = t;
    });
  }

  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const trending = (stats?.count || items.length);
    const cards = [
      { icon: '🔥', title: 'Live Trending', val: trending.toLocaleString('en-US'), accent: 'accent-pink', tag: 'LIVE', tagCls: 'live', action: 'trending' },
      { icon: '✦', title: 'New Pairs', val: String(stats?.newPairs ?? items.length), accent: 'accent-green', tag: 'NEW', tagCls: 'new', action: 'new' },
      { icon: '◎', title: 'Liquidity Scanner', val: stats?.liquidityFmt || '$243.6M', accent: 'accent-cyan', tag: '', action: null },
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

  async function fetchFeed(tab) {
    await loadApiConfig();
    const t = tab || feedTab;
    setFeedTab(t);
    const loadingEl = $('feedLoading');
    const list = $('homeTokenList');
    loadingEl?.classList.remove('hidden');
    list?.classList.add('dimmed');
    try {
      const res = await fetch(
        apiPath(`/api/feed?tab=${encodeURIComponent(t)}&limit=24&dex=${encodeURIComponent(dexFilter)}`),
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'feed_failed');
      if (body.empty && body.emptyMessage) {
        applyMarketStats({ count: 0, volume24hFmt: '—', liquidityFmt: '—', newPairs: 0, activeNow: 0 });
        updateQuickCards({ count: 0, newPairs: 0, liquidityFmt: '—' }, []);
        applyHomeExtras(body);
        renderTokenList([]);
        showToast(body.emptyMessage.slice(0, 80));
        return body;
      }
      const items = body.items?.length ? body.items : [];
      updateDexChipCounts(body.dexCounts);
      if (body.dexFilter) setDexFilter(body.dexFilter);
      applyMarketStats(body.stats || PLACEHOLDER_STATS);
      updateQuickCards(body.stats || PLACEHOLDER_STATS, items);
      applyHomeExtras(body);
      renderTokenList(items);
      if (dexFilter !== 'all' && !items.length && (body.dexCounts?.all || 0) > 0) {
        showToast('Bu DEX filtresinde yok — Tümü\'ne geçiliyor');
        setDexFilter('all');
        return fetchFeed(t);
      }
      if (body.empty && body.emptyMessage) {
        showToast('Liste boş — /post ile kanala paylaşın');
      }
      return body;
    } catch (e) {
      applyMarketStats(PLACEHOLDER_STATS);
      updateQuickCards(PLACEHOLDER_STATS, []);
      applyHomeExtras(null);
      renderTokenList([]);
      showToast('Liste yüklenemedi — bot paylaşımlarını bekleyin');
      return null;
    } finally {
      loadingEl?.classList.add('hidden');
      list?.classList.remove('dimmed');
    }
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

    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'home') {
          location.hash = '';
          reportId = null;
          showScannerHome();
          return;
        }
        if (nav === 'trend') {
          fetchFeed('trending');
          return;
        }
        if (nav === 'new') {
          fetchFeed('new');
          return;
        }
        if (nav === 'scan') {
          showToast('Listeden bir token seç');
          return;
        }
        showToast('Yakında');
      });
    });

    $('homeTokenList')?.addEventListener('click', (ev) => {
      const row = ev.target.closest('.token-row');
      if (!row) return;
      const rid = row.dataset.report;
      if (rid) {
        reportId = rid;
        location.hash = `r=${rid}`;
        loadReportFlow();
        return;
      }
      const m = row.dataset.mint;
      if (m) openTokenByMint(m);
    });

    feedPollTimer = setInterval(() => {
      if (!$('scanner-home')?.classList.contains('hidden')) fetchFeed(feedTab);
    }, 90000);
  }

  function initScannerHome() {
    bindHomeShell();
    setFeedTab(feedTab);
    loadApiConfig().then(() => fetchFeed(feedTab));
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

  function renderMetrics(m, stats) {
    const dash = $('metricsDash');
    if (!dash) return;
    const hi = stats?.periodHigh != null ? fmtPriceNum(stats.periodHigh) : '—';
    const lo = stats?.periodLow != null ? fmtPriceNum(stats.periodLow) : '—';
    const cells = [
      { label: 'Likidite', value: m.liquidityUsdFmt },
      { label: 'Hacim 24s', value: m.volume24hFmt },
      { label: 'MCap', value: m.marketCapUsdFmt },
      { label: 'FDV', value: m.fdvUsdFmt },
      { label: 'Dönem yüksek', value: hi },
      { label: 'Dönem düşük', value: lo },
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

  function showDexEmbedChart(container, m, note, tf) {
    const embed = m?.chart?.dexScreenerEmbedUrl;
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    if (embed) {
      container.innerHTML = `<iframe class="dex-embed-chart" src="${escHtml(embed)}" title="DexScreener" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`;
      if (note) note.textContent = `${(tf || '15m').toUpperCase()} · Grafik DexScreener`;
      return true;
    }
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

  async function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    const candles = m?.chart?.candles || [];
    const tf = m?.chart?.timeframe || currentTf;
    const stats = m?.chart?.stats;

    renderChartPeriodChg(stats, tf);

    if (note) {
      if (candles.length) {
        note.textContent = `${tf.toUpperCase()} · Fiyat DexScreener · Mum GeckoTerminal · ${candles.length} bar`;
      } else {
        note.textContent = 'Canlı mum: GeckoTerminal · Fiyat/hacim: DexScreener API';
      }
    }

    destroyChart();
    container.innerHTML = '';

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
      height: 280,
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
      bar.innerHTML = buy
        ? `<a class="btn-buy" href="${buy}" target="_blank" rel="noopener">Al</a>
           <a class="btn-sell" href="${sell}" target="_blank" rel="noopener">Sat</a>
           <a class="btn-chart" href="${a.dsUrl || m.dexScreenerUrl || '#'}" target="_blank" rel="noopener">Chart</a>`
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
    $('priceUsd').textContent = m.priceUsdFmt || data.summary?.price || '—';

    renderQuoteChanges(m);
    renderMetrics(m, m.chart?.stats);
    renderTxnBar(m);
    renderChart(m).catch((e) => console.warn('renderChart', e));
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
    $('loading')?.classList.remove('hidden');

    if (!reportId) {
      $('loading')?.classList.add('hidden');
      showScannerHome();
      return;
    }

    await loadReportFlow();
  }

  main();
})();
