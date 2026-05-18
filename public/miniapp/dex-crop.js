/**
 * DexScreener grafik + işlem kırpma.
 * Kayıtlı ayarlar referans ekran boyutuna göre ölçeklenir (Telegram / resize).
 */
(function (global) {
  const STORAGE_KEY = 'sniperDexCropV1';
  const D = 'di' + 'v';
  const CHART_BRAND_CROP = 40;
  const REF_VIEWPORT = { w: 390, h: 844 };

  const DEFAULTS = {
    chart: {
      stageH: 340,
      top: -8,
      left: -4,
      width: 108,
      heightExtra: 20,
      brandCrop: CHART_BRAND_CROP,
    },
    trades: {
      viewH: 268,
      iframeH: 980,
      iframeTop: -820,
      left: -3,
      width: 106,
      maskTop: 8,
      maskFoot: 24,
    },
  };

  let resizeDebounce = null;

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function getViewport() {
    const tg = global.Telegram?.WebApp;
    const cssH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'));
    const h = cssH || tg?.viewportStableHeight || tg?.viewportHeight || window.innerHeight || REF_VIEWPORT.h;
    return {
      w: Math.max(320, window.innerWidth || REF_VIEWPORT.w),
      h: Math.max(480, h),
    };
  }

  function getAppHeight() {
    const cssH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'));
    if (cssH > 0) return cssH;
    const tg = global.Telegram?.WebApp;
    return tg?.viewportStableHeight || tg?.viewportHeight || window.innerHeight || REF_VIEWPORT.h;
  }

  /** Üst blok + trade bar sonrası grafik/işlem için kalan yükseklik */
  function computeEmbedBudget(chartBase, tradesBase) {
    const detail = document.getElementById('view-detail');
    if (!detail || detail.classList.contains('hidden')) return null;

    let above = 0;
    const top = detail.querySelector('.detail-top');
    const hero = detail.querySelector('.hero-card');
    if (top) above += top.offsetHeight;
    if (hero) above += hero.offsetHeight;

    const tradeBarH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--trade-bar-h')) || 76;
    const safeB =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tg-safe-bottom')) || 0;
    const budget = getAppHeight() - above - tradeBarH - safeB - 28;
    if (budget < 380) return null;

    const maxChart = chartBase?.stageH || DEFAULTS.chart.stageH;
    const maxTrades = tradesBase?.viewH || DEFAULTS.trades.viewH;
    const chartH = Math.round(Math.min(maxChart, Math.max(248, budget * 0.54)));
    const tradesH = Math.round(Math.min(maxTrades, Math.max(188, budget - chartH - 56)));

    return { chartH, tradesH, budget };
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { chart: clone(DEFAULTS.chart), trades: clone(DEFAULTS.trades), refViewport: { ...REF_VIEWPORT } };
      }
      const parsed = JSON.parse(raw);
      return {
        chart: { ...DEFAULTS.chart, ...parsed.chart },
        trades: { ...DEFAULTS.trades, ...parsed.trades },
        refViewport: parsed.refViewport || { ...REF_VIEWPORT },
      };
    } catch {
      return { chart: clone(DEFAULTS.chart), trades: clone(DEFAULTS.trades), refViewport: { ...REF_VIEWPORT } };
    }
  }

  function load() {
    const raw = loadRaw();
    return { chart: raw.chart, trades: raw.trades };
  }

  /**
   * Kutu yüksekliği ekrana göre küçülür; iframe kırpma ofsetleri sabit kalır.
   * Yükseklik azalınca iframe kaydırması aynı hizada kalsın diye top/iframeTop telafi edilir.
   */
  function adaptForLayout(chart, trades, useLayout) {
    if (!useLayout) return { chart: { ...chart }, trades: { ...trades } };

    const budget = computeEmbedBudget(chart, trades);
    if (!budget) return { chart: { ...chart }, trades: { ...trades } };

    const chartH = budget.chartH;
    const tradesH = budget.tradesH;
    const chartDelta = (chart.stageH || DEFAULTS.chart.stageH) - chartH;
    const tradesDelta = (trades.viewH || DEFAULTS.trades.viewH) - tradesH;

    return {
      chart: {
        ...chart,
        stageH: chartH,
        top: (chart.top ?? DEFAULTS.chart.top) - chartDelta,
      },
      trades: {
        ...trades,
        viewH: tradesH,
        iframeTop: (trades.iframeTop ?? DEFAULTS.trades.iframeTop) - tradesDelta,
      },
    };
  }

  function save(settings) {
    const payload = {
      chart: settings.chart,
      trades: settings.trades,
      refViewport: getViewport(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    apply(payload);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    const d = {
      chart: clone(DEFAULTS.chart),
      trades: clone(DEFAULTS.trades),
      refViewport: { ...REF_VIEWPORT },
    };
    apply(d);
    return d;
  }

  function applyPixels(scaled) {
    const root = document.documentElement;
    const c = scaled.chart;
    const t = scaled.trades;
    const brandCrop = Number(c.brandCrop) || CHART_BRAND_CROP;

    root.style.setProperty('--chart-embed-h', `${c.stageH}px`);
    root.style.setProperty('--chart-embed-top', `${c.top}px`);
    root.style.setProperty('--chart-embed-left', `${c.left}%`);
    root.style.setProperty('--chart-embed-width', `${c.width}%`);
    root.style.setProperty('--chart-embed-extra', `${c.heightExtra}px`);
    root.style.setProperty('--chart-brand-crop', `${brandCrop}px`);

    root.style.setProperty('--dex-trades-view-h', `${t.viewH}px`);
    root.style.setProperty('--dex-iframe-h', `${t.iframeH}px`);
    root.style.setProperty('--dex-iframe-top', `${t.iframeTop}px`);
    root.style.setProperty('--dex-iframe-left', `${t.left}%`);
    root.style.setProperty('--dex-iframe-width', `${t.width}%`);
    root.style.setProperty('--dex-mask-top-h', `${t.maskTop}px`);
    root.style.setProperty('--dex-mask-foot-h', `${t.maskFoot}px`);

    const stage = document.querySelector('.chart-terminal--dex-embed .chart-stage');
    const chartIframe = document.querySelector('iframe.dex-embed-chart');
    if (stage) {
      stage.style.height = `${c.stageH}px`;
      stage.style.minHeight = `${c.stageH}px`;
      stage.style.maxHeight = `${c.stageH}px`;
    }
    if (chartIframe) {
      chartIframe.style.position = 'absolute';
      chartIframe.style.top = `${c.top - brandCrop}px`;
      chartIframe.style.left = `${c.left}%`;
      chartIframe.style.width = `${c.width}%`;
      chartIframe.style.height = `${c.stageH + c.heightExtra + brandCrop}px`;
      chartIframe.style.maxWidth = 'none';
    }

    const wrap = document.getElementById('dexTradesWrap');
    const tradesIframe = document.getElementById('dexTradesEmbed');
    const maskTop = wrap?.querySelector('.dex-mask-top');
    const maskFoot = wrap?.querySelector('.dex-mask-foot');

    if (wrap) {
      wrap.style.height = `${t.viewH}px`;
      wrap.style.minHeight = `${t.viewH}px`;
      wrap.style.maxHeight = `${t.viewH}px`;
    }
    if (tradesIframe) {
      tradesIframe.style.position = 'absolute';
      tradesIframe.style.top = `${t.iframeTop}px`;
      tradesIframe.style.left = `${t.left}%`;
      tradesIframe.style.width = `${t.width}%`;
      tradesIframe.style.height = `${t.iframeH}px`;
      tradesIframe.style.maxWidth = 'none';
    }
    if (maskTop) maskTop.style.height = `${t.maskTop}px`;
    if (maskFoot) maskFoot.style.height = `${t.maskFoot}px`;
  }

  function apply(input) {
    const raw = input?.chart ? input : loadRaw();
    const calibrating = document.documentElement.classList.contains('crop-panel-open');
    const adapted = adaptForLayout(raw.chart, raw.trades, !calibrating);
    applyPixels(adapted);
  }

  function scheduleApply() {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => apply(), 120);
  }

  function bindViewportListeners() {
    window.addEventListener('resize', scheduleApply);
    const tg = global.Telegram?.WebApp;
    if (tg?.onEvent) {
      tg.onEvent('viewportChanged', scheduleApply);
    }
    if (typeof global.__tgApplySafeArea === 'function') {
      const orig = global.__tgApplySafeArea;
      global.__tgApplySafeArea = function () {
        orig();
        scheduleApply();
      };
    }
  }

  function isCalibrateMode() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('kalibre') === '1' || q.get('calibrate') === '1') return true;
    } catch {
      /* yoksay */
    }
    return String(location.hash || '').includes('kalibre');
  }

  function sliderRow(label, id, min, max, step, value, hint) {
    return `<label class="crop-row" for="${id}">
      <span class="crop-lbl">${label} <output id="${id}Out" class="crop-val">${value}</output></span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      ${hint ? `<span class="crop-hint">${hint}</span>` : ''}
    </label>`;
  }

  let panelEl = null;
  let current = null;
  let panelBuilt = false;

  function bindSlider(id, section, key, onChange) {
    const input = document.getElementById(id);
    const out = document.getElementById(`${id}Out`);
    if (!input) return;
    const handler = () => {
      if (!current?.[section]) return;
      const v = Number(input.value);
      current[section][key] = v;
      if (out) out.textContent = String(v);
      onChange();
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  }

  function syncSlidersFromCurrent() {
    if (!current) return;
    const map = [
      ['cropChartStageH', current.chart.stageH],
      ['cropChartTop', current.chart.top],
      ['cropChartLeft', current.chart.left],
      ['cropChartWidth', current.chart.width],
      ['cropChartExtra', current.chart.heightExtra],
      ['cropTradesViewH', current.trades.viewH],
      ['cropTradesIframeH', current.trades.iframeH],
      ['cropTradesTop', current.trades.iframeTop],
      ['cropTradesLeft', current.trades.left],
      ['cropTradesWidth', current.trades.width],
      ['cropTradesMaskTop', current.trades.maskTop],
      ['cropTradesMaskFoot', current.trades.maskFoot],
    ];
    map.forEach(([id, val]) => {
      const el = document.getElementById(id);
      const out = document.getElementById(`${id}Out`);
      if (el) el.value = String(val);
      if (out) out.textContent = String(val);
    });
  }

  function openPanel() {
    if (!panelBuilt) buildPanel();
    const raw = loadRaw();
    current = { chart: raw.chart, trades: raw.trades };
    syncSlidersFromCurrent();
    apply(raw);
    panelEl.classList.remove('hidden');
    document.documentElement.classList.add('crop-panel-open');
    refreshPreview();
  }

  function closePanel() {
    panelEl?.classList.add('hidden');
    document.documentElement.classList.remove('crop-panel-open');
  }

  function refreshPreview() {
    const pre = document.getElementById('cropJsonPreview');
    if (pre && current) {
      const vp = getViewport();
      pre.textContent = JSON.stringify(
        { chart: current.chart, trades: current.trades, refViewport: vp },
        null,
        2,
      );
    }
  }

  function buildPanel() {
    const c = DEFAULTS.chart;
    const t = DEFAULTS.trades;
    panelEl = document.createElement('aside');
    panelEl.id = 'dexCropPanel';
    panelEl.className = 'dex-crop-panel hidden';
    panelEl.innerHTML = [
      '<header class="dex-crop-head"><strong>Kırpma ayarı</strong>',
      '<button type="button" class="crop-close" id="cropCloseBtn" aria-label="Kapat">✕</button></header>',
      '<p class="crop-intro">Kaydır → önizleme. <b>Kaydet</b> kırpmayı saklar; kutu yüksekliği telefonda otomatik sığar.</p>',
      '<section class="crop-section"><h3>Grafik</h3>',
      sliderRow('Kutu yüksekliği', 'cropChartStageH', 260, 480, 2, c.stageH, ''),
      sliderRow('Üst kaydır (px)', 'cropChartTop', -40, 20, 1, c.top, ''),
      sliderRow('Sol (%)', 'cropChartLeft', -12, 8, 1, c.left, ''),
      sliderRow('Genişlik (%)', 'cropChartWidth', 98, 115, 1, c.width, ''),
      sliderRow('Ekstra yükseklik', 'cropChartExtra', 0, 48, 1, c.heightExtra, 'px'),
      '</section>',
      '<section class="crop-section"><h3>Canlı alım / satım</h3>',
      sliderRow('Görünür yükseklik', 'cropTradesViewH', 200, 360, 2, t.viewH, 'px'),
      sliderRow('Iframe yükseklik', 'cropTradesIframeH', 700, 1200, 5, t.iframeH, 'px'),
      sliderRow('Iframe üst', 'cropTradesTop', -1100, -400, 5, t.iframeTop, 'negatif'),
      sliderRow('Sol (%)', 'cropTradesLeft', -12, 8, 1, t.left, ''),
      sliderRow('Genişlik (%)', 'cropTradesWidth', 98, 115, 1, t.width, ''),
      sliderRow('Üst maske', 'cropTradesMaskTop', 0, 80, 1, t.maskTop, 'px'),
      sliderRow('Alt maske', 'cropTradesMaskFoot', 0, 60, 1, t.maskFoot, 'px'),
      '</section>',
      `<${D} class="crop-actions">`,
      '<button type="button" class="crop-btn crop-btn-save" id="cropSaveBtn">Kaydet</button>',
      '<button type="button" class="crop-btn" id="cropCopyBtn">JSON kopyala</button>',
      '<button type="button" class="crop-btn crop-btn-muted" id="cropResetBtn">Sıfırla</button>',
      `</${D}>`,
      '<pre class="crop-json" id="cropJsonPreview"></pre>',
    ].join('');
    document.body.appendChild(panelEl);

    const onLive = () => {
      apply({ chart: current.chart, trades: current.trades, refViewport: getViewport() });
      refreshPreview();
    };

    [
      ['cropChartStageH', 'chart', 'stageH'],
      ['cropChartTop', 'chart', 'top'],
      ['cropChartLeft', 'chart', 'left'],
      ['cropChartWidth', 'chart', 'width'],
      ['cropChartExtra', 'chart', 'heightExtra'],
      ['cropTradesViewH', 'trades', 'viewH'],
      ['cropTradesIframeH', 'trades', 'iframeH'],
      ['cropTradesTop', 'trades', 'iframeTop'],
      ['cropTradesLeft', 'trades', 'left'],
      ['cropTradesWidth', 'trades', 'width'],
      ['cropTradesMaskTop', 'trades', 'maskTop'],
      ['cropTradesMaskFoot', 'trades', 'maskFoot'],
    ].forEach(([id, sec, key]) => bindSlider(id, sec, key, onLive));

    document.getElementById('cropCloseBtn')?.addEventListener('click', closePanel);
    document.getElementById('cropSaveBtn')?.addEventListener('click', () => {
      save({ chart: current.chart, trades: current.trades });
      closePanel();
      toast('Kaydedildi');
    });
    document.getElementById('cropResetBtn')?.addEventListener('click', () => {
      const d = reset();
      current = { chart: d.chart, trades: d.trades };
      syncSlidersFromCurrent();
      refreshPreview();
      toast('Varsayılan');
    });
    document.getElementById('cropCopyBtn')?.addEventListener('click', async () => {
      const text = JSON.stringify(
        { chart: current.chart, trades: current.trades, refViewport: getViewport() },
        null,
        2,
      );
      try {
        await navigator.clipboard.writeText(text);
        toast('JSON kopyalandı');
      } catch {
        toast('Alttaki JSON\'u kopyala');
      }
    });

    panelBuilt = true;
  }

  function toast(msg) {
    if (typeof global.showToast === 'function') {
      global.showToast(msg);
      return;
    }
    let el = document.getElementById('cropToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cropToast';
      el.className = 'crop-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function addCalibrateButton() {
    const head = document.querySelector('.trades-head');
    if (!head || head.querySelector('.btn-crop-cal')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-crop-cal';
    btn.textContent = 'Kırpma';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });
    head.appendChild(btn);
  }

  function init() {
    bindViewportListeners();
    apply();
    addCalibrateButton();
    if (isCalibrateMode()) {
      setTimeout(() => {
        addCalibrateButton();
        openPanel();
      }, 1500);
    }
    const vd = document.getElementById('view-detail');
    if (vd) {
      new MutationObserver(() => {
        if (!vd.classList.contains('hidden')) {
          addCalibrateButton();
          scheduleApply();
          setTimeout(scheduleApply, 350);
          setTimeout(scheduleApply, 900);
        }
      }).observe(vd, { attributes: true, attributeFilter: ['class'] });
    }
  }

  global.SniperDexCrop = {
    STORAGE_KEY,
    DEFAULTS,
    REF_VIEWPORT,
    load,
    loadRaw,
    save,
    reset,
    apply,
    scheduleApply,
    openPanel,
    closePanel,
    isCalibrateMode,
    getViewport,
    getAppHeight,
    computeEmbedBudget,
    adaptForLayout,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
