/**
 * DexScreener grafik + işlem kırpma — manuel kalibrasyon.
 * Aç: ?kalibre=1 veya "Kırpma" butonu.
 */
(function (global) {
  const STORAGE_KEY = 'sniperDexCropV1';
  const D = 'di' + 'v';

  const DEFAULTS = {
    chart: {
      stageH: 340,
      top: -8,
      left: -4,
      width: 108,
      heightExtra: 20,
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

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        chart: { ...DEFAULTS.chart, ...parsed.chart },
        trades: { ...DEFAULTS.trades, ...parsed.trades },
      };
    } catch {
      return clone(DEFAULTS);
    }
  }

  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    apply(settings);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    const d = clone(DEFAULTS);
    apply(d);
    return d;
  }

  /** CSS değişkeni + doğrudan element style (Telegram / iframe için şart). */
  function apply(settings) {
    const s = settings || load();
    const root = document.documentElement;
    const c = s.chart;
    const t = s.trades;

    root.style.setProperty('--chart-embed-h', `${c.stageH}px`);
    root.style.setProperty('--chart-embed-top', `${c.top}px`);
    root.style.setProperty('--chart-embed-left', `${c.left}%`);
    root.style.setProperty('--chart-embed-width', `${c.width}%`);
    root.style.setProperty('--chart-embed-extra', `${c.heightExtra}px`);

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
      chartIframe.style.top = `${c.top}px`;
      chartIframe.style.left = `${c.left}%`;
      chartIframe.style.width = `${c.width}%`;
      chartIframe.style.height = `${c.stageH + c.heightExtra}px`;
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
  let current = clone(DEFAULTS);
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
    current = load();
    syncSlidersFromCurrent();
    apply(current);
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
    if (pre && current) pre.textContent = JSON.stringify(current, null, 2);
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
      '<p class="crop-intro">Kaydırıcıyı oynat — altta anında değişir. <b>Kaydet</b> ile kalıcı olur.</p>',
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
      sliderRow('Iframe üst', 'cropTradesTop', -1100, -400, 5, t.iframeTop, 'negatif = tablo'),
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
      apply(current);
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
      save(current);
      toast('Kaydedildi');
    });
    document.getElementById('cropResetBtn')?.addEventListener('click', () => {
      current = reset();
      syncSlidersFromCurrent();
      apply(current);
      refreshPreview();
      toast('Sıfırlandı');
    });
    document.getElementById('cropCopyBtn')?.addEventListener('click', async () => {
      const text = JSON.stringify(current, null, 2);
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
    apply(load());
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
          apply(load());
        }
      }).observe(vd, { attributes: true, attributeFilter: ['class'] });
    }
  }

  global.SniperDexCrop = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
    reset,
    apply,
    openPanel,
    closePanel,
    isCalibrateMode,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
