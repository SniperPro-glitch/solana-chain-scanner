(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.themeParams.bg_color) {
      document.documentElement.style.setProperty('--bg', tg.themeParams.bg_color);
    }
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
  let homeShellBound = false;
  let feedPollTimer = null;
  let openingMint = false;

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
    const chg = item.change24h;
    const up = chg == null ? true : Number(chg) >= 0;
    const avatar = item.imageUrl
      ? `<img class="tr-img" src="${escHtml(item.imageUrl)}" alt="" loading="lazy" />`
      : `<span class="tr-avatar">${escHtml((item.symbol || '?').slice(0, 2))}</span>`;
    return `<article class="token-row ${extraClass}" data-mint="${escHtml(item.mint)}">
      <span class="tr-rank">${item.rank ?? '·'}</span>
      ${avatar}
      <div class="tr-info"><h3>${escHtml(item.symbol)}</h3><p>MCap ${escHtml(item.marketCapUsdFmt)} · ${escHtml(item.pairLabel || item.dex || 'SOL')}</p></div>
      <div class="tr-right"><div class="tr-price">${escHtml(item.priceUsdFmt)}</div><span class="tr-chg ${up ? 'up' : 'down'}">${formatPct(chg)}</span><span class="risk-badge ${rc}">${escHtml(label)}</span></div>
      ${miniSparkline(up)}
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
    const col = up ? '#22ff88' : '#ff4d6d';
    return `<svg class="tr-spark" viewBox="0 0 40 22" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.5" points="${pts}"/></svg>`;
  }

  function hideAllViews() {
    $('loading')?.classList.add('hidden');
    $('error')?.classList.add('hidden');
    $('scanner-home')?.classList.add('hidden');
    $('view-detail')?.classList.add('hidden');
  }

  function showScannerHome() {
    hideAllViews();
    $('scanner-home')?.classList.remove('hidden');
    initScannerHome();
  }

  function showDetailView() {
    hideAllViews();
    $('view-detail')?.classList.remove('hidden');
  }

  function setFeedTab(tab) {
    feedTab = tab === 'new' ? 'new' : 'trending';
    document.querySelectorAll('.feed-tab[data-feed]').forEach((btn) => {
      const f = btn.dataset.feed;
      if (f === 'refresh') return;
      btn.classList.toggle('active', f === feedTab);
    });
    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      const n = btn.dataset.nav;
      const onTab =
        (feedTab === 'trending' && n === 'trend') || (feedTab === 'new' && n === 'new');
      btn.classList.toggle('active', n === 'home' || onTab);
    });
    const label = $('feedLabel');
    if (label) label.textContent = feedTab === 'new' ? 'Yeni çiftler' : 'Trend · canlı';
  }

  function renderLastReportRow() {
    try {
      const last = JSON.parse(sessionStorage.getItem('lastReport') || 'null');
      if (!last?.id) return '';
      const r = riskBadgeLabel(last.level, last.score);
      const up = (last.chg || 0) >= 0;
      return `<article class="token-row token-row-last" data-report="${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <span class="tr-avatar">${escHtml((last.symbol || '?').slice(0, 2))}</span>
        <div class="tr-info"><h3>${escHtml(last.symbol)} · Son analiz</h3><p>MCap ${escHtml(last.mcap || '—')} · Tekrar aç</p></div>
        <div class="tr-right"><div class="tr-price">${escHtml(last.price || '—')}</div><span class="risk-badge ${r.cls}">${r.text}</span></div>
        ${miniSparkline(up)}
      </article>`;
    } catch {
      return '';
    }
  }

  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const top = items[0];
    const cards = [
      { icon: '🔥', title: 'Trend', val: stats?.volume24hFmt || 'Canlı', accent: 'accent-pink' },
      { icon: '✦', title: 'Yeni', val: feedTab === 'new' ? 'Aktif' : 'Çiftler', accent: 'accent-green' },
      { icon: '◎', title: 'Likidite', val: top?.liquidityUsdFmt || 'Scanner', accent: 'accent-cyan' },
      { icon: '◆', title: 'Güvenlik', val: top?.trustScore != null ? `${top.trustScore}%` : 'RugCheck', accent: 'accent-purple' },
      { icon: '★', title: 'Liste', val: String(stats?.count || items.length), accent: 'accent-gold' },
    ];
    qc.innerHTML = cards.map(
      (c) => `<article class="quick-card ${c.accent}"><div class="qc-icon">${c.icon}</div><div class="qc-title">${c.title}</div><div class="qc-val">${c.val}</div></article>`,
    ).join('');
  }

  async function fetchFeed(tab) {
    const t = tab || feedTab;
    setFeedTab(t);
    const loadingEl = $('feedLoading');
    const list = $('homeTokenList');
    loadingEl?.classList.remove('hidden');
    list?.classList.add('dimmed');
    try {
      const res = await fetch(`/api/feed?tab=${encodeURIComponent(t)}&limit=24`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'feed_failed');
      const items = body.items || [];
      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statCount')) $('statCount').textContent = String(body.stats?.count || items.length);
      updateQuickCards(body.stats, items);
      if (list) {
        const rows = renderLastReportRow() + items.map((it) => renderFeedRow(it)).join('');
        list.innerHTML = rows || '<p class="home-cta">Liste boş — biraz sonra yenile.</p>';
      }
      return body;
    } catch (e) {
      if (list) {
        list.innerHTML = `${renderLastReportRow()}<p class="home-cta">Liste yüklenemedi. ${escHtml(e.message || '')}</p>`;
      }
      showToast('Canlı liste alınamadı');
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
      const res = await fetch(`/api/open/${encodeURIComponent(mint)}`);
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
    fetchFeed(feedTab);
  }

  async function loadReportFlow() {
    showDetailView();
    setupNav();
    setupTfButtons();
    setupChartType();
    setupCopy();
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
    return candles.map((c) => ({
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));
  }

  function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    const candles = m?.chart?.candles || [];
    const tf = m?.chart?.timeframe || currentTf;
    const stats = m?.chart?.stats;

    renderChartPeriodChg(stats, tf);

    if (note) {
      const src = m?.chart?.source === 'geckoterminal' ? 'GeckoTerminal' : 'Canlı';
      note.textContent = candles.length
        ? `${tf.toUpperCase()} · ${src} · ${candles.length} bar`
        : 'Havuz bulunamadı — DexScreener üzerinden kontrol edin';
    }

    destroyChart();
    container.innerHTML = '';

    if (!candles.length || !window.LightweightCharts) {
      container.innerHTML = '<div class="empty-chart">Grafik verisi yüklenemedi</div>';
      container.innerHTML = container.innerHTML.split('div').join('div');
      return;
    }

    const last = candles[candles.length - 1];
    updateOhlc(last);

    const w = container.clientWidth || 360;
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

    const seriesData = buildChartData(candles);

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

    const volData = candles.map((c) => ({
      time: c.time,
      value: Number(c.volume) || 0,
      color: Number(c.close) >= Number(c.open)
        ? 'rgba(34,197,94,0.4)'
        : 'rgba(239,68,68,0.4)',
    }));

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
      const links = [
        a.dsUrl && { label: 'DexScreener', url: a.dsUrl },
        a.gtUrl && { label: 'GeckoTerminal', url: a.gtUrl },
        a.explorerUrl && { label: 'Solscan', url: a.explorerUrl },
        a.pumpUrl && { label: 'Pump.fun', url: a.pumpUrl },
      ].filter(Boolean);

      panel.innerHTML = [
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
        } catch {
          document.querySelectorAll('.tf').forEach((b) => b.classList.remove('loading'));
          showToast('Grafik yenilenemedi');
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
      dexBadge.textContent = (m.dex || data.dex || 'DEX').toString().toUpperCase();
      dexBadge.className = 'pill';
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
    renderChart(m);
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
    const res = await fetch(`/api/report/${encodeURIComponent(reportId)}${q}`);
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
    $('btnConnect')?.addEventListener('click', () => {
      showToast('Cüzdan — detay ekranından Al');
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
