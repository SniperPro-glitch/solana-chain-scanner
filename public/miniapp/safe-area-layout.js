/**
 * Safe area — bir kez ölç, kilitle (kayma yok).
 * Arka plan bleed yukarı; header padding = contentSafeArea (TG) veya tek sabit taban.
 */
(function () {
  const TG_CHROME_FALLBACK = 52;
  let locked = false;
  let lockedContentTop = 0;
  let lockedBgTop = 0;
  let lockedBottom = 0;

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

  function layoutWidth() {
    const tg = window.Telegram?.WebApp;
    return Math.round(Math.max(window.innerWidth || 0, tg?.viewportWidth || 0)) || 390;
  }

  function resolveContentTop(tg, sTop, cTop) {
    if (!window.SniperHost?.isTelegram?.()) {
      return Math.min(measureEnvInset('env(safe-area-inset-top)') || 0, 12);
    }

    if (cTop >= 8 && cTop <= 72) return cTop;

    const w = layoutWidth();
    if (w >= 429) return 56;
    if (w >= 426) return 52;
    if (w >= 400) return 48;
    if (sTop >= 8) return Math.min(sTop + 44, 72);
    return TG_CHROME_FALLBACK;
  }

  function resolveBgBleedTop(sTop, envTop, inTg) {
    if (!inTg) return Math.max(envTop, 0);
    return Math.max(sTop, envTop, 0);
  }

  function paint(root, bgBleedTop, contentTop, bottom, cLeft, cRight) {
    root.style.setProperty('--sniper-bg-bleed-top', `${bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${bottom}px`);
    root.style.setProperty('--sniper-content-top', `${contentTop}px`);
    root.style.setProperty('--sniper-content-bottom', '0px');
    root.style.setProperty('--tg-safe-top', `${bgBleedTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${bottom}px`);
    root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', '0px');
    root.style.setProperty('--tg-content-safe-left', `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);
    root.style.setProperty('--tg-chrome-left', `${Math.max(cLeft, 48)}px`);
    root.dataset.safeContentTop = String(contentTop);
    root.dataset.safeBgTop = String(bgBleedTop);
  }

  function apply() {
    const root = document.documentElement;
    if (locked) {
      paint(root, lockedBgTop, lockedContentTop, lockedBottom, 0, 0);
      return;
    }

    const tg = window.Telegram?.WebApp;
    const inTg = isTelegramHost() && tg;

    let sTop = 0;
    let sBottom = 0;
    let cTop = 0;
    let cLeft = 0;
    let cRight = 0;

    if (inTg) {
      const sa = tg.safeAreaInset || {};
      const csa = tg.contentSafeAreaInset || {};
      sTop = Math.round(Number(sa.top) || 0);
      sBottom = Math.round(Number(sa.bottom) || 0);
      cTop = Math.round(Number(csa.top) || 0);
      cLeft = Math.round(Number(csa.left) || 0);
      cRight = Math.round(Number(csa.right) || 0);
    }

    const envTop = measureEnvInset('env(safe-area-inset-top)');
    const envBottom = measureEnvInset('env(safe-area-inset-bottom)');
    const bgBleedTop = resolveBgBleedTop(sTop, envTop, inTg);
    const contentTop = inTg ? resolveContentTop(tg, sTop, cTop) : Math.min(envTop, 12);
    const bottom = Math.max(sBottom, envBottom);

    paint(root, bgBleedTop, contentTop, bottom, cLeft, cRight);
  }

  function lockLayout() {
    if (locked) return;
    const root = document.documentElement;
    lockedContentTop = parseInt(root.dataset.safeContentTop || '0', 10) || TG_CHROME_FALLBACK;
    lockedBgTop = parseInt(root.dataset.safeBgTop || '0', 10) || 0;
    lockedBottom = parseInt(
      getComputedStyle(root).getPropertyValue('--tg-safe-bottom') || '0',
      10,
    ) || 0;
    locked = true;
    paint(root, lockedBgTop, lockedContentTop, lockedBottom, 0, 0);
  }

  function scheduleRetries() {
    apply();
    setTimeout(apply, 200);
    setTimeout(() => {
      apply();
      lockLayout();
    }, 450);
  }

  window.SniperSafeArea = { apply, lockLayout, measureEnvInset, scheduleRetries };

  apply();
  setTimeout(lockLayout, 600);

  window.addEventListener('sniper-host-changed', () => {
    if (!window.SniperHost?.isWebBrowser?.()) scheduleRetries();
  });

  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', () => {
      if (!locked) apply();
    });
    tg.onEvent('safeAreaChanged', () => {
      if (!locked) apply();
    });
    tg.onEvent('contentSafeAreaChanged', () => {
      if (!locked) apply();
    });
  }
})();
