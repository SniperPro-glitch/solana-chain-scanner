/**
 * Üst çentik / Dynamic Island — arka plan yukarı, içerik aşağı (cihaza göre otomatik).
 * iPhone 11: API 0 ise ekstra boşluk yok. 16 Pro Max: safeArea + contentSafe kullanılır.
 */
(function () {
  function measureEnvInset(prop) {
    try {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-top:${prop}`;
      document.documentElement.appendChild(el);
      const v = parseFloat(getComputedStyle(el).paddingTop) || 0;
      el.remove();
      return Math.round(v);
    } catch (_) {
      return 0;
    }
  }

  function isTelegramHost() {
    return window.SniperHost?.isTelegram?.()
      || window.SniperTgLaunch?.hasLaunchData?.()
      || !!String(window.Telegram?.WebApp?.initData || '').trim();
  }

  function cropProfile() {
    return String(document.documentElement.dataset.dexCropProfile || '').trim();
  }

  function safeTier(bgTop, contentTop) {
    const m = Math.max(bgTop, contentTop);
    if (m >= 52) return 'island';
    if (m >= 36) return 'notch';
    if (m >= 12) return 'light';
    return 'none';
  }

  /** API boşken yalnızca büyük çentik / island cihazlarda hafif fallback */
  function profileFallbackContent(bgTop, apiContent) {
    if (apiContent >= 12) return apiContent;
    const p = cropProfile();
    if (bgTop >= 54 || p === 'app16') return Math.max(apiContent, bgTop >= 47 ? 52 : 0);
    if (bgTop >= 44 || p === 'app13pm') return Math.max(apiContent, bgTop >= 40 ? 44 : 0);
    if (p === 'app11' || p === 'app13') return 0;
    if (bgTop >= 36) return Math.max(apiContent, 20);
    return apiContent;
  }

  function apply() {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    const inTg = isTelegramHost() && tg;

    let sTop = 0;
    let sBottom = 0;
    let cTop = 0;
    let cBottom = 0;
    let cLeft = 0;
    let cRight = 0;

    if (inTg) {
      const sa = tg.safeAreaInset || {};
      const csa = tg.contentSafeAreaInset || {};
      sTop = Math.round(Number(sa.top) || 0);
      sBottom = Math.round(Number(sa.bottom) || 0);
      cTop = Math.round(Number(csa.top) || 0);
      cBottom = Math.round(Number(csa.bottom) || 0);
      cLeft = Math.round(Number(csa.left) || 0);
      cRight = Math.round(Number(csa.right) || 0);
    }

    const envTop = measureEnvInset('env(safe-area-inset-top)');
    const envBottom = measureEnvInset('env(safe-area-inset-bottom)');

    const bgBleedTop = Math.max(sTop, envTop);
    const bgBleedBottom = Math.max(sBottom, envBottom);

    let contentTop = cTop;
    if (inTg) {
      contentTop = profileFallbackContent(bgBleedTop, cTop);
    } else {
      contentTop = envTop;
    }

    const tier = safeTier(bgBleedTop, contentTop);

    root.style.setProperty('--sniper-bg-bleed-top', `${bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${bgBleedBottom}px`);
    root.style.setProperty('--sniper-content-top', `${contentTop}px`);
    root.style.setProperty('--sniper-content-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-safe-top', `${bgBleedTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${bgBleedBottom}px`);
    root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left', `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);
    root.dataset.safeTier = tier;
    root.dataset.safeBgTop = String(bgBleedTop);
    root.dataset.safeContentTop = String(contentTop);
  }

  window.SniperSafeArea = { apply, measureEnvInset };

  apply();
  window.addEventListener('sniper-host-changed', () => apply());
  window.addEventListener('resize', () => {
    clearTimeout(window.__sniperSafeAreaResize);
    window.__sniperSafeAreaResize = setTimeout(apply, 80);
  });
})();
