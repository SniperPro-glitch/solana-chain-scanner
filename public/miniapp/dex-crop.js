/**
 * DexScreener kirpma — 5 profil: Web, iPhone 11, 13, 13 Pro Max, 16 Pro Max
 * ?kalibre=1 veya "Kirpma" butonu
 */
(function (global) {
  const STORAGE_KEY = 'sniperDexCropV4';
  const CROP_UNLOCK_KEY = 'sniperCropDevUnlock';
  const CROP_UI_STATE_KEY = 'sniperCropUiState';
  const CROP_PIN_SESSION_KEY = 'sniperCropPinOk';
  const CROP_TAP_COUNT = 5;
  const CROP_TAP_WINDOW_MS = 1400;
  const TRADES_TAP_SEL =
    '.trades-tape, #tradesTape, .trades-head, .trades-title, .trades-live, #dexTradesWrap';
  let cropPinRequired = true;
  const LEGACY_KEYS = ['sniperDexCropV3', 'sniperDexCropV2', 'sniperDexCropV1'];
  let serverBaked = null;
  let profilesReady = null;
  const CHART_BRAND_CROP = 40;
  const D = 'di' + 'v';
  /** Gizli motor — token detayda baked profil apply (kalibre paneli kapalıyken). */
  const MOTOR_TEMP_DISABLED = false;

  const PROFILE_META = {
    web: { label: 'Web', hint: 'Tarayici / Dex embed' },
    webgecko: { label: 'Web GK', hint: 'Gecko · masaustu (~1200px)' },
    app11gecko: { label: '11 GK', hint: 'Gecko · iPhone 11 / XR (~414px)' },
    app13gecko: { label: '13 GK', hint: 'Gecko · iPhone 12–15 (~390px)' },
    app13pmgecko: { label: '13 PM GK', hint: 'Gecko · Pro Max (~428px)' },
    app16gecko: { label: '16 PM GK', hint: 'Gecko · iPhone 16 Pro Max (~440px)' },
    app11: { label: '11', hint: 'iPhone 11, XR, 11 Pro Max (~414px)' },
    app13: { label: '13', hint: 'iPhone 12–15, 12 Pro (~390px)' },
    app13pm: { label: '13 PM', hint: 'iPhone 12–15 Pro Max (~428px)' },
    app16: { label: '16 PM', hint: 'iPhone 16 Pro / Pro Max (~440px) — referans' },
  };

  const DEX_PROFILE_ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];
  const GECKO_PROFILE_ORDER = ['webgecko', 'app11gecko', 'app13gecko', 'app13pmgecko', 'app16gecko'];
  const PROFILE_ORDER = [...DEX_PROFILE_ORDER, ...GECKO_PROFILE_ORDER];

  function profileFamily(profileId) {
    return String(profileId || '').endsWith('gecko') ? 'gecko' : 'dex';
  }

  function cropEmbedFamily() {
    const fam = document.documentElement.dataset.cropEmbedFamily;
    if (fam === 'gecko' || fam === 'dex') return fam;
    if (document.documentElement.dataset.chartEmbedProvider === 'gecko') return 'gecko';
    if (document.documentElement.classList.contains('web-browser')) return 'gecko';
    return 'dex';
  }

  function profilesInFamily(family) {
    return family === 'gecko' ? GECKO_PROFILE_ORDER : DEX_PROFILE_ORDER;
  }

  const BAKED_PROFILES = {"web":{"chart":{"stageH":330,"top":40,"left":1,"width":104,"heightExtra":0,"brandCrop":39,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0,"shiftDown":0},"tape":{"shiftDown":0},"trades":{"viewH":302,"iframeH":845,"iframeTop":-590,"shiftDown":0,"left":1,"width":98,"maskTop":0,"maskFoot":0,"maskTopOn":true,"maskFootOn":true,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0}},"app11":{"chart":{"stageH":424,"top":-104,"left":0,"width":100,"heightExtra":0,"brandCrop":40,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0,"shiftDown":142},"tape":{"shiftDown":0},"trades":{"viewH":294,"iframeH":845,"iframeTop":-555,"shiftDown":44,"left":0,"width":101,"maskTop":0,"maskFoot":0,"maskTopOn":true,"maskFootOn":false,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0}},"app13":{"chart":{"stageH":314,"top":-15,"left":-1,"width":102,"heightExtra":0,"brandCrop":0,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0,"shiftDown":55},"tape":{"shiftDown":0},"trades":{"viewH":302,"iframeH":845,"iframeTop":-590,"shiftDown":0,"left":1,"width":98,"maskTop":0,"maskFoot":0,"maskTopOn":true,"maskFootOn":true,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0}},"app13pm":{"chart":{"stageH":344,"top":40,"left":-1,"width":108,"heightExtra":36,"brandCrop":39,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0,"shiftDown":0},"tape":{"shiftDown":0},"trades":{"viewH":268,"iframeH":980,"iframeTop":-755,"shiftDown":166,"left":-1,"width":108,"maskTop":0,"maskFoot":0,"maskTopOn":true,"maskFootOn":true,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0}},"app16":{"chart":{"stageH":418,"top":26,"left":-2,"width":103,"heightExtra":6,"brandCrop":0,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0,"shiftDown":13},"tape":{"shiftDown":0},"trades":{"viewH":250,"iframeH":745,"iframeTop":-585,"shiftDown":137,"left":0,"width":100,"maskTop":0,"maskFoot":0,"maskTopOn":false,"maskFootOn":false,"clipLeft":0,"clipRight":0,"clipTop":0,"clipBottom":0}}};

  /** 18 May — alım/satım kutusu 5 cihazda aynı; grafik profil bazlı. */
  const LOCKED_TRADES_FRAME = {
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
  };

  function enforceTradesFrame(trades) {
    if (!trades) return { ...LOCKED_TRADES_FRAME };
    return { ...trades };
  }

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
    trades: { ...LOCKED_TRADES_FRAME },
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
    return refreshCropProfile();
  }

  /** Her motor/apply öncesi — web=web, TG=viewportWidth ile 5 profil. */
  function refreshCropProfile() {
    const forced = profileFromUrl();
    if (forced) {
      document.documentElement.dataset.dexCropProfile = forced;
      document.documentElement.dataset.dexCropW = String(
        global.SniperCropProfile?.layoutWidth?.() || window.innerWidth || 0,
      );
      return forced;
    }
    if (global.SniperCropProfile?.apply) return global.SniperCropProfile.apply();
    const id = detectProfile();
    document.documentElement.dataset.dexCropProfile = id;
    return id;
  }

  /** Sunucu API → dex-crop-baked.js → kod içi yedek. */
  function getBakedSource() {
    if (serverBaked?.profiles) {
      return {
        version: serverBaked.version || 1,
        updatedAt: serverBaked.updatedAt || null,
        profiles: serverBaked.profiles,
      };
    }
    const g = globalThis.__DEX_CROP_BAKED__;
    if (g?.profiles) {
      return {
        version: g.version || 1,
        updatedAt: g.updatedAt || null,
        profiles: g.profiles,
      };
    }
    return { version: 1, profiles: BAKED_PROFILES };
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
    try {
      const r = await fetch('/api/crop-profiles', { cache: 'no-store' });
      if (!r.ok) return serverBaked;
      const data = await r.json();
      if (data?.profiles) serverBaked = data;
    } catch {
      /* yoksay */
    }
    return serverBaked;
  }

  async function publishServerProfiles(savePin) {
    const store = loadStore();
    store.profiles[editingProfile] = clone(current);
    saveStore(store);
    const headers = { 'Content-Type': 'application/json' };
    const pin = cropPinForPublish(savePin);
    if (pin) {
      headers['x-crop-save-pin'] = pin;
      headers['x-crop-pin'] = pin;
    }
    const r = await fetch('/api/crop-profiles', {
      method: 'POST',
      headers,
      body: JSON.stringify({ version: 1, profiles: store.profiles }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || data.error || `HTTP ${r.status}`);
    serverBaked = data.saved || { version: 1, profiles: store.profiles };
    if (isDetailOpen() && !cropPanelIsOpen()) {
      applyCropNow();
      runHiddenMotor();
    }
    return serverBaked;
  }

  function isTelegram() {
    if (global.SniperHost?.isTelegram?.()) return true;
    if (global.SniperTgLaunch?.hasLaunchData?.()) return true;
    return !!global.Telegram?.WebApp?.initData || document.documentElement.classList.contains('tg-mini-app');
  }

  function isTelegramDesktop() {
    const p = String(global.Telegram?.WebApp?.platform || '').toLowerCase();
    return ['macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  function detectProfileByWidth(w) {
    const width = Math.round(Number(w) || 0);
    if (width >= 429) return 'app16';
    if (width >= 426) return 'app13pm';
    if (width >= 400) return 'app11';
    return 'app13';
  }

  function detectGeckoProfileByWidth(w) {
    const width = Math.round(Number(w) || 0);
    if (width >= 429) return 'app16gecko';
    if (width >= 426) return 'app13pmgecko';
    if (width >= 400) return 'app11gecko';
    return 'app13gecko';
  }

  function cropLayoutWidth() {
    if (typeof global.SniperCropProfile?.layoutWidth === 'function') {
      return Math.round(global.SniperCropProfile.layoutWidth());
    }
    const inner = Math.round(window.innerWidth || 0);
    const tgVp = Math.round(global.Telegram?.WebApp?.viewportWidth || 0);
    return Math.max(inner, tgVp) || 390;
  }

  function detectProfile() {
    const forced = profileFromUrl();
    if (forced) return forced;
    const w = cropLayoutWidth();
    if (cropEmbedFamily() === 'gecko') {
      if (w > 500) return 'webgecko';
      return detectGeckoProfileByWidth(w);
    }
    if (!isTelegram() && w > 500) return 'web';
    return detectProfileByWidth(w);
  }

  function resolveMotorProfileId() {
    return detectProfile();
  }

  function normalizeBlock(patch) {
    return mergeBlock(DEFAULT_BLOCK, patch);
  }

  function mergeBlock(base, patch) {
    if (!patch) return clone(base);
    return {
      chart: { ...base.chart, ...patch.chart },
      tape: { ...base.tape, ...patch.tape },
      trades: enforceTradesFrame({ ...base.trades, ...patch.trades }),
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

  /** Önce baked; Bu profili kaydet ile yazılan localStorage her zaman üstün gelir. */
  function loadStore() {
    migrateLegacy();
    const store = defaultStore();
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
      syncProfilesToServer(serverBaked);
      return true;
    } catch {
      return false;
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function sanitizeCropBlock(block) {
    const b = clone(normalizeBlock(block));
    const c = b.chart || {};
    const t = b.trades || {};
    c.stageH = Math.max(260, Math.min(520, Number(c.stageH) || 330));
    c.top = Math.max(-200, Math.min(80, Number(c.top) || 0));
    c.brandCrop = Math.max(0, Math.min(96, Number(c.brandCrop) || 0));
    c.shiftDown = Math.max(0, Math.min(120, Number(c.shiftDown) || 0));
    c.geckoLift = Math.max(200, Math.min(720, Number(c.geckoLift) || 0));
    t.viewH = Math.max(160, Math.min(400, Number(t.viewH) || 302));
    t.iframeH = Math.max(400, Math.min(1400, Number(t.iframeH) || 845));
    t.iframeTop = Math.max(-1200, Math.min(-120, Number(t.iframeTop) || -590));
    t.shiftDown = Math.max(0, Math.min(200, Number(t.shiftDown) || 0));
    return b;
  }

  function ensureGeckoChartDefaults(block, profileId) {
    if (profileFamily(profileId) !== 'gecko') return block;
    const baked = profileFromBaked(profileId);
    const b = baked?.chart || {};
    const c = block.chart || {};
    const lift = Number(c.geckoLift) || 0;
    const top = Number(c.top) || 0;
    const needsFix = top > -80 || lift < 200;
    if (!needsFix) return block;
    block.chart = {
      ...b,
      ...c,
      geckoLift: lift >= 200 ? lift : Number(b.geckoLift) || 340,
      top: top > -80 ? Number(b.top) ?? -48 : top,
      brandCrop: Math.max(Number(c.brandCrop) || 0, Number(b.brandCrop) || 56),
      heightExtra: Math.max(Number(c.heightExtra) || 0, Number(b.heightExtra) || 48),
    };
    return block;
  }

  function loadForProfile(profileId) {
    const store = loadStore();
    const fam = profileFamily(profileId);
    const fallback =
      (fam === 'gecko' ? store.profiles.webgecko : store.profiles.web)
      || store.profiles.web
      || defaultBlock();
    const raw = store.profiles[profileId] || fallback;
    return sanitizeCropBlock(ensureGeckoChartDefaults(clone(raw), profileId));
  }

  function load() {
    return loadForProfile(activeProfileId());
  }

  function profileFromBaked(profileId) {
    const baked = getBakedSource();
    const block = baked?.profiles?.[profileId];
    if (!block) return null;
    return normalizeBlock(block);
  }

  function saveBlock(profileId, block) {
    if (!isCropEditAllowed()) return;
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

  function setImp(el, prop, value) {
    if (!el) return;
    el.style.setProperty(prop, value, 'important');
  }

  function showCropDebug(profileId, t) {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('debugcrop') !== '1') return;
    } catch {
      return;
    }
    let el = document.getElementById('dexCropDebug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dexCropDebug';
      el.setAttribute('aria-live', 'polite');
      Object.assign(el.style, {
        position: 'fixed',
        left: '6px',
        right: '6px',
        bottom: '72px',
        zIndex: '99999',
        padding: '6px 8px',
        font: '10px/1.35 monospace',
        color: '#a5f3fc',
        background: 'rgba(0,0,0,.88)',
        border: '1px solid rgba(0,229,255,.35)',
        borderRadius: '6px',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      });
      document.body.appendChild(el);
    }
    const wrap = document.getElementById('dexTradesWrap');
    const iframe = document.getElementById('dexTradesEmbed');
    const w = wrap ? getComputedStyle(wrap).height : '—';
    const top = iframe ? getComputedStyle(iframe).top : '—';
    const h = iframe ? getComputedStyle(iframe).height : '—';
    el.textContent = [
      `profil=${profileId} w=${document.documentElement.dataset.dexCropW || '?'}`,
      `beklenen viewH=${t.viewH} top=${t.iframeTop + (t.shiftDown || 0)} h=${t.iframeH}`,
      `gerçek wrap=${w} iframe top=${top} h=${h}`,
      `kaynak=${isCalibrateMode() ? 'localStorage' : 'baked'} rev=v39`,
    ].join('\n');
  }

  function bindCropObservers() {
    if (global.__sniperCropObs) return;
    global.__sniperCropObs = true;
    const reapply = () => {
      if (cropPanelIsOpen()) return;
      if (!isDetailOpen()) return;
      handleCropProfileChange();
      const pid = refreshCropProfile();
      apply(loadForProfile(pid));
      if (!layoutSessionDone(pid)) ensureMotorOnce();
    };
    window.addEventListener('resize', reapply);
    const tg = global.Telegram?.WebApp;
    if (tg && typeof tg.onEvent === 'function') {
      tg.onEvent('viewportChanged', reapply);
    }
    for (const id of ['dexTradesWrap', 'dexTradesEmbed']) {
      const node = document.getElementById(id);
      if (!node || typeof ResizeObserver === 'undefined') continue;
      const ro = new ResizeObserver(reapply);
      ro.observe(node);
    }
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
    const profileId = resolveMotorProfileId();
    document.documentElement.dataset.dexCropProfile = profileId;
    document.documentElement.dataset.cropEmbedFamily = profileFamily(profileId);
    const s = settings || loadForProfile(profileId);
    const root = document.documentElement;
    const c = s.chart;
    const t = enforceTradesFrame(s.trades);
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
      setImp(stage, 'height', `${c.stageH}px`);
      setImp(stage, 'min-height', `${c.stageH}px`);
      setImp(stage, 'max-height', `${c.stageH}px`);
      applyClip(stage, c.clipLeft, c.clipRight, c.clipTop, c.clipBottom);
    }
    if (chartIframe) {
      const isGeckoChart = cropEmbedFamily() === 'gecko';
      let chartTop;
      let chartH;
      if (isGeckoChart) {
        const lift = Number(c.geckoLift) || 340;
        const iframeH = Math.max(760, c.stageH + (Number(c.heightExtra) || 0) + 560);
        chartTop = `${Math.max(-920, c.top - brandCrop + chartDown - lift)}px`;
        chartH = `${iframeH}px`;
      } else {
        chartTop = `${Math.max(-80, c.top - brandCrop + chartDown)}px`;
        chartH = `${Math.max(c.stageH, c.stageH + c.heightExtra + brandCrop)}px`;
      }
      setImp(chartIframe, 'position', 'absolute');
      setImp(chartIframe, 'top', chartTop);
      setImp(chartIframe, 'left', `${c.left}%`);
      setImp(chartIframe, 'width', `${c.width}%`);
      setImp(chartIframe, 'height', chartH);
      setImp(chartIframe, 'max-width', 'none');
      setImp(chartIframe, 'margin', '0');
      setImp(chartIframe, 'border', '0');
      setImp(chartIframe, 'display', 'block');
      setImp(chartIframe, 'visibility', 'visible');
      setImp(chartIframe, 'opacity', '1');
    }

    const wrap = document.getElementById('dexTradesWrap');
    const tradesIframe = document.getElementById('dexTradesEmbed');
    const maskTop = wrap?.querySelector('.dex-mask-top');
    const maskFoot = wrap?.querySelector('.dex-mask-foot');

    if (wrap) {
      setImp(wrap, 'height', `${t.viewH}px`);
      setImp(wrap, 'min-height', `${t.viewH}px`);
      setImp(wrap, 'max-height', `${t.viewH}px`);
      setImp(wrap, 'overflow', 'hidden');
      applyClip(wrap, t.clipLeft, t.clipRight, t.clipTop, t.clipBottom);
      const maskTopOn = t.maskTopOn !== false;
      const maskFootOn = t.maskFootOn !== false;
      wrap.classList.toggle('dex-masks-off', !maskTopOn && !maskFootOn);
      wrap.classList.toggle('dex-mask-top-off', !maskTopOn);
      wrap.classList.toggle('dex-mask-foot-off', !maskFootOn);
    }
    if (tradesIframe) {
      const topPx = t.iframeTop + tradesDown;
      setImp(tradesIframe, 'position', 'absolute');
      setImp(tradesIframe, 'top', `${topPx}px`);
      setImp(tradesIframe, 'left', `${t.left}%`);
      setImp(tradesIframe, 'width', `${t.width}%`);
      setImp(tradesIframe, 'height', `${t.iframeH}px`);
      setImp(tradesIframe, 'max-width', 'none');
      setImp(tradesIframe, 'border', '0');
      setImp(tradesIframe, 'display', 'block');
      setImp(tradesIframe, 'margin', '0');
      setImp(tradesIframe, 'pointer-events', 'auto');
      setImp(tradesIframe, 'transform', 'none');
    }
    applyMaskEl(maskTop, t.maskTopOn !== false, t.maskTop);
    applyMaskEl(maskFoot, t.maskFootOn !== false, t.maskFoot);
    showCropDebug(profileId, t);
  }

  function enableCalibrateSession() {
    try {
      sessionStorage.setItem('sniperCropCalibrate', '1');
    } catch {
      /* yoksay */
    }
    document.documentElement.dataset.cropCalibrate = '1';
  }

  /** URL ?kalibre=1 veya Kırpma paneli açıkken (oturum). */
  function isCalibrateMode() {
    if (calibrateFromUrl()) return true;
    try {
      if (sessionStorage.getItem('sniperCropCalibrate') === '1') return true;
    } catch {
      /* yoksay */
    }
    return document.documentElement.dataset.cropCalibrate === '1';
  }

  function calibrateFromStartParam() {
    try {
      const sp = String(global.Telegram?.WebApp?.initDataUnsafe?.start_param || '').trim();
      if (!sp) return false;
      if (sp === 'kalibre' || sp === 'calibrate' || sp.includes('kalibre')) return true;
    } catch {
      /* yoksay */
    }
    return false;
  }

  /** URL ?kalibre=1 veya TG start_param=kalibre */
  function calibrateFromUrl() {
    if (calibrateFromStartParam()) return true;
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('kalibre') === '1' || q.get('calibrate') === '1') return true;
    } catch {
      /* yoksay */
    }
    return String(location.hash || '').includes('kalibre');
  }

  function getTelegramUserId() {
    const u = global.Telegram?.WebApp?.initDataUnsafe?.user;
    if (u?.id != null && u.id !== '') return String(u.id);
    const raw = String(global.Telegram?.WebApp?.initData || '').trim();
    if (!raw) return '';
    try {
      const userJson = new URLSearchParams(raw).get('user');
      if (userJson) {
        const parsed = JSON.parse(userJson);
        if (parsed?.id != null && parsed.id !== '') return String(parsed.id);
      }
    } catch {
      /* yoksay */
    }
    return '';
  }

  function isFounderOrAdminSession() {
    try {
      if (sessionStorage.getItem('sniperSidebarSignedIn') !== '1') return false;
      const p = JSON.parse(sessionStorage.getItem('sniperAdminProfileV1') || 'null');
      if (!p) return false;
      if (p.isFounder) return true;
      const role = String(p.role || '').toLowerCase();
      return role === 'admin' || role === 'founder' || role === 'owner';
    } catch {
      return false;
    }
  }

  function isCropDevUnlocked() {
    return getCropUiState() === 'on';
  }

  function getCropUiState() {
    try {
      const s = localStorage.getItem(CROP_UI_STATE_KEY);
      if (s === 'on' || s === 'stealth' || s === 'off') return s;
      if (localStorage.getItem(CROP_UNLOCK_KEY) === '1') return 'on';
      return 'off';
    } catch {
      return 'off';
    }
  }

  function setCropUiState(state) {
    try {
      localStorage.setItem(CROP_UI_STATE_KEY, state);
      if (state === 'on') localStorage.setItem(CROP_UNLOCK_KEY, '1');
      else localStorage.removeItem(CROP_UNLOCK_KEY);
    } catch {
      /* yoksay */
    }
    delete document.documentElement.dataset.cropStealth;
    if (state === 'on') {
      enableCalibrateSession();
      syncCropUi();
      toast('K\u0131rpma butonlar\u0131 a\u00e7\u0131ld\u0131');
      return;
    }
    if (state === 'stealth') {
      clearCalibrateSession();
      closePanel();
      document.documentElement.dataset.cropStealth = '1';
      syncCropUi();
      if (isDetailOpen()) {
        applyCropNow();
        runHiddenMotor();
      }
      toast('K\u0131rpma gizli \u2014 motor aktif');
      return;
    }
    clearCalibrateSession();
    closePanel();
    syncCropUi();
    toast('K\u0131rpma kapal\u0131');
  }

  function cycleCropUiState() {
    const cur = getCropUiState();
    const next = cur === 'off' ? 'on' : cur === 'on' ? 'stealth' : 'off';
    setCropUiState(next);
  }

  async function loadCropPinPolicy() {
    if (cropPinRequired !== null) return cropPinRequired;
    try {
      const r = await fetch('/api/crop-pin-required', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        cropPinRequired = !!j.required;
        return cropPinRequired;
      }
    } catch {
      /* yoksay */
    }
    cropPinRequired = true;
    return true;
  }

  function isCropPinSessionOk() {
    try {
      return sessionStorage.getItem(CROP_PIN_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  function grantCropPinSession(pin) {
    try {
      sessionStorage.setItem(CROP_PIN_SESSION_KEY, '1');
      if (pin) sessionStorage.setItem('sniperCropPinValue', String(pin));
    } catch {
      /* yoksay */
    }
    applyPanelEditLock();
  }

  function cropPinForPublish(explicitPin) {
    if (explicitPin && explicitPin !== '__session__') return explicitPin;
    try {
      return sessionStorage.getItem('sniperCropPinValue') || '';
    } catch {
      return '';
    }
  }

  function isCropEditAllowed() {
    if (document.documentElement.dataset.cropAdmin === '1') return true;
    if (isFounderOrAdminSession()) return true;
    if (!cropPinRequired) return true;
    return isCropPinSessionOk();
  }

  async function promptCropSavePin(forcePrompt) {
    await loadCropPinPolicy();
    if (!cropPinRequired) return '';
    if (!forcePrompt && isCropPinSessionOk()) return '__session__';
    const pin = global.prompt?.('K\u0131rpma kay\u0131t \u015fifresi:') || '';
    if (!pin.trim()) {
      toast('Kay\u0131t i\u00e7in \u015fifre gerekli');
      return null;
    }
    try {
      const r = await fetch('/api/crop-verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (!r.ok) {
        toast('Yanl\u0131\u015f \u015fifre');
        return null;
      }
      grantCropPinSession(pin.trim());
      return pin.trim();
    } catch {
      toast('\u015eifre do\u011frulanamad\u0131');
      return null;
    }
  }

  function applyPanelEditLock() {
    const panel = document.getElementById('dexCropPanel');
    if (!panel) return;
    const locked = !isCropEditAllowed();
    panel.classList.toggle('crop-panel-locked', locked);
    panel.querySelectorAll('input, button').forEach((el) => {
      if (el.id === 'cropPinUnlockBtn' || el.id === 'cropCloseBtn') return;
      if (locked) el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('disabled');
    });
    const hint = document.getElementById('cropPinHint');
    if (hint) {
      hint.classList.toggle('hidden', !locked);
    }
  }

  function bindCalibrateGesture() {
    if (global.__sniperCropGesture) return;
    global.__sniperCropGesture = true;
    let taps = 0;
    let tapTimer = null;
    const onTap = (e) => {
      if (!e.target.closest?.(TRADES_TAP_SEL)) return;
      taps += 1;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        taps = 0;
      }, CROP_TAP_WINDOW_MS);
      if (taps >= CROP_TAP_COUNT) {
        taps = 0;
        cycleCropUiState();
      }
    };
    document.addEventListener('touchend', onTap, { passive: true });
    document.addEventListener('click', onTap, true);
  }

  function bindStaticCropButtons() {
    ['btnCropDetail', 'btnCropInline', 'cropCalFab'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.cropBound === '1') return;
      el.dataset.cropBound = '1';
      wireCropButton(el);
    });
  }

  function syncCropUi() {
    const on = shouldShowCropButton();
    document.documentElement.classList.toggle('crop-ui-visible', on);
    if (on) document.documentElement.dataset.cropUiOn = '1';
    else delete document.documentElement.dataset.cropUiOn;

    const detailOpen = isDetailOpen();
    ['btnCropDetail', 'btnCropInline', 'cropCalFab'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (on && detailOpen) {
        el.classList.remove('hidden');
        if (id === 'cropCalFab') styleCropFab(el);
      } else {
        el.classList.add('hidden');
        if (id === 'cropCalFab') el.style.setProperty('display', 'none', 'important');
      }
    });
  }

  let cropHintShown = false;
  function maybeCropUnlockHint() {
    if (cropHintShown || shouldShowCropButton() || !isDetailOpen()) return;
    if (!global.Telegram?.WebApp) return;
    cropHintShown = true;
    toast('K\u0131rpma: Canl\u0131 al\u0131m/sat\u0131ma 5 kez dokun');
  }

  function layoutWidthPx() {
    return global.SniperCropProfile?.layoutWidth?.() || Math.round(window.innerWidth || 390);
  }

  function styleCropFab(fab) {
    const narrow = layoutWidthPx() <= 430;
    const top = narrow
      ? 'calc(var(--tg-content-safe-top, env(safe-area-inset-top, 0px)) + 56px)'
      : 'auto';
    const bottom = narrow
      ? 'auto'
      : 'calc(var(--trade-bar-h, 76px) + var(--tg-safe-bottom, env(safe-area-inset-bottom, 0px)) + 14px)';
    fab.style.setProperty('display', 'block', 'important');
    fab.style.setProperty('position', 'fixed', 'important');
    fab.style.setProperty('right', '12px', 'important');
    fab.style.setProperty('top', top, 'important');
    fab.style.setProperty('bottom', bottom, 'important');
    fab.style.setProperty('z-index', '10001', 'important');
    fab.style.setProperty('padding', '10px 14px', 'important');
    fab.style.setProperty('border-radius', '999px', 'important');
    fab.style.setProperty('border', '1px solid rgba(0, 229, 255, 0.55)', 'important');
    fab.style.setProperty('background', 'rgba(0, 40, 48, 0.98)', 'important');
    fab.style.setProperty('color', '#67e8f9', 'important');
    fab.style.setProperty('font-size', '12px', 'important');
    fab.style.setProperty('font-weight', '800', 'important');
    fab.style.setProperty('box-shadow', '0 4px 24px rgba(0,0,0,.5)', 'important');
    fab.style.setProperty('pointer-events', 'auto', 'important');
  }

  function updateCropFabVisibility() {
    syncCropUi();
  }

  async function requestAdminCropAccess() {
    const initData = String(global.Telegram?.WebApp?.initData || '').trim();
    if (initData) {
      try {
        const r = await fetch('/api/miniapp/admin-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.allowed) return true;
        }
      } catch {
        /* yoksay */
      }
    }
    const uid = getTelegramUserId();
    if (!uid) return false;
    try {
      const r = await fetch(`/api/miniapp/admin-access?telegramId=${encodeURIComponent(uid)}`);
      if (!r.ok) return false;
      const j = await r.json();
      return !!j?.allowed;
    } catch {
      return false;
    }
  }

  function grantAdminCalibrate() {
    document.documentElement.dataset.cropAdmin = '1';
    enableCalibrateSession();
    syncCropUi();
  }

  /** Telegram mini app — ADMIN_USER_ID (initData HMAC veya telegramId). */
  async function tryEnableAdminCalibrate() {
    if (isFounderOrAdminSession()) {
      grantAdminCalibrate();
      return true;
    }
    if (!isTelegram() && !global.Telegram?.WebApp) return false;
    const ok = await requestAdminCropAccess();
    if (!ok) return false;
    grantAdminCalibrate();
    return true;
  }

  function shouldShowCropButton() {
    if (calibrateFromUrl()) return true;
    if (document.documentElement.dataset.cropAdmin === '1') return true;
    if (isFounderOrAdminSession()) return true;
    return getCropUiState() === 'on';
  }

  function removeCalibrateButton() {
    document.querySelectorAll('.trades-head .btn-crop-cal:not(#btnCropInline)').forEach((el) => el.remove());
    syncCropUi();
  }

  function wireCropButton(btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });
  }

  function clearCalibrateSession() {
    try {
      sessionStorage.removeItem('sniperCropCalibrate');
    } catch {
      /* yoksay */
    }
    delete document.documentElement.dataset.cropCalibrate;
  }

  const LAYOUT_SESSION_KEY = 'sniperCropLayoutV3';
  let motorBurstDoneTimer = null;
  let lastMotorProfileId = null;

  function layoutSessionStorageKey(profileId) {
    return `${LAYOUT_SESSION_KEY}:${profileId}`;
  }

  function layoutSessionDone(profileId) {
    if (isCalibrateMode()) return false;
    const id = profileId || refreshCropProfile();
    try {
      return sessionStorage.getItem(layoutSessionStorageKey(id)) === '1';
    } catch {
      return false;
    }
  }

  function markLayoutSessionDone(profileId) {
    const id = profileId || refreshCropProfile();
    try {
      sessionStorage.setItem(layoutSessionStorageKey(id), '1');
      sessionStorage.removeItem(LAYOUT_SESSION_KEY);
      sessionStorage.removeItem('sniperCropLayoutDone');
    } catch {
      /* yoksay */
    }
    global.__sniperCropLayoutDone = true;
    lastMotorProfileId = id;
  }

  function clearLayoutSession(profileId) {
    try {
      if (profileId) {
        sessionStorage.removeItem(layoutSessionStorageKey(profileId));
      } else {
        PROFILE_ORDER.forEach((id) => sessionStorage.removeItem(layoutSessionStorageKey(id)));
        sessionStorage.removeItem(LAYOUT_SESSION_KEY);
        sessionStorage.removeItem('sniperCropLayoutDone');
      }
    } catch {
      /* yoksay */
    }
    delete global.__sniperCropLayoutDone;
    if (motorBurstDoneTimer) {
      clearTimeout(motorBurstDoneTimer);
      motorBurstDoneTimer = null;
    }
  }

  function cropPanelIsOpen() {
    const panel = document.getElementById('dexCropPanel');
    return !!(panel && !panel.classList.contains('hidden'));
  }

  /** ?kalibre=1 veya kırpma paneli açıkken otomatik apply yok (slider apply(current) kalır). */
  function shouldSkipAutoCrop() {
    return isCalibrateMode() || cropPanelIsOpen();
  }

  /** Anlık apply — git-gel beklemeden (iframe hazır olunca tekrar motor). */
  function applyCropNow() {
    if (shouldSkipAutoCrop()) return refreshCropProfile();
    if (!isCalibrateMode()) clearCalibrateSession();
    const pid = resolveMotorProfileId();
    document.documentElement.dataset.dexCropProfile = pid;
    document.documentElement.dataset.cropEmbedFamily = profileFamily(pid);
    apply(loadForProfile(pid));
    lastMotorProfileId = pid;
    return pid;
  }

  function applyForProvider(provider) {
    const fam = provider === 'gecko' ? 'gecko' : 'dex';
    document.documentElement.dataset.cropEmbedFamily = fam;
    document.documentElement.dataset.chartEmbedProvider = provider;
    const pid = resolveMotorProfileId();
    document.documentElement.dataset.dexCropProfile = pid;
    if (global.SniperDexCropEarly?.applyEarly) global.SniperDexCropEarly.applyEarly();
    apply(loadForProfile(pid));
    lastMotorProfileId = pid;
    return pid;
  }

  /** 16 PM ↔ web vb. profil değişince: önce anlık apply, sonra gizli motor. */
  function handleCropProfileChange() {
    const prev = lastMotorProfileId || document.documentElement.dataset.dexCropProfile;
    const next = refreshCropProfile();
    if (prev && prev !== next) {
      clearLayoutSession();
      if (global.SniperDexCropEarly?.applyEarly) global.SniperDexCropEarly.applyEarly();
      if (isDetailOpen() && !cropPanelIsOpen()) {
        applyCropNow();
        runHiddenMotor();
      }
    }
    lastMotorProfileId = next;
    return next;
  }

  function isDetailOpen() {
    const vd = document.getElementById('view-detail');
    return (
      document.documentElement.classList.contains('detail-mode')
      || (vd && !vd.classList.contains('hidden'))
    );
  }

  /**
   * Gizli motor = Kırpma apply (panel yok). Her zaman baked/git profil — localStorage değil.
   */
  function runHiddenMotor() {
    if (MOTOR_TEMP_DISABLED) return false;
    if (!isDetailOpen()) return false;
    const panel = document.getElementById('dexCropPanel');
    if (panel && !panel.classList.contains('hidden')) return false;

    clearCalibrateSession();
    editingProfile = refreshCropProfile();
    current = loadForProfile(editingProfile);
    apply(current);
    if (panel) panel.classList.add('hidden');
    document.documentElement.classList.remove('crop-panel-open');

    const finish = () => {
      if (!isDetailOpen()) return;
      const pid = refreshCropProfile();
      apply(loadForProfile(pid));
    };
    finish();
    [150, 500, 1200, 2500, 4000, 6000].forEach((ms) => setTimeout(finish, ms));
    if (motorBurstDoneTimer) clearTimeout(motorBurstDoneTimer);
    motorBurstDoneTimer = setTimeout(() => markLayoutSessionDone(editingProfile), 6200);
    return true;
  }

  /** Profil başına bir kez — Dex iframe hazır olunca. */
  function ensureMotorOnce() {
    if (MOTOR_TEMP_DISABLED) return false;
    handleCropProfileChange();
    const profileId = refreshCropProfile();
    applyCropNow();
    if (layoutSessionDone(profileId)) return false;
    if (!isDetailOpen()) return false;
    void ensureProfilesReady().then(() => {
      if (layoutSessionDone(profileId)) return;
      let tries = 0;
      const attempt = () => {
        if (layoutSessionDone(refreshCropProfile())) return;
        tries += 1;
        const hasEmbed = !!(
          document.querySelector('iframe.dex-embed-chart')
          || document.getElementById('dexTradesEmbed')?.src
        );
        if (hasEmbed || tries >= 48) runHiddenMotor();
        else setTimeout(attempt, 250);
      };
      attempt();
    });
    return true;
  }

  function bindMotorOnEmbedReady() {
    if (global.__sniperMotorEmbedReady) return;
    global.__sniperMotorEmbedReady = true;
    document.addEventListener(
      'load',
      (e) => {
        const t = e.target;
        if (!t?.matches?.('iframe.dex-embed-chart, #dexTradesEmbed')) return;
        if (!isDetailOpen()) return;
        applyCropNow();
        [150, 500, 1200].forEach((ms) => setTimeout(applyCropNow, ms));
        runHiddenMotor();
      },
      true,
    );
  }

  function burstApplyOnDetail() {
    if (!isDetailOpen() || shouldSkipAutoCrop()) return;
    applyCropNow();
    [150, 500, 1200, 2500, 4000, 6500].forEach((ms) => setTimeout(applyCropNow, ms));
  }

  function onDetailOpen() {
    clearLayoutSession();
    document.documentElement.classList.add('crop-motor-on');
    syncCropUi();
    applyCropNow();
    burstApplyOnDetail();
    if (global.SniperDexCropEarly?.applyEarly) global.SniperDexCropEarly.applyEarly();
    setTimeout(maybeCropUnlockHint, 1800);
    if (!shouldShowCropButton()) {
      void tryEnableAdminCalibrate().then(() => syncCropUi());
    }
  }

  function scheduleCalibrateAccess() {
    const run = async () => {
      if (calibrateFromUrl()) {
        enableCalibrateSession();
        syncCropUi();
        return true;
      }
      return tryEnableAdminCalibrate();
    };
    void run();
    let n = 0;
    const tick = () => {
      n += 1;
      void run().then((ok) => {
        syncCropUi();
        if (!ok && !shouldShowCropButton() && n < 24) setTimeout(tick, 400);
      });
    };
    const tg = global.Telegram?.WebApp;
    if (typeof tg?.ready === 'function') tg.ready(tick);
    [0, 120, 400, 900, 1800, 3200, 5000, 8000].forEach((ms) => setTimeout(tick, ms));
  }

  function scheduleMotorCrop() {
    if (MOTOR_TEMP_DISABLED) return;
    ensureMotorOnce();
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
  let editingFamily = 'dex';
  let panelBuilt = false;
  /** Panel açılınca dosyadaki değerler — kayıttan sonra fark gösterilir */
  let baselineProfiles = null;

  function tradesDiffLine(id, before, after) {
    const b = before?.trades || {};
    const a = after?.trades || {};
    const lines = [];
    if (b.viewH !== a.viewH) lines.push(`viewH ${b.viewH}→${a.viewH}`);
    if (b.iframeTop !== a.iframeTop) lines.push(`iframeTop ${b.iframeTop}→${a.iframeTop}`);
    if (b.shiftDown !== a.shiftDown) lines.push(`shiftDown ${b.shiftDown || 0}→${a.shiftDown || 0}`);
    if (b.iframeH !== a.iframeH) lines.push(`iframeH ${b.iframeH}→${a.iframeH}`);
    const c = before?.chart || {};
    const d = after?.chart || {};
    if (c.stageH !== d.stageH) lines.push(`chartH ${c.stageH}→${d.stageH}`);
    if (c.top !== d.top) lines.push(`chartTop ${c.top}→${d.top}`);
    return lines.length ? `${id}: ${lines.join(', ')}` : null;
  }

  function bindSlider(id, section, key, onChange) {
    const input = document.getElementById(id);
    const out = document.getElementById(`${id}Out`);
    if (!input) return;
    const handler = () => {
      if (!isCropEditAllowed()) {
        toast('D\u00fczenlemek i\u00e7in \u015fifre girin');
        syncSlidersFromCurrent();
        return;
      }
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
      if (!isCropEditAllowed()) {
        toast('D\u00fczenlemek i\u00e7in \u015fifre girin');
        syncSlidersFromCurrent();
        return;
      }
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

  function updateFamilyTabs() {
    panelEl?.querySelectorAll('[data-crop-family]').forEach((btn) => {
      const fam = btn.getAttribute('data-crop-family');
      const active = fam === editingFamily;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    panelEl?.querySelectorAll('[data-crop-profile]').forEach((btn) => {
      const id = btn.getAttribute('data-crop-profile');
      const inFam = profilesInFamily(editingFamily).includes(id);
      btn.classList.toggle('hidden', !inFam);
    });
    const chartHead = panelEl?.querySelector('.crop-chart-head');
    if (chartHead) {
      chartHead.textContent =
        editingFamily === 'gecko' ? 'Grafik (GeckoTerminal embed)' : 'Grafik (DexScreener embed)';
    }
  }

  function updateProfileTabs() {
    updateFamilyTabs();
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
      const fam = cropEmbedFamily();
      det.textContent = `Otomatik: ${PROFILE_META[auto]?.label || auto} · ${fam === 'gecko' ? 'Gecko' : 'Dex'} (${window.innerWidth}x${window.innerHeight})`;
    }
  }

  function switchFamily(nextFamily) {
    if (nextFamily !== 'dex' && nextFamily !== 'gecko') return;
    if (nextFamily === editingFamily) return;
    if (isCropEditAllowed()) saveBlock(editingProfile, current);
    editingFamily = nextFamily;
    const order = profilesInFamily(editingFamily);
    if (!order.includes(editingProfile)) {
      editingProfile = order[0];
      current = loadForProfile(editingProfile);
      syncSlidersFromCurrent();
      apply(current);
    }
    updateProfileTabs();
    refreshPreview();
  }

  function switchProfile(nextId) {
    if (!PROFILE_META[nextId] || nextId === editingProfile) return;
    if (!isCropEditAllowed()) {
      toast('Profil de\u011fi\u015ftirmek i\u00e7in \u00f6nce \u015fifre girin');
      return;
    }
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
    if (!isCropEditAllowed()) {
      toast('D\u00fczenlemek i\u00e7in \u015fifre girin');
      return;
    }
    current = loadForProfile(sourceId);
    syncSlidersFromCurrent();
    apply(current);
    refreshPreview();
    toast(`${PROFILE_META[sourceId].label} -> ${PROFILE_META[editingProfile].label} kopyalandi (Kaydet)`);
  }

  function openPanel() {
    if (!isDetailOpen() && !calibrateFromUrl()) return;
    enableCalibrateSession();
    if (!panelBuilt) buildPanel();
    editingProfile = profileFromUrl() || detectProfile();
    editingFamily = profileFamily(editingProfile);
    baselineProfiles = clone(loadStore().profiles);
    current = loadForProfile(editingProfile);
    syncSlidersFromCurrent();
    apply(current);
    updateProfileTabs();
    panelEl.classList.remove('hidden');
    document.documentElement.classList.add('crop-panel-open');
    updateCropFabVisibility();
    refreshPreview();
    void loadCropPinPolicy().then(() => applyPanelEditLock());
  }

  function closePanel() {
    panelEl?.classList.add('hidden');
    document.documentElement.classList.remove('crop-panel-open');
    const pid = refreshCropProfile();
    apply(loadForProfile(pid));
    if (
      !calibrateFromUrl()
      && document.documentElement.dataset.cropAdmin !== '1'
      && !isFounderOrAdminSession()
    ) {
      clearCalibrateSession();
    }
    updateCropFabVisibility();
    if (isDetailOpen()) runHiddenMotor();
  }

  function refreshPreview() {
    const pre = document.getElementById('cropJsonPreview');
    if (!pre) return;
    const store = loadStore();
    store.profiles[editingProfile] = clone(current);
    const diff = [];
    if (baselineProfiles) {
      PROFILE_ORDER.forEach((id) => {
        const line = tradesDiffLine(id, baselineProfiles[id], store.profiles[id]);
        if (line) diff.push(line);
      });
    }
    pre.textContent = JSON.stringify(
      {
        activeProfile: detectProfile(),
        editingProfile,
        diffFromOpen: diff.length ? diff : ['(henüz fark yok)'],
        profiles: store.profiles,
      },
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
      '<header class="dex-crop-head"><strong>K\u0131rpma motoru</strong>',
      '<button type="button" class="crop-close" id="cropCloseBtn" aria-label="Kapat">\u00d7</button></header>',
      '<p class="crop-intro"><b>Dex</b> = Telegram / DexScreener. <b>Gecko</b> = taray\u0131c\u0131. Her sekmede cihaz profilleri ayr\u0131 kaydedilir.</p>',
      '<p class="crop-pin-hint hidden" id="cropPinHint">Panel a\u00e7\u0131k \u2014 d\u00fczenlemek i\u00e7in \u015eifre gir.</p>',
      '<button type="button" class="crop-btn crop-btn-pin" id="cropPinUnlockBtn">\u015eifre gir</button>',
      '<p class="crop-detect" id="cropDetectLabel"></p>',
      '<div class="crop-family-tabs" role="tablist">',
      '<button type="button" class="crop-family-tab active" data-crop-family="dex" role="tab">DexScreener</button>',
      '<button type="button" class="crop-family-tab" data-crop-family="gecko" role="tab">GeckoTerminal</button>',
      `</${D}>`,
      '<div class="crop-profile-tabs" role="tablist">',
      ...PROFILE_ORDER.map(
        (id) =>
          `<button type="button" class="crop-profile-tab" data-crop-profile="${id}" role="tab">${PROFILE_META[id].label}</button>`,
      ),
      `</${D}>`,
      '<p class="crop-profile-hint" id="cropProfileHint"></p>',
      '<section class="crop-section"><h3 class="crop-chart-head">Grafik (DexScreener embed)</h3>',
      sliderRow('Kutu y\u00fcksekli\u011fi', 'cropChartStageH', 240, 480, 2, c.stageH, 'px'),
      sliderRow('\u00dcst kayd\u0131r', 'cropChartTop', -180, 40, 1, c.top, 'px \u2014 negatif = yukar\u0131'),
      sliderRow('A\u015fa\u011f\u0131 kayd\u0131r', 'cropChartDown', 0, 200, 1, c.shiftDown, 'px \u2014 grafik i\u00e7eri\u011fi'),
      sliderRow('Sol kayd\u0131r (%)', 'cropChartLeft', -16, 12, 1, c.left, 'grafik konumu'),
      sliderRow('Geni\u015flik (%)', 'cropChartWidth', 88, 120, 1, c.width, 'daralt / geni\u015flet'),
      sliderRow('Sol kenar k\u0131rp', 'cropChartClipL', 0, 80, 1, c.clipLeft, 'px'),
      sliderRow('Sa\u011f kenar k\u0131rp', 'cropChartClipR', 0, 80, 1, c.clipRight, 'px'),
      sliderRow('Yukar\u0131 daralt', 'cropChartClipT', 0, 100, 1, c.clipTop, 'px \u2014 \u00fcstten kes'),
      sliderRow('A\u015fa\u011f\u0131 daralt', 'cropChartClipB', 0, 100, 1, c.clipBottom, 'px \u2014 alttan kes'),
      sliderRow('\u00dcst marka k\u0131rp', 'cropChartBrand', 0, 64, 1, c.brandCrop, 'Harici grafik \u015feridi'),
      sliderRow('Ekstra y\u00fckseklik', 'cropChartExtra', 0, 48, 1, c.heightExtra, 'px'),
      '</section>',
      '<section class="crop-section crop-section--tape"><h3>Al\u0131m / sat\u0131m panosu</h3>',
      '<p class="crop-section-note">LIVE kutusu \u2014 i\u015flem tablosu hizas\u0131.</p>',
      sliderRow('G\u00f6r\u00fcn\u00fcr y\u00fckseklik', 'cropTradesViewH', 160, 380, 2, t.viewH, 'px \u2014 kutu'),
      sliderRow('Iframe y\u00fckseklik', 'cropTradesIframeH', 700, 1200, 5, t.iframeH, 'px'),
      sliderRow('Iframe \u00fcst', 'cropTradesTop', -1400, -200, 5, t.iframeTop, 'negatif = tablo yukar\u0131'),
      sliderRow('A\u015fa\u011f\u0131 kayd\u0131r', 'cropTradesDown', 0, 250, 1, t.shiftDown, 'px \u2014 tablo i\u00e7eri\u011fi'),
      sliderRow('Sol kayd\u0131r (%)', 'cropTradesLeft', -16, 12, 1, t.left, ''),
      sliderRow('Geni\u015flik (%)', 'cropTradesWidth', 88, 120, 1, t.width, ''),
      sliderRow('Sol kenar k\u0131rp', 'cropTradesClipL', 0, 80, 1, t.clipLeft, 'px'),
      sliderRow('Sa\u011f kenar k\u0131rp', 'cropTradesClipR', 0, 80, 1, t.clipRight, 'px'),
      sliderRow('Yukar\u0131 daralt', 'cropTradesClipT', 0, 100, 1, t.clipTop, 'px'),
      sliderRow('A\u015fa\u011f\u0131 daralt', 'cropTradesClipB', 0, 100, 1, t.clipBottom, 'px'),
      toggleRow('\u00dcst maske a\u00e7\u0131k', 'cropTradesMaskTopOn', t.maskTopOn !== false),
      sliderRow('\u00dcst maske kal\u0131nl\u0131k', 'cropTradesMaskTop', 0, 80, 1, t.maskTop, 'px'),
      toggleRow('Alt maske a\u00e7\u0131k', 'cropTradesMaskFootOn', t.maskFootOn !== false),
      sliderRow('Alt maske kal\u0131nl\u0131k', 'cropTradesMaskFoot', 0, 60, 1, t.maskFoot, 'px'),
      '</section>',
      '<section class="crop-section crop-section--dex"><h3>Kutu sayfada (iste\u011fe ba\u011fl\u0131)</h3>',
      '<p class="crop-section-note">T\u00fcm LIVE kutusunu grafik alt\u0131nda kayd\u0131r\u0131r.</p>',
      sliderRow('Kutu a\u015fa\u011f\u0131 kayd\u0131r', 'cropTapeDown', 0, 200, 1, tp.shiftDown, 'px'),
      '</section>',
      `<${D} class="crop-actions">`,
      '<button type="button" class="crop-btn crop-btn-save" id="cropSaveBtn">Bu profili kaydet</button>',
      '<button type="button" class="crop-btn crop-btn-publish" id="cropSpreadRefBtn">Referans \u2192 5 cihaz</button>',
      '<button type="button" class="crop-btn crop-btn-publish" id="cropPublishBtn">Sunucuya sabitle (5 profil)</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropExportRefBtn">Referans JSON kopyala</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopyWebBtn">Web \u2192</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopy13pmBtn">13 PM \u2192</button>',
      '<button type="button" class="crop-btn crop-btn-copy" id="cropCopy16pmBtn">16 PM \u2192</button>',
      '<button type="button" class="crop-btn" id="cropCopyBtn">T\u00fcm JSON</button>',
      '<button type="button" class="crop-btn crop-btn-muted" id="cropResetProfBtn">Profil s\u0131f\u0131rla</button>',
      '<button type="button" class="crop-btn crop-btn-muted" id="cropResetAllBtn">Hepsini s\u0131f\u0131rla</button>',
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
    panelEl.querySelectorAll('[data-crop-family]').forEach((btn) => {
      btn.addEventListener('click', () => switchFamily(btn.getAttribute('data-crop-family')));
    });

    document.getElementById('cropCloseBtn')?.addEventListener('click', closePanel);
    document.getElementById('cropPinUnlockBtn')?.addEventListener('click', () => {
      void promptCropSavePin(true);
    });
    document.getElementById('cropSaveBtn')?.addEventListener('click', async () => {
      const pin = await promptCropSavePin(true);
      if (pin === null) return;
      saveBlock(editingProfile, current);
      try {
        await publishServerProfiles(pin === '__session__' ? '' : pin);
        baselineProfiles = clone(loadStore().profiles);
        refreshPreview();
        toast(`${PROFILE_META[editingProfile].label} kaydedildi + sunucu güncellendi`);
      } catch (e) {
        toast(`${PROFILE_META[editingProfile].label} yerelde kayıtlı — sunucu: ${e.message || 'hata'}`);
      }
    });
    document.getElementById('cropPublishBtn')?.addEventListener('click', async () => {
      const pin = await promptCropSavePin(true);
      if (pin === null) return;
      try {
        await publishServerProfiles(pin === '__session__' ? '' : pin);
        baselineProfiles = clone(loadStore().profiles);
        refreshPreview();
        toast('Tum profiller sunucuya yazildi (json + baked.js) — redeploy');
      } catch (e) {
        toast(e.message || 'Sunucuya kayıt başarısız');
      }
    });
    document.getElementById('cropSpreadRefBtn')?.addEventListener('click', async () => {
      const pin = await promptCropSavePin(true);
      if (pin === null) return;
      const refId = editingProfile;
      const refWidth = cropLayoutWidth();
      try {
        const r = await fetch('/api/crop-profiles/scale-reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refProfile: refId,
            refBlock: current,
            refWidth,
            family: editingFamily,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || data.error || 'scale failed');
        const store = loadStore();
        profilesInFamily(editingFamily).forEach((id) => {
          if (data.profiles?.[id]) store.profiles[id] = normalizeBlock(data.profiles[id]);
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        baselineProfiles = clone(store.profiles);
        syncSlidersFromCurrent();
        apply(current);
        refreshPreview();
        const famLabel = editingFamily === 'gecko' ? 'Gecko' : 'Dex';
        toast(`Referans (${PROFILE_META[refId].label}, ${refWidth}px) → 5 ${famLabel} cihaz. Sunucuya sabitle.`);
      } catch (e) {
        toast(e.message || '5 cihaza yayma başarısız');
      }
    });
    document.getElementById('cropExportRefBtn')?.addEventListener('click', async () => {
      const payload = {
        refProfile: editingProfile,
        refWidth: cropLayoutWidth(),
        refBlock: clone(current),
        userAgent: navigator.userAgent,
        telegram: {
          platform: global.Telegram?.WebApp?.platform,
          viewportWidth: global.Telegram?.WebApp?.viewportWidth,
          viewportHeight: global.Telegram?.WebApp?.viewportHeight,
        },
      };
      const text = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        toast('Referans JSON kopyalandı — geliştiriciye yapıştır');
      } catch {
        const pre = document.getElementById('cropJsonPreview');
        if (pre) pre.textContent = text;
        toast('Panoya yazılamadı — alttaki JSON’u kopyala');
      }
    });
    document.getElementById('cropCopyWebBtn')?.addEventListener('click', () => copyProfileFrom('web'));
    document.getElementById('cropCopy13pmBtn')?.addEventListener('click', () => copyProfileFrom('app13pm'));
    document.getElementById('cropCopy16pmBtn')?.addEventListener('click', () => copyProfileFrom('app16'));
    document.getElementById('cropResetProfBtn')?.addEventListener('click', async () => {
      const pin = await promptCropSavePin(true);
      if (pin === null) return;
      current = resetProfile(editingProfile);
      syncSlidersFromCurrent();
      apply(current);
      refreshPreview();
      toast('Bu profil sifirlandi');
    });
    document.getElementById('cropResetAllBtn')?.addEventListener('click', async () => {
      const pin = await promptCropSavePin(true);
      if (pin === null) return;
      current = reset();
      editingProfile = detectProfile();
      current = loadForProfile(editingProfile);
      syncSlidersFromCurrent();
      updateProfileTabs();
      refreshPreview();
      toast('5 profil sifirlandi');
    });
    applyPanelEditLock();
    document.getElementById('cropCopyBtn')?.addEventListener('click', async () => {
      const store = loadStore();
      store.profiles[editingProfile] = clone(current);
      const text = JSON.stringify(store, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        toast('5 profil JSON kopyalandi');
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
    syncCropUi();
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
    const urlCal = calibrateFromUrl();
    if (!urlCal) {
      clearCalibrateSession();
      delete document.documentElement.dataset.cropAdmin;
      clearLayoutSession();
    }
    if (global.SniperCropProfile?.apply) global.SniperCropProfile.apply();
    await ensureProfilesReady();
    apply();
    bindCropObservers();
    bindMotorOnEmbedReady();
    bindCalibrateGesture();
    bindStaticCropButtons();
    await loadCropPinPolicy();
    const uiSt = getCropUiState();
    if (uiSt === 'on') enableCalibrateSession();
    if (uiSt === 'stealth') document.documentElement.dataset.cropStealth = '1';
    if (urlCal) {
      enableCalibrateSession();
      syncCropUi();
    } else {
      removeCalibrateButton();
      scheduleCalibrateAccess();
    }
    window.addEventListener('resize', () => {
      if (cropPanelIsOpen()) return;
      if (!isDetailOpen()) return;
      handleCropProfileChange();
      const pid = refreshCropProfile();
      apply(loadForProfile(pid));
      if (!layoutSessionDone(pid)) ensureMotorOnce();
    });
    if (urlCal) {
      setTimeout(() => {
        syncCropUi();
        openPanel();
      }, 1200);
    }
    const vd = document.getElementById('view-detail');
    if (vd) {
      new MutationObserver(() => {
        if (vd.classList.contains('hidden')) {
          updateCropFabVisibility();
          return;
        }
        onDetailOpen();
        ensureMotorOnce();
      }).observe(vd, { attributes: true, attributeFilter: ['class'] });
      if (!vd.classList.contains('hidden')) {
        onDetailOpen();
        ensureMotorOnce();
      }
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
    refreshCropProfile,
    applyCropNow,
    applyForProvider,
    cropEmbedFamily,
    profileFamily,
    DEX_PROFILE_ORDER,
    GECKO_PROFILE_ORDER,
    shouldSkipAutoCrop,
    cropPanelIsOpen,
    handleCropProfileChange,
    runHiddenMotor,
    ensureMotorOnce,
    scheduleMotorCrop,
    clearLayoutSession,
    openPanel,
    closePanel,
    copyProfileFrom,
    isCalibrateMode,
    calibrateFromUrl,
    isCalibrateUrl: calibrateFromUrl,
    enableCalibrateSession,
    clearCalibrateSession,
    addCalibrateButton,
    onDetailOpen,
    scheduleCalibrateAccess,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})(window);
