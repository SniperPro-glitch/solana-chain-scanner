/**
 * Üst çentik: arka plan yukarı (bg bleed), içerik aşağı (content-top) — cihaza göre.
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

  function layoutWidth() {
    const tg = window.Telegram?.WebApp;
    return Math.round(Math.max(window.innerWidth || 0, tg?.viewportWidth || 0)) || 390;
  }

  function safeTier(bgTop, contentTop, w) {
    const m = Math.max(bgTop, contentTop);
    const p = cropProfile();
    if (m >= 52 || (w >= 428 && (p === 'app16' || p === 'app13pm'))) return 'island';
    if (m >= 36 || w >= 414) return 'notch';
    if (m >= 12) return 'light';
    return 'none';
  }

  function resolveContentTop(tg, sTop, cTop) {
    if (!window.SniperHost?.isTelegram?.()) {
      return Math.min(measureEnvInset('env(safe-area-inset-top)') || 0, 12);
    }

    const fullscreen = !!tg?.isFullscreen;
    if (fullscreen) {
      if (cTop >= 8) return Math.min(Math.max(cTop, sTop), 72);
      return Math.min(Math.max(sTop, 44), 72);
    }

    /* Genişletilmiş: TG viewport zaten X Kapat altında — sadece makul contentSafeArea */
    if (cTop >= 8 && cTop <= 72) return cTop;
    if (cTop > 72) return 72;
    return 0;
  }

  function apply() {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    const inTg = isTelegramHost() && tg;
    const w = layoutWidth();

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

    let bgBleedTop = Math.max(sTop, envTop);
    let contentTop = inTg ? resolveContentTop(tg, sTop, cTop) : envTop;

    if (inTg && sTop > 0) bgBleedTop = Math.max(bgBleedTop, sTop);

    const tier = safeTier(bgBleedTop, contentTop, w);

    root.style.setProperty('--sniper-bg-bleed-top', `${bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${Math.max(sBottom, envBottom)}px`);
    root.style.setProperty('--sniper-content-top', `${contentTop}px`);
    root.style.setProperty('--sniper-content-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-safe-top', `${bgBleedTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${Math.max(sBottom, envBottom)}px`);
    root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left', `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);
    root.dataset.safeTier = tier;
    root.dataset.safeBgTop = String(bgBleedTop);
    root.dataset.safeContentTop = String(contentTop);
  }

  function scheduleRetries() {
    let n = 0;
    const tick = () => {
      n += 1;
      apply();
      if (n < 12) setTimeout(tick, n < 4 ? 80 : 200);
    };
    tick();
  }

  window.SniperSafeArea = { apply, measureEnvInset, scheduleRetries };

  apply();
  scheduleRetries();
  window.addEventListener('sniper-host-changed', scheduleRetries);
  window.addEventListener('resize', () => {
    clearTimeout(window.__sniperSafeAreaResize);
    window.__sniperSafeAreaResize = setTimeout(apply, 80);
  });

  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.onEvent === 'function') {
    ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged'].forEach((ev) => {
      tg.onEvent(ev, apply);
    });
  }
})();
