/**
 * Safe area — expanded: content-top 0 (TG bar altı); fullscreen: notch → --tg-safe-top.
 * Bir kez kilitle, kayma yok.
 */
(function () {
  let locked = false;
  let lockedContentTop = 0;
  let lockedBgTop = 0;
  let lockedBottom = 0;
  let lockedLeft = 0;
  let lockedRight = 0;

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

  function resolveInsets(tg, inTg) {
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
    const bgBleedTop = inTg ? Math.max(sTop, envTop, 0) : Math.max(envTop, 0);
    const bottom = Math.max(sBottom, envBottom);

    if (!inTg) {
      return {
        bgBleedTop,
        contentTop: Math.min(envTop, 12),
        bottom,
        cLeft: 0,
        cRight: 0,
      };
    }

    const fullscreen = !!tg.isFullscreen;

    if (fullscreen) {
      let contentTop = 0;
      if (cTop >= 8 && cTop <= 72) contentTop = cTop;
      else if (sTop >= 8) contentTop = sTop;
      return {
        bgBleedTop,
        contentTop,
        bottom,
        cLeft,
        cRight,
      };
    }

    /* Expanded — Telegram bar görünür; notch header padding'e eklenmez */
    return {
      bgBleedTop,
      contentTop: 0,
      bottom,
      cLeft: 0,
      cRight: 0,
    };
  }

  function paint(root, vals) {
    root.style.setProperty('--sniper-bg-bleed-top', `${vals.bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${vals.bottom}px`);
    root.style.setProperty('--sniper-content-top', `${vals.contentTop}px`);
    root.style.setProperty('--sniper-content-bottom', '0px');
    root.style.setProperty('--tg-safe-top', `${vals.bgBleedTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${vals.bottom}px`);
    root.style.setProperty('--tg-content-safe-top', `${vals.contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', '0px');
    root.style.setProperty('--tg-content-safe-left', `${vals.cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${vals.cRight}px`);
    root.dataset.safeContentTop = String(vals.contentTop);
    root.dataset.safeBgTop = String(vals.bgBleedTop);
  }

  function apply() {
    const root = document.documentElement;
    if (locked) {
      paint(root, {
        bgBleedTop: lockedBgTop,
        contentTop: lockedContentTop,
        bottom: lockedBottom,
        cLeft: lockedLeft,
        cRight: lockedRight,
      });
      return;
    }

    const tg = window.Telegram?.WebApp;
    const inTg = isTelegramHost() && tg;
    paint(root, resolveInsets(tg, inTg));
  }

  function unlockLayout() {
    locked = false;
    apply();
  }

  function lockLayout() {
    if (locked) return;
    const root = document.documentElement;
    lockedContentTop = parseInt(root.dataset.safeContentTop || '0', 10) || 0;
    lockedBgTop = parseInt(root.dataset.safeBgTop || '0', 10) || 0;
    lockedBottom = parseInt(
      getComputedStyle(root).getPropertyValue('--tg-safe-bottom') || '0',
      10,
    ) || 0;
    lockedLeft = parseInt(
      getComputedStyle(root).getPropertyValue('--tg-content-safe-left') || '0',
      10,
    ) || 0;
    lockedRight = parseInt(
      getComputedStyle(root).getPropertyValue('--tg-content-safe-right') || '0',
      10,
    ) || 0;
    locked = true;
    apply();
  }

  function scheduleRetries() {
    apply();
    setTimeout(apply, 200);
    setTimeout(() => {
      apply();
      lockLayout();
    }, 500);
  }

  window.SniperSafeArea = { apply, lockLayout, unlockLayout, measureEnvInset, scheduleRetries };

  apply();
  setTimeout(lockLayout, 700);

  window.addEventListener('sniper-host-changed', () => {
    if (!window.SniperHost?.isWebBrowser?.()) scheduleRetries();
  });

  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.onEvent === 'function') {
    tg.onEvent('fullscreenChanged', () => {
      unlockLayout();
      apply();
      setTimeout(lockLayout, 500);
    });
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
