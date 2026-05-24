/**
 * Dex kırpma — profil tespiti + baked CSS değişkenleri (CSS yüklenmeden önce).
 * dex-crop.js DOM/iframe üzerine !important uygular; burada sadece :root değişkenleri.
 */
(function (global) {
  const ORDER = [
    'web',
    'webgecko',
    'app11',
    'app11gecko',
    'app13',
    'app13gecko',
    'app13pm',
    'app13pmgecko',
    'app16',
    'app16gecko',
  ];

  function getBakedProfiles() {
    const g = global.__DEX_CROP_BAKED__ || globalThis.__DEX_CROP_BAKED__;
    return g?.profiles || null;
  }

  function applyRootVars(block) {
    if (!block) return;
    const root = document.documentElement;
    const c = block.chart || {};
    const t = block.trades || {};
    const tape = block.tape || {};
    root.style.setProperty('--chart-embed-h', `${Number(c.stageH) || 330}px`);
    root.style.setProperty('--chart-embed-top', `${Number(c.top) || 0}px`);
    root.style.setProperty('--chart-shift-down', `${Number(c.shiftDown) || 0}px`);
    root.style.setProperty('--chart-embed-left', `${Number(c.left) || 0}%`);
    root.style.setProperty('--chart-embed-width', `${Number(c.width) || 100}%`);
    root.style.setProperty('--chart-embed-extra', `${Number(c.heightExtra) || 0}px`);
    root.style.setProperty('--chart-brand-crop', `${Number(c.brandCrop) || 40}px`);
    root.style.setProperty('--tape-shift-down', `${Number(tape.shiftDown) || 0}px`);
    root.style.setProperty('--dex-trades-view-h', `${Number(t.viewH) || 302}px`);
    root.style.setProperty('--dex-iframe-h', `${Number(t.iframeH) || 845}px`);
    root.style.setProperty('--dex-iframe-top', `${Number(t.iframeTop) || -590}px`);
    root.style.setProperty('--dex-trades-shift-down', `${Number(t.shiftDown) || 0}px`);
    root.style.setProperty('--dex-iframe-left', `${Number(t.left) || 0}%`);
    root.style.setProperty('--dex-iframe-width', `${Number(t.width) || 100}%`);
    root.style.setProperty('--dex-mask-top-h', `${Number(t.maskTop) || 0}px`);
    root.style.setProperty('--dex-mask-foot-h', `${Number(t.maskFoot) || 0}px`);
  }

  function cropEmbedFamily() {
    return 'dex';
  }

  function detectProfileId() {
    if (global.SniperCropProfile?.apply) return global.SniperCropProfile.apply();
    try {
      const q = new URLSearchParams(location.search);
      const id = String(q.get('profil') || q.get('profile') || '').trim();
      if (ORDER.includes(id)) {
        document.documentElement.dataset.dexCropProfile = id;
        return id;
      }
    } catch {
      /* yoksay */
    }
    const id = document.documentElement.dataset.dexCropProfile || 'web';
    return ORDER.includes(id) ? id : 'web';
  }

  function applyEarly() {
    const profiles = getBakedProfiles();
    if (!profiles) return;
    const id = detectProfileId();
    document.documentElement.dataset.dexCropProfile = id;
    const fam = cropEmbedFamily();
    const fallback = fam === 'gecko' ? profiles.webgecko : profiles.web;
    applyRootVars(profiles[id] || fallback || profiles.web);
  }

  applyEarly();
  global.SniperDexCropEarly = { applyEarly, applyRootVars, detectProfileId };

  if (global.SniperCropProfile) {
    const orig = global.SniperCropProfile.applyWhenReady;
    global.SniperCropProfile.applyWhenReady = function patchedApplyWhenReady() {
      if (typeof orig === 'function') orig.call(global.SniperCropProfile);
      else global.SniperCropProfile.apply();
      applyEarly();
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
