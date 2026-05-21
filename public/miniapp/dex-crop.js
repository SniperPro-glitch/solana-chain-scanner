/**
 * DexScreener k─▒rpma ÔÇö 5 profil: Web, iPhone 11, 13, 13 Pro Max, 16 Pro Max
 * ?kalibre=1 veya "K─▒rpma" butonu
 */
(function (global) {
  const STORAGE_KEY = 'sniperDexCropV4';
  const LEGACY_KEYS = ['sniperDexCropV3', 'sniperDexCropV2', 'sniperDexCropV1'];
  let serverBaked = null;
  let profilesReady = null;
  const CHART_BRAND_CROP = 40;
  const D = 'di' + 'v';

  const PROFILE_META = {
    web: { label: 'Web', hint: 'Taray─▒c─▒ / masa├╝st├╝' },
    app11: { label: '11', hint: 'iPhone 11 / XR (~414px)' },
    app13: { label: '13', hint: 'iPhone 13 / 14 / 15 (~390px)' },
    app13pm: { label: '13 PM', hint: 'iPhone 13 Pro Max (~428px)' },
    app16: { label: '16 PM', hint: 'iPhone 16 Pro Max (~430px)' },
  };

  const PROFILE_ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];

  const DEFAULT_BLOCK = {
    chart: {
      stageH: 340,
      top: -8,
      left: -4,
      width: 108,
      heightExtra: 20,
      brandCrop: CHART_BRAND_CROP,
      clipLeft: 0,
      clipRight: 0,
      clipTop: 0,
      clipBottom: 0,
      shiftDown: 0,
    },
    /** Canl─▒ al─▒m/sat─▒m kutusu (#tradesTape) ÔÇö Dex iframe de─şil */
    tape: {
      shiftDown: 0,
    },
    trades: {
      viewH: 268,
      iframeH: 980,
      iframeTop: -820,
      shiftDown: 0,
      left: -3,
      width: 106,
      maskTop: 8,
      maskFoot: 24,
      maskTopOn: true,
      maskFootOn: true,
      clipLeft: 0,
      clipRight: 0,
      clipTop: 0,
      clipBottom: 0,
    },
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function defaultBlock() {
    return clone(DEFAULT_BLOCK);
  }

  function profileLooksCustom(block) {
    if (!block?.chart) return false;
    const c = block.chart;
    const t = block.trades || {};
    return (
      c.top !== -8
      || c.stageH !== 340
      || t.iframeTop !== -820
      || t.viewH !== 268
      || (block.tape?.shiftDown || 0) !== 0
    );
  }

  function activeProfileId() {
    if (global.SniperCropProfile?.apply) return global.SniperCropProfile.apply();
    const ds = document.documentElement.dataset.dexCropProfile;
    if (PROFILE_META[ds]) return ds;
    return detectProfile();
  }

  /** Koddaki ├Âl├ğ├╝ler + sunucudaki g├╝ncel profiller birle┼şir (bo┼ş sunucu varsay─▒lan─▒ ezmez). */
  function getBakedSource() {
    const file = globalThis.__DEX_CROP_BAKED__;
    if (!isCalibrateMode()) return file?.profiles ? file : null;
    const server = serverBaked;
    if (!file?.profiles) return server || null;
    if (!server?.profiles) return file;
    const profiles = {};
    PROFILE_ORDER.forEach((id) => {
      const s = server.profiles[id];
      const f = file.profiles[id];
      const sOk = profileLooksCustom(s);
      const fOk = profileLooksCustom(f);
      if (sOk && !fOk) profiles[id] = s;
      else if (fOk) profiles[id] = f;
      else profiles[id] = f || s;
    });
    return {
      version: 1,
      updatedAt: server.updatedAt || file.updatedAt,
      profiles,
    };
  }

  function defaultStore() {
    const baked = getBakedSource();
    const profiles = {};
    PROFILE_ORDER.forEach((id) => {
      if (baked?.profiles?.[id]) {
        profiles[id] = normalizeBlock(baked.profiles[id]);
      } else {
        profiles[id] = defaultBlock();
      }
    });
    return { profiles, version: baked?.version || 1, updatedAt: baked?.updatedAt || null };
  }

  async function fetchServerBaked() {
    if (!isCalibrateMode()) return null;
    try {
      const r = await fetch(`/api/crop-profiles?v=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        serverBaked = await r.json();
        return serverBaked;
      }
    } catch {
      /* yoksay */
    }
    return null;
  }

  async function publishServerProfiles() {
    const store = loadStore();
    store.profiles[editingProfile] = clone(current);
    const r = await fetch('/api/crop-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, profiles: store.profiles }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || data.error || `HTTP ${r.status}`);
    serverBaked = data.saved || { version: 1, profiles: store.profiles };
    return serverBaked;
  }

  function isTelegram() {
    return !!global.Telegram?.WebApp?.initData || document.documentElement.classList.contains('tg-mini-app');
  }

  function detectProfile() {
    if (global.SniperCropProfile?.detect) return global.SniperCropProfile.detect();
    if (!isTelegram()) return 'web';
    const w = global.SniperCropProfile?.layoutWidth?.() || window.innerWidth || 390;
    if (w >= 429) return 'app16';
    if (w >= 426) return 'app13pm';
    if (w >= 400) return 'app11';
    return 'app13';
  }

  function normalizeBlock(patch) {
    return mergeBlock(DEFAULT_BLOCK, patch);
  }

  function mergeBlock(base, patch) {
    if (!patch) return clone(base);
    return {
      chart: { ...base.chart, ...patch.chart },
      tape: { ...base.tape, ...patch.tape },
      trades: { ...base.trades, ...patch.trades },
    };
  }

  function migrateLegacy() {
    for (const key of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        localStorage.removeItem(key);
        if (parsed.refViewport) continue;
        const store = defaultStore();
        const block = normalizeBlock({
          chart: parsed.chart,
          tape: parsed.tape,
          trades: parsed.trades,
        });
        if (parsed.profiles) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          return;
        }
        PROFILE_ORDER.forEach((id) => {
          store.profiles[id] = clone(block);
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        return;
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  /** ├ûnce kod/sunucu varsay─▒lan─▒; senin kaydetti─şin profil varsa localStorage kazan─▒r. */
  function loadStore() {
    migrateLegacy();
    const store = defaultStore();
    if (!isCalibrateMode()) return store;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return store;
      const parsed = JSON.parse(raw);
      if (!parsed?.profiles) return store;
      for (const id of PROFILE_ORDER) {
        if (parsed.profiles[id]) {
          store.profiles[id] = normalizeBlock(parsed.profiles[id]);
        }
      }
      return store;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return store;
    }
  }

  let syncServerTimer = null;

  /** Sadece bu cihazda kaydedilmi┼ş profiller ÔÇö sunucuda di─şer cihazlar─▒n ├Âl├ğ├╝s├╝n├╝ silmez. */
  function profilesFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.profiles) return null;
      const partial = {};
      for (const id of PROFILE_ORDER) {
        if (parsed.profiles[id]) partial[id] = normalizeBlock(parsed.profiles[id]);
      }
      return Object.keys(partial).length ? partial : null;
    } catch {
      return null;
    }
  }

  function syncProfilesToServer() {
    const partial = profilesFromLocalStorage();
    if (!partial) return Promise.resolve(null);
    clearTimeout(syncServerTimer);
    return new Promise((resolve) => {
      syncServerTimer = setTimeout(() => {
        fetch('/api/crop-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, profiles: partial }),
        })
          .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
          .then(resolve)
          .catch(() => resolve(null));
      }, 300);
    });
  }

  /** A├ğ─▒l─▒┼şta kay─▒tl─▒ profilleri belle─şe al ve sunucuya g├Ânder. */
  function absorbLocalStorageToBaked() {
    if (!isCalibrateMode()) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.profiles) return false;
      const base = loadStore();
      let any = false;
      PROFILE_ORDER.forEach((id) => {
        if (parsed.profiles[id]) any = true;
      });
      if (!any) return false;
      serverBaked = {
        version: 1,
        updatedAt: new Date().toISOString(),
        profiles: base.profiles,
      };
      globalThis.__DEX_CROP_BAKED__ = serverBaked;
      syncProfilesToServer(serverBaked);
      return true;
    } catch {
      return false;
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function loadForProfile(profileId) {
    const store = loadStore();
    return clone(normalizeBlock(store.profiles[profileId] || store.profiles.web));
  }

  function load() {
    return loadForProfile(activeProfileId());
  }

  function saveBlock(profileId, block) {
    let lsStore = { profiles: {} };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profiles) lsStore = parsed;
      }
    } catch {
      /* yoksay */
    }
    lsStore.profiles[profileId] = clone(block);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lsStore));

    const store = loadStore();
    serverBaked = { version: 1, updatedAt: new Date().toISOString(), profiles: store.profiles };
    globalThis.__DEX_CROP_BAKED__ = serverBaked;
    syncProfilesToServer(store);

    if (profileId === activeProfileId()) apply(block);
  }

  function resetProfile(profileId) {
    const store = loadStore();
    store.profiles[profileId] = defaultBlock();
    saveStore(store);
    return clone(store.profiles[profileId]);
  }

  function reset() {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(STORAGE_KEY);
    const d = load();
    apply(d);
    return d;
  }

  function applyClip(el, left, right, top, bottom) {
    if (!el) return;
    const l = Math.max(0, Number(left) || 0);
    const r = Math.max(0, Number(right) || 0);
    const tp = Math.max(0, Number(top) || 0);
    const bt = Math.max(0, Number(bottom) || 0);
    if (l === 0 && r === 0 && tp === 0 && bt === 0) {
      el.style.clipPath = '';
      return;
    }
    el.style.clipPath = `inset(${tp}px ${r}px ${bt}px ${l}px)`;
  }

  function applyMaskEl(el, enabled, heightPx) {
    if (!el) return;
    if (enabled === false) {
      el.style.display = 'none';
      el.style.height = '0';
      return;
    }
    el.style.display = 'block';
    el.style.height = `${Math.max(0, Number(heightPx) || 0)}px`;
  }

  function apply(settings) {
    const profileId = activeProfileId();
    document.documentElement.dataset.dexCropProfile = profileId;
    const s = settings || loadForProfile(profileId);
    const root = document.documentElement;
    const c = s.chart;
    const t = s.trades;
    const brandCrop = Number(c.brandCrop) || CHART_BRAND_CROP;
    const chartDown = Number(c.shiftDown) || 0;
    const tapeDown = Number(s.tape?.shiftDown) || 0;
    const tradesDown = Number(t.shiftDown) || 0;

    root.style.setProperty('--chart-embed-h', `${c.stageH}px`);
    root.style.setProperty('--chart-embed-top', `${c.top}px`);
    root.style.setProperty('--chart-shift-down', `${chartDown}px`);
    root.style.setProperty('--chart-embed-left', `${c.left}%`);
    root.style.setProperty('--chart-embed-width', `${c.width}%`);
    root.style.setProperty('--chart-embed-extra', `${c.heightExtra}px`);
    root.style.setProperty('--chart-brand-crop', `${brandCrop}px`);
    root.style.setProperty('--chart-clip-left', `${c.clipLeft || 0}px`);
    root.style.setProperty('--chart-clip-right', `${c.clipRight || 0}px`);

    root.style.setProperty('--dex-trades-view-h', `${t.viewH}px`);
    root.style.setProperty('--dex-iframe-h', `${t.iframeH}px`);
    root.style.setProperty('--dex-iframe-top', `${t.iframeTop}px`);
    root.style.setProperty('--dex-trades-shift-down', `${tradesDown}px`);
    root.style.setProperty('--tape-shift-down', `${tapeDown}px`);
    root.style.setProperty('--dex-iframe-left', `${t.left}%`);
    root.style.setProperty('--dex-iframe-width', `${t.width}%`);
    root.style.setProperty('--dex-mask-top-h', `${t.maskTop}px`);
    root.style.setProperty('--dex-mask-foot-h', `${t.maskFoot}px`);
    root.style.setProperty('--dex-trades-clip-left', `${t.clipLeft || 0}px`);
    root.style.setProperty('--dex-trades-clip-right', `${t.clipRight || 0}px`);

    const tapeEl = document.getElementById('tradesTape');
    if (tapeEl) {
      tapeEl.style.marginTop = `${tapeDown}px`;
    }

    const stage = document.querySelector('.chart-terminal--dex-embed .chart-stage');
    const chartIframe = document.querySelector('iframe.dex-embed-chart');
    if (stage) {
      stage.style.height = `${c.stageH}px`;
      stage.style.minHeight = `${c.stageH}px`;
      stage.style.maxHeight = `${c.stageH}px`;
      applyClip(stage, c.clipLeft, c.clipRight, c.clipTop, c.clipBottom);
    }
    if (chartIframe) {
      chartIframe.style.position = 'absolute';
      chartIframe.style.top = `${c.top - brandCrop + chartDown}px`;
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
      applyClip(wrap, t.clipLeft, t.clipRight, t.clipTop, t.clipBottom);
      const maskTopOn = t.maskTopOn !== false;
      const maskFootOn = t.maskFootOn !== false;
      wrap.classList.toggle('dex-masks-off', !maskTopOn && !maskFootOn);
      wrap.classList.toggle('dex-mask-top-off', !maskTopOn);
      wrap.classList.toggle('dex-mask-foot-off', !maskFootOn);
    }
    if (tradesIframe) {
      const topPx = t.iframeTop + tradesDown;
      tradesIframe.style.cssText = [
        'position:absolute',
        `top:${topPx}px`,
        `left:${t.left}%`,
        `width:${t.width}%`,
        `height:${t.iframeH}px`,
        'max-width:none',
        'border:0',
        'display:block',
        'margin:0',
        'pointer-events:auto',
      ].join(';');
    }
    applyMaskEl(maskTop, t.maskTopOn !== false, t.maskTop);
    applyMaskEl(maskFoot, t.maskFootOn !== false, t.maskFoot);
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

  /** ?profil=web|app11|app13|app13pm|app16 ÔÇö link sadece do─şru sekmeyi a├ğar; ├Âl├ğ├╝ler kay─▒tta. */
  function profileFromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const id = String(q.get('profil') || q.get('profile') || '').trim();
      if (PROFILE_META[id]) return id;
    } catch {
      /* yoksay */
    }
    return null;
  }

  function sliderRow(label, id, min, max, step, value, hint) {
    return `<label class="crop-row" for="${id}">
      <span class="crop-lbl">${label} <output id="${id}Out" class="crop-val">${value}</output></span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      ${hint ? `<span class="crop-hint">${hint}</span>` : ''}
    </label>`;
  }

  function toggleRow(label, id, checked) {
    return `<label class="crop-toggle" for="${id}">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>`;
  }

  let panelEl = null;
  let current = defaultBlock();
  let editingProfile = 'web';
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

  function bindToggle(id, section, key, onChange) {
    const input = document.getElementById(id);
    if (!input) return;
    const handler = () => {
      if (!current?.[section]) return;
      current[section][key] = input.checked;
      onChange();
    };
    input.addEventListener('change', handler);
  }

  const SLIDER_MAP = [
    ['cropChartStageH', 'chart', 'stageH'],
    ['cropChartTop', 'chart', 'top'],
    ['cropChartDown', 'chart', 'shiftDown'],
    ['cropChartLeft', 'chart', 'left'],
    ['cropChartWidth', 'chart', 'width'],
    ['cropChartClipL', 'chart', 'clipLeft'],
    ['cropChartClipR', 'chart', 'clipRight'],
    ['cropChartClipT', 'chart', 'clipTop'],
    ['cropChartClipB', 'chart', 'clipBottom'],
    ['cropChartExtra', 'chart', 'heightExtra'],
    ['cropChartBrand', 'chart', 'brandCrop'],
    ['cropTradesViewH', 'trades', 'viewH'],
    ['cropTradesIframeH', 'trades', 'iframeH'],
    ['cropTradesTop', 'trades', 'iframeTop'],
    ['cropTradesDown', 'trades', 'shiftDown'],
    ['cropTapeDown', 'tape', 'shiftDown'],
    ['cropTradesLeft', 'trades', 'left'],
    ['cropTradesWidth', 'trades', 'width'],
    ['cropTradesClipL', 'trades', 'clipLeft'],
    ['cropTradesClipR', 'trades', 'clipRight'],
    ['cropTradesClipT', 'trades', 'clipTop'],
    ['cropTradesClipB', 'trades', 'clipBottom'],
    ['cropTradesMaskTop', 'trades', 'maskTop'],
    ['cropTradesMaskFoot', 'trades', 'maskFoot'],
  ];

  const TOGGLE_MAP = [
    ['cropTradesMaskTopOn', 'trades', 'maskTopOn'],
    ['cropTradesMaskFootOn', 'trades', 'maskFootOn'],
  ];

  function syncSlidersFromCurrent() {
    if (!current) return;
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
  }

  function updateProfileTabs() {
    panelEl?.querySelectorAll('[data-crop-profile]').forEach((btn) => {
      const active = btn.getAttribute('data-crop-profile') === editingProfile;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const hint = document.getElementById('cropProfileHint');
    if (hint) hint.textContent = PROFILE_META[editingProfile]?.hint || '';
    const det = document.getElementById('cropDetectLabel');
    if (det) {
      const auto = detectProfile();
      det.textContent = `Otomatik: ${PROFILE_META[auto]?.label || auto} (${window.innerWidth}├ù${window.innerHeight})`;
    }
  }

  function switchProfile(nextId) {
    if (!PROFILE_META[nextId] || nextId === editingProfile) return;
    saveBlock(editingProfile, current);
    editingProfile = nextId;
    current = loadForProfile(editingProfile);
    syncSlidersFromCurrent();
    apply(current);
    updateProfileTabs();
    refreshPreview();
  }

  function copyProfileFrom(sourceId) {
    if (!PROFILE_META[sourceId]) return;
    current = loadForProfile(sourceId);
    syncSlidersFromCurrent();
    apply(current);
    refreshPreview();
    toast(`${PROFILE_META[sourceId].label} ÔåÆ ${PROFILE_META[editingProfile].label} kopyaland─▒ (Kaydet)`);
  }

  function openPanel() {
    if (!panelBuilt) buildPanel();
    editingProfile = profileFromUrl() || detectProfile();
    current = loadForProfile(editingProfile);
    syncSlidersFromCurrent();
    apply(current);
    updateProfileTabs();
    panelEl.classList.remove('hidden');
    document.documentElement.classList.add('crop-panel-open');
    refreshPreview();
  }

  function closePanel() {
    panelEl?.classList.add('hidden');
    document.documentElement.classList.remove('crop-panel-open');
    apply(load());
  }

  function refreshPreview() {
    const pre = document.getElementById('cropJsonPreview');
    if (!pre) return;
    const store = loadStore();
    store.profiles[editingProfile] = clone(current);
    pre.textContent = JSON.stringify(
      { activeProfile: detectProfile(), editingProfile, profiles: store.profiles },
      null,
      2,
    );
  }

  function buildPanel() {
    const c = DEFAULT_BLOCK.chart;
    const tp = DEFAULT_BLOCK.tape;
    const t = DEFAULT_BLOCK.trades;
    panelEl = document.createElement('aside');
    panelEl.id = 'dexCropPanel';
    panelEl.className = 'dex-crop-panel hidden';
    panelEl.innerHTML = [
      '<header class="dex-crop-head"><strong>K─▒rpma ÔÇö 5 ekran</strong>',
      '<button type="button" class="crop-close" id="cropCloseBtn" aria-label="Kapat">Ô£ò</button></header>',
      '<p class="crop-intro">Link sadece paneli a├ğar. <b>Profili kaydet</b> = ├Âl├ğ├╝ler kal─▒r + herkese sunucuya gider.</p>',
      '<p class="crop-detect" id="cropDetectLabel"></p>',
      '<div class="crop-profile-tabs" role="tablist">',
      ...PROFILE_ORDER.map(
        (id) =>
          `<button type="button" class="crop-profile-tab" data-crop-profile="${id}" role="tab">${PROFILE_META[id].label}</button>`,
      ),
      `</${D}>`,
      '<p class="crop-profile-hint" id="cropProfileHint"></p>',
      '<section class="crop-section"><h3>Grafik (Dex embed)</h3>',
      sliderRow('Kutu y├╝ksekli─şi', 'cropChartStageH', 240, 480, 2, c.stageH, 'px'),
      sliderRow('├£st kayd─▒r', 'cropChartTop', -180, 40, 1, c.top, 'px ÔÇö negatif = yukar─▒'),
      sliderRow('A┼şa─ş─▒ kayd─▒r', 'cropChartDown', 0, 200, 1, c.shiftDown, 'px ÔÇö grafik i├ğeri─şi a┼şa─ş─▒'),
      sliderRow('Sol kayd─▒r (%)', 'cropChartLeft', -16, 12, 1, c.left, 'grafik konumu'),
      sliderRow('Geni┼şlik (%)', 'cropChartWidth', 88, 120, 1, c.width, 'daralt / geni┼şlet'),
      sliderRow('Sol kenar k─▒rp', 'cropChartClipL', 0, 80, 1, c.clipLeft, 'px'),
      sliderRow('Sa─ş kenar k─▒rp', 'cropChartClipR', 0, 80, 1, c.clipRight, 'px'),
      sliderRow('Yukar─▒ daralt', 'cropChartClipT', 0, 100, 1, c.clipTop, 'px ÔÇö panel ├╝stten kes'),
      sliderRow('A┼şa─ş─▒ daralt', 'cropChartClipB', 0, 100, 1, c.clipBottom, 'px ÔÇö panel alttan kes'),
      sliderRow('├£st marka k─▒rp', 'cropChartBrand', 0, 64, 1, c.brandCrop, 'dexscreener ┼şeridi'),
      sliderRow('Ekstra y├╝kseklik', 'cropChartExtra', 0, 48, 1, c.heightExtra, 'px'),
      '</section>',
      '<section class="crop-section crop-section--tape"><h3>Al─▒m / sat─▒m panosu</h3>',
      '<p class="crop-section-note">LIVE kutusu i├ği ÔÇö t├╝m telefonlarda ayn─▒ kayd─▒r─▒c─▒lar.</p>',
      sliderRow('G├Âr├╝n├╝r y├╝kseklik', 'cropTradesViewH', 160, 380, 2, t.viewH, 'px ÔÇö kutu y├╝ksekli─şi'),
      sliderRow('Iframe y├╝kseklik', 'cropTradesIframeH', 700, 1200, 5, t.iframeH, 'px'),
      sliderRow('Iframe ├╝st', 'cropTradesTop', -1200, -300, 5, t.iframeTop, 'negatif = yukar─▒ ├ğek'),
      sliderRow('A┼şa─ş─▒ kayd─▒r', 'cropTradesDown', 0, 250, 1, t.shiftDown, 'px ÔÇö tablo i├ğeri─şi a┼şa─ş─▒'),
      sliderRow('Sol kayd─▒r (%)', 'cropTradesLeft', -16, 12, 1, t.left, ''),
      sliderRow('Geni┼şlik (%)', 'cropTradesWidth', 88, 120, 1, t.width, ''),
      sliderRow('Sol kenar k─▒rp', 'cropTradesClipL', 0, 80, 1, t.clipLeft, 'px'),
      sliderRow('Sa─ş kenar k─▒rp', 'cropTradesClipR', 0, 80, 1, t.clipRight, 'px'),
      sliderRow('Yukar─▒ daralt', 'cropTradesClipT', 0, 100, 1, t.clipTop, 'px ÔÇö panel ├╝stten kes'),
      sliderRow('A┼şa─ş─▒ daralt', 'cropTradesClipB', 0, 100, 1, t.clipBottom, 'px ÔÇö panel alttan kes'),
      toggleRow('├£st maske a├ğ─▒k', 'cropTradesMaskTopOn', t.maskTopOn !== false),
      sliderRow('├£st maske kal─▒nl─▒k', 'cropTradesMaskTop', 0, 80, 1, t.maskTop, 'px (kapal─▒ysa yok say─▒l─▒r)'),
      toggleRow('Alt maske a├ğ─▒k', 'cropTradesMaskFootOn', t.maskFootOn !== false),
      sliderRow('Alt maske kal─▒nl─▒k', 'cropTradesMaskFoot', 0, 60, 1, t.maskFoot, 'px (kapal─▒ysa yok say─▒l─▒r)'),
      '</section>',
      '<section class="crop-section crop-section--dex"><h3>Kutu sayfada (iste─şe ba─şl─▒)</h3>',
      '<p class="crop-section-note">T├╝m LIVE kutusunu grafik alt─▒nda yukar─▒/a┼şa─ş─▒ kayd─▒r─▒r.</p>',
      sliderRow('Kutu a┼şa─ş─▒ kayd─▒r', 'cropTapeDown', 0, 200, 1, tp.shiftDown, 'px'),
      '</section>',
      `<${D} class="crop-actions">`,
      '<button type="button" class="crop-btn crop-btn-save" id="cropSaveBtn">Profili kaydet</button>',
      '<button type="button" class="crop-btn crop-btn-publish" id="cropPublishBtn">Ôİü Herkese sabitle (5 profil)</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopyWebBtn">Web ÔåÆ</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopy13pmBtn">13 PM ÔåÆ</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopy16pmBtn">16 PM ÔåÆ</button>',
      '<button type="button" class="crop-btn" id="cropCopyBtn">T├╝m JSON</button>',
      '<button type="button" class="crop-btn crop-btn-muted" id="cropResetProfBtn">Profil s─▒f─▒r</button>',
      '<button type="button" class="crop-btn crop-btn-muted" id="cropResetAllBtn">Hepsi s─▒f─▒r</button>',
      `</${D}>`,
      '<pre class="crop-json" id="cropJsonPreview"></pre>',
    ].join('');
    document.body.appendChild(panelEl);

    const onLive = () => {
      apply(current);
      refreshPreview();
    };

    SLIDER_MAP.forEach(([id, sec, key]) => bindSlider(id, sec, key, onLive));
    TOGGLE_MAP.forEach(([id, sec, key]) => bindToggle(id, sec, key, onLive));

    panelEl.querySelectorAll('[data-crop-profile]').forEach((btn) => {
      btn.addEventListener('click', () => switchProfile(btn.getAttribute('data-crop-profile')));
    });

    document.getElementById('cropCloseBtn')?.addEventListener('click', closePanel);
    document.getElementById('cropSaveBtn')?.addEventListener('click', () => {
      saveBlock(editingProfile, current);
      toast(`${PROFILE_META[editingProfile].label} kaydedildi`);
    });
    document.getElementById('cropPublishBtn')?.addEventListener('click', async () => {
      try {
        const store = loadStore();
        store.profiles[editingProfile] = clone(current);
        saveStore(store);
        await publishServerProfiles();
        toast('5 profil sunucuya sabitlendi ÔÇö herkes g├Âr├╝r');
      } catch (e) {
        toast(e.message || 'Sunucuya kay─▒t ba┼şar─▒s─▒z');
      }
    });
    document.getElementById('cropCopyWebBtn')?.addEventListener('click', () => copyProfileFrom('web'));
    document.getElementById('cropCopy13pmBtn')?.addEventListener('click', () => copyProfileFrom('app13pm'));
    document.getElementById('cropCopy16pmBtn')?.addEventListener('click', () => copyProfileFrom('app16'));
    document.getElementById('cropResetProfBtn')?.addEventListener('click', () => {
      current = resetProfile(editingProfile);
      syncSlidersFromCurrent();
      apply(current);
      refreshPreview();
      toast('Bu profil s─▒f─▒rland─▒');
    });
    document.getElementById('cropResetAllBtn')?.addEventListener('click', () => {
      current = reset();
      editingProfile = detectProfile();
      current = loadForProfile(editingProfile);
      syncSlidersFromCurrent();
      updateProfileTabs();
      refreshPreview();
      toast('5 profil s─▒f─▒rland─▒');
    });
    document.getElementById('cropCopyBtn')?.addEventListener('click', async () => {
      const store = loadStore();
      store.profiles[editingProfile] = clone(current);
      const text = JSON.stringify(store, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        toast('5 profil JSON kopyaland─▒');
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
    btn.textContent = 'K─▒rpma';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });
    head.appendChild(btn);
  }

  function ensureProfilesReady() {
    if (!profilesReady) {
      profilesReady = (async () => {
        await fetchServerBaked();
        absorbLocalStorageToBaked();
      })();
    }
    return profilesReady;
  }

  async function applyAsync(settings) {
    await ensureProfilesReady();
    apply(settings);
  }

  async function init() {
    if (global.SniperCropProfile?.apply) global.SniperCropProfile.apply();
    await ensureProfilesReady();
    apply();
    addCalibrateButton();
    window.addEventListener('resize', () => {
      if (!document.getElementById('dexCropPanel')?.classList.contains('hidden')) return;
      apply();
    });
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
          apply();
        }
      }).observe(vd, { attributes: true, attributeFilter: ['class'] });
    }
  }

  global.SniperDexCrop = {
    STORAGE_KEY,
    PROFILE_META,
    PROFILE_ORDER,
    DEFAULT_BLOCK,
    detectProfile,
    ensureProfilesReady,
    loadStore,
    loadForProfile,
    load,
    saveBlock,
    resetProfile,
    reset,
    apply,
    applyAsync,
    openPanel,
    closePanel,
    copyProfileFrom,
    isCalibrateMode,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})(window);
