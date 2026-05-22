/**
 * Arka plan → status bar / TG üstüne bleed.
 * Tıklanabilir header → contentSafeArea (X Kapat altı), profil tabanı (16 PM kayma yok).
 */
(function () {
  const TG_CHROME_H = 46;
  const PROFILE_CONTENT_FLOOR = {
    app16: 56,
    app13pm: 52,
    app11: 48,
    app13: 44,
    web: 0,
  };
  const PROFILE_BG_BLEED = {
    app16: 59,
    app13pm: 47,
    app11: 44,
    app13: 44,
    web: 0,
  };

  let peakContentTop = 0;

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

  function profileFloor(w, profile) {
    const p = profile || cropProfile();
    if (PROFILE_CONTENT_FLOOR[p] != null) return PROFILE_CONTENT_FLOOR[p];
    if (w >= 429) return PROFILE_CONTENT_FLOOR.app16;
    if (w >= 426) return PROFILE_CONTENT_FLOOR.app13pm;
    if (w >= 400) return PROFILE_CONTENT_FLOOR.app11;
    return PROFILE_CONTENT_FLOOR.app13;
  }

  function profileBgBleed(w, profile) {
    const p = profile || cropProfile();
    if (PROFILE_BG_BLEED[p] != null) return PROFILE_BG_BLEED[p];
    if (w >= 429) return PROFILE_BG_BLEED.app16;
    if (w >= 426) return PROFILE_BG_BLEED.app13pm;
    if (w >= 400) return PROFILE_BG_BLEED.app11;
    return PROFILE_BG_BLEED.app13;
  }

  function safeTier(bgTop, contentTop, w) {
    const m = Math.max(bgTop, contentTop);
    const p = cropProfile();
    if (m >= 52 || (w >= 428 && (p === 'app16' || p === 'app13pm'))) return 'island';
    if (m >= 36 || w >= 414) return 'notch';
    if (m >= 12) return 'light';
    return 'none';
  }

  function clampTop(v, max) {
    const n = Math.round(Number(v) || 0);
    if (n <= 0) return 0;
    return Math.min(n, max || 80);
  }

  /**
   * Genişletilmiş: TG contentSafeArea öncelikli; yoksa notch + chrome + profil tabanı.
   * API fullscreen: contentSafeArea veya safeArea + taban.
   */
  function resolveContentTop(tg, sTop, cTop, w) {
    if (!window.SniperHost?.isTelegram?.()) {
      return Math.min(measureEnvInset('env(safe-area-inset-top)') || 0, 12);
    }

    const floor = profileFloor(w);
    const fullscreen = !!tg?.isFullscreen;

    if (fullscreen) {
      if (cTop >= 8) return clampTop(Math.max(cTop, sTop, floor), 80);
      if (sTop >= 20) return clampTop(Math.max(sTop, floor), 80);
      return clampTop(floor || 48, 80);
    }

    /* expand + X Kapat: içerik chrome altında */
    let top = 0;
    if (cTop >= 8 && cTop <= 80) {
      top = cTop;
    } else if (sTop >= 8) {
      top = sTop + TG_CHROME_H;
    } else {
      top = TG_CHROME_H;
    }

    top = Math.max(top, floor);
    return clampTop(top, 80);
  }

  function resolveBgBleedTop(sTop, envTop, w, inTg) {
    if (!inTg) return Math.max(envTop, 0);
    const fromTg = sTop > 0 ? sTop : 0;
    const fromEnv = envTop > 0 ? envTop : 0;
    const profileHint = profileBgBleed(w);
    return Math.max(fromTg, fromEnv, profileHint > 0 ? Math.min(profileHint, 64) : 0);
  }

  function stabilizeContentTop(next) {
    if (next > peakContentTop) peakContentTop = next;
    else if (peakContentTop >= 44 && next < peakContentTop - 2) return peakContentTop;
    return next;
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

    const bgBleedTop = resolveBgBleedTop(sTop, envTop, w, inTg);
    let contentTop = inTg ? resolveContentTop(tg, sTop, cTop, w) : Math.min(envTop, 12);
    contentTop = stabilizeContentTop(contentTop);

    const tier = safeTier(bgBleedTop, contentTop, w);
    const chromeLeft = inTg && !tg?.isFullscreen ? Math.max(cLeft, 0) : cLeft;

    root.style.setProperty('--sniper-bg-bleed-top', `${bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${Math.max(sBottom, envBottom)}px`);
    root.style.setProperty('--sniper-content-top', `${contentTop}px`);
    root.style.setProperty('--sniper-content-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-safe-top', `${bgBleedTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${Math.max(sBottom, envBottom)}px`);
    root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left', `${chromeLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);
    root.style.setProperty('--tg-chrome-left', `${Math.max(chromeLeft, 0)}px`);
    root.dataset.safeTier = tier;
    root.dataset.safeBgTop = String(bgBleedTop);
    root.dataset.safeContentTop = String(contentTop);
  }

  function scheduleRetries() {
    let n = 0;
    const tick = () => {
      n += 1;
      apply();
      if (n < 14) setTimeout(tick, n < 5 ? 80 : 220);
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
