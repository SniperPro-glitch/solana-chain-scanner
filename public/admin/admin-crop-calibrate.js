/**
 * Admin — Dex kırpma kalibrasyonu (/admin/crop-calibrate)
 */
(function () {
  const API = '/api/admin/crop-profiles';
  const PROFILE_ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];
  const PROFILE_META = {
    web: { label: 'Web', w: 1200 },
    app11: { label: '11', w: 414 },
    app13: { label: '13', w: 390 },
    app13pm: { label: '13 PM', w: 428 },
    app16: { label: '16 PM', w: 430 },
  };

  const DEFAULT_BLOCK = {
    chart: {
      stageH: 330,
      top: 40,
      left: 1,
      width: 104,
      heightExtra: 0,
      brandCrop: 39,
      clipLeft: 0,
      clipRight: 0,
      clipTop: 0,
      clipBottom: 0,
      shiftDown: 0,
    },
    tape: { shiftDown: 0 },
    trades: {
      viewH: 302,
      iframeH: 845,
      iframeTop: -590,
      shiftDown: 0,
      left: 1,
      width: 98,
      maskTop: 0,
      maskFoot: 0,
      maskTopOn: true,
      maskFootOn: true,
      clipLeft: 0,
      clipRight: 0,
      clipTop: 0,
      clipBottom: 0,
    },
  };

  const SLIDER_MAP = [
    ['cropChartStageH', 'chart', 'stageH', 'Kutu yüksekliği', 240, 480, 2, 'px'],
    ['cropChartTop', 'chart', 'top', 'Üst kaydır', -180, 40, 1, 'px'],
    ['cropChartDown', 'chart', 'shiftDown', 'Aşağı kaydır', 0, 200, 1, 'px'],
    ['cropChartLeft', 'chart', 'left', 'Sol (%)', -16, 12, 1, '%'],
    ['cropChartWidth', 'chart', 'width', 'Genişlik (%)', 88, 120, 1, '%'],
    ['cropChartClipL', 'chart', 'clipLeft', 'Sol kırp', 0, 80, 1, 'px'],
    ['cropChartClipR', 'chart', 'clipRight', 'Sağ kırp', 0, 80, 1, 'px'],
    ['cropChartClipT', 'chart', 'clipTop', 'Üst daralt', 0, 100, 1, 'px'],
    ['cropChartClipB', 'chart', 'clipBottom', 'Alt daralt', 0, 100, 1, 'px'],
    ['cropChartBrand', 'chart', 'brandCrop', 'Üst marka kırp', 0, 64, 1, 'px'],
    ['cropChartExtra', 'chart', 'heightExtra', 'Ekstra yükseklik', 0, 48, 1, 'px'],
    ['cropTradesViewH', 'trades', 'viewH', 'Kutu yüksekliği', 160, 380, 2, 'px'],
    ['cropTradesIframeH', 'trades', 'iframeH', 'Iframe yükseklik', 700, 1200, 5, 'px'],
    ['cropTradesTop', 'trades', 'iframeTop', 'Iframe üst', -1400, -200, 5, 'px'],
    ['cropTradesDown', 'trades', 'shiftDown', 'Aşağı kaydır', 0, 250, 1, 'px'],
    ['cropTradesLeft', 'trades', 'left', 'Sol (%)', -16, 12, 1, '%'],
    ['cropTradesWidth', 'trades', 'width', 'Genişlik (%)', 88, 120, 1, '%'],
    ['cropTradesClipL', 'trades', 'clipLeft', 'Sol kırp', 0, 80, 1, 'px'],
    ['cropTradesClipR', 'trades', 'clipRight', 'Sağ kırp', 0, 80, 1, 'px'],
    ['cropTradesClipT', 'trades', 'clipTop', 'Üst daralt', 0, 100, 1, 'px'],
    ['cropTradesClipB', 'trades', 'clipBottom', 'Alt daralt', 0, 100, 1, 'px'],
    ['cropTradesMaskTop', 'trades', 'maskTop', 'Üst maske', 0, 80, 1, 'px'],
    ['cropTradesMaskFoot', 'trades', 'maskFoot', 'Alt maske', 0, 60, 1, 'px'],
    ['cropTapeDown', 'tape', 'shiftDown', 'Kutu kaydır', 0, 200, 1, 'px'],
  ];

  const TOGGLE_MAP = [
    ['cropTradesMaskTopOn', 'trades', 'maskTopOn', 'Üst maske açık'],
    ['cropTradesMaskFootOn', 'trades', 'maskFootOn', 'Alt maske açık'],
  ];

  let store = { version: 1, profiles: {} };
  let editing = 'web';
  let current = clone(DEFAULT_BLOCK);
  let previewW = PROFILE_META.web.w;

  const $ = (id) => document.getElementById(id);

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function mergeBlock(base, patch) {
    if (!patch) return clone(base);
    return {
      chart: { ...base.chart, ...(patch.chart || {}) },
      tape: { ...base.tape, ...(patch.tape || {}) },
      trades: { ...base.trades, ...(patch.trades || {}) },
    };
  }

  function setStatus(msg, kind) {
    const el = $('cropCalStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'crop-cal-status' + (kind ? ` ${kind}` : '');
  }

  function previewUrl() {
    const q = new URLSearchParams({
      adminPreview: '1',
      profil: editing,
    });
    return `/miniapp/crop-preview.html?${q}`;
  }

  function previewFrame() {
    return $('cropPreviewFrame');
  }

  function postPreview() {
    const fr = previewFrame();
    if (!fr?.contentWindow) return;
    fr.contentWindow.postMessage(
      { type: 'sniper-crop-preview', profileId: editing, block: clone(current) },
      '*',
    );
  }

  function setPreviewWidth(w) {
    previewW = w;
    const fr = previewFrame();
    if (fr) {
      fr.style.width = `${w}px`;
      fr.style.maxWidth = '100%';
    }
    document.querySelectorAll('.crop-width-chip').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.w) === w);
    });
    postPreview();
  }

  function buildControls() {
    const root = $('cropCalControls');
    if (!root || root.dataset.built === '1') return;

    const tabs = document.createElement('div');
    tabs.className = 'crop-profile-tabs';
    tabs.id = 'cropProfileTabs';
    PROFILE_ORDER.forEach((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crop-profile-tab';
      btn.dataset.profile = id;
      btn.textContent = PROFILE_META[id].label;
      btn.addEventListener('click', () => switchProfile(id));
      tabs.appendChild(btn);
    });
    root.appendChild(tabs);

    const chartSec = document.createElement('section');
    chartSec.className = 'crop-section';
    chartSec.innerHTML = '<h3>Grafik (Dex embed)</h3>';
    const tradesSec = document.createElement('section');
    tradesSec.className = 'crop-section';
    tradesSec.innerHTML = '<h3>Alım / satım</h3>';
    const tapeSec = document.createElement('section');
    tapeSec.className = 'crop-section';
    tapeSec.innerHTML = '<h3>Kutu konumu</h3>';

    SLIDER_MAP.forEach(([id, sec, key, label, min, max, step]) => {
      const val = current[sec][key];
      const row = document.createElement('label');
      row.className = 'crop-row';
      row.htmlFor = id;
      row.innerHTML = `<span class="crop-lbl">${label} <output id="${id}Out" class="crop-val">${val}</output></span>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" />`;
      const target = sec === 'tape' ? tapeSec : sec === 'trades' ? tradesSec : chartSec;
      target.appendChild(row);
    });

    TOGGLE_MAP.forEach(([id, sec, key, label]) => {
      const row = document.createElement('label');
      row.className = 'crop-toggle';
      row.htmlFor = id;
      const checked = current[sec][key] !== false;
      row.innerHTML = `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''} /><span>${label}</span>`;
      tradesSec.appendChild(row);
    });

    root.appendChild(chartSec);
    root.appendChild(tradesSec);
    root.appendChild(tapeSec);

    SLIDER_MAP.forEach(([id, sec, key]) => {
      const input = document.getElementById(id);
      const out = document.getElementById(`${id}Out`);
      if (!input) return;
      const handler = () => {
        current[sec][key] = Number(input.value);
        if (out) out.textContent = String(current[sec][key]);
        postPreview();
        refreshJson();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    TOGGLE_MAP.forEach(([id, sec, key]) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('change', () => {
        current[sec][key] = input.checked;
        postPreview();
        refreshJson();
      });
    });

    root.dataset.built = '1';
  }

  function syncSliders() {
    SLIDER_MAP.forEach(([id, sec, key]) => {
      const el = document.getElementById(id);
      const out = document.getElementById(`${id}Out`);
      const val = current[sec][key];
      if (el) el.value = String(val);
      if (out) out.textContent = String(val);
    });
    TOGGLE_MAP.forEach(([id, sec, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = current[sec][key] !== false;
    });
    document.querySelectorAll('.crop-profile-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.profile === editing);
    });
  }

  function refreshJson() {
    const pre = $('cropJsonPreview');
    if (!pre) return;
    const preview = { editing, block: current };
    pre.textContent = JSON.stringify(preview, null, 2);
  }

  function switchProfile(nextId) {
    if (!PROFILE_META[nextId] || nextId === editing) return;
    store.profiles[editing] = clone(current);
    editing = nextId;
    current = mergeBlock(DEFAULT_BLOCK, store.profiles[editing] || DEFAULT_BLOCK);
    syncSliders();
    setPreviewWidth(PROFILE_META[editing].w);
    const fr = previewFrame();
    if (fr) fr.src = previewUrl();
    refreshJson();
  }

  async function load() {
    setStatus('Yükleniyor…');
    try {
      const data = await window.SniperAdminApi(API);
      store = {
        version: data.version || 1,
        updatedAt: data.updatedAt,
        profiles: data.profiles || {},
      };
      PROFILE_ORDER.forEach((id) => {
        if (!store.profiles[id]) store.profiles[id] = clone(DEFAULT_BLOCK);
        else store.profiles[id] = mergeBlock(DEFAULT_BLOCK, store.profiles[id]);
      });
      editing = 'web';
      current = clone(store.profiles.web);
      buildControls();
      syncSliders();
      const fr = previewFrame();
      if (fr) {
        fr.src = previewUrl();
        fr.onload = () => postPreview();
      }
      setPreviewWidth(PROFILE_META.web.w);
      refreshJson();
      setStatus('Profiller yüklendi.', 'ok');
    } catch (e) {
      if (e.status === 404) {
        PROFILE_ORDER.forEach((id) => {
          store.profiles[id] = clone(DEFAULT_BLOCK);
        });
        editing = 'web';
        current = clone(DEFAULT_BLOCK);
        buildControls();
        syncSliders();
        setStatus('Sunucuda profil yok — varsayılanlarla başladınız. Kaydet ile oluşturun.', 'err');
        refreshJson();
        return;
      }
      setStatus(e.message || 'Yükleme hatası', 'err');
    }
  }

  async function saveAll() {
    store.profiles[editing] = clone(current);
    setStatus('Kaydediliyor…');
    try {
      const body = await window.SniperAdminApi(API, {
        method: 'POST',
        body: JSON.stringify({ version: 1, profiles: store.profiles }),
      });
      if (body.saved) {
        store = body.saved;
        store.profiles = store.profiles || {};
      }
      setStatus('5 profil sunucuya kaydedildi (json + baked.js).', 'ok');
      refreshJson();
    } catch (e) {
      setStatus(e.message || 'Kayıt başarısız', 'err');
    }
  }

  function saveCurrentProfile() {
    store.profiles[editing] = clone(current);
    setStatus(`${PROFILE_META[editing].label} bellekte güncellendi — Sunucuya sabitle ile kalıcı olur.`, 'ok');
    refreshJson();
  }

  function bind() {
    $('cropCalSave')?.addEventListener('click', saveCurrentProfile);
    $('cropCalPublish')?.addEventListener('click', saveAll);
    $('cropCalReload')?.addEventListener('click', load);

    document.querySelectorAll('.crop-width-chip').forEach((btn) => {
      btn.addEventListener('click', () => setPreviewWidth(Number(btn.dataset.w)));
    });

    document.addEventListener('sniper-admin-ready', () => load());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
