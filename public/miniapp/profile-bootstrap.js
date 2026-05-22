/**
 * Kayıtlı profil — genişlik: max(innerWidth, TG viewportWidth).
 */
(function () {
  const IDS = ['web', 'app11', 'app13', 'app13pm', 'app16'];

  function fromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const id = String(q.get('profil') || q.get('profile') || '').trim();
      if (IDS.includes(id)) return id;
    } catch {
      /* yoksay */
    }
    return null;
  }

  function isTelegramApp() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;
    const p = String(tg.platform || '').toLowerCase();
    return ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  function layoutWidth() {
    const inner = Math.round(window.innerWidth || 0);
    const tgVp = Math.round(window.Telegram?.WebApp?.viewportWidth || 0);
    return Math.max(inner, tgVp) || 390;
  }

  function isTelegramDesktop() {
    const p = String(window.Telegram?.WebApp?.platform || '').toLowerCase();
    return ['macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  function detectByWidth(w) {
    if (w >= 429) return 'app16';
    if (w >= 426) return 'app13pm';
    if (w >= 400) return 'app11';
    return 'app13';
  }

  function detect() {
    const forced = fromUrl();
    if (forced) return forced;
    const w = layoutWidth();
    if (!isTelegramApp() && w > 500) return 'web';
    if (isTelegramApp() && isTelegramDesktop() && w > 500) return 'web';
    return detectByWidth(w);
  }

  function apply() {
    const id = detect();
    document.documentElement.dataset.dexCropProfile = id;
    document.documentElement.dataset.dexCropW = String(layoutWidth());
    return id;
  }

  /** TG: viewportWidth gelene kadar tekrar dene (erken app13 kilidi önlenir). */
  function applyWhenReady() {
    apply();
    if (document.documentElement.classList.contains('web-browser')) return;
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    let n = 0;
    const retry = () => {
      n += 1;
      const w = layoutWidth();
      if (w >= 390 || n >= 10) apply();
      else setTimeout(retry, 35);
    };
    if (typeof tg.ready === 'function') tg.ready();
    apply();
    setTimeout(retry, 0);
    setTimeout(retry, 120);
  }

  applyWhenReady();
  window.SniperCropProfile = { detect, apply, applyWhenReady, layoutWidth, IDS };
})();
