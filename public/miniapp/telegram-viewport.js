/**
 * Telegram Mini App — tam ekran (requestFullscreen).
 * Arka plan çentik üstüne taşar; içerik X/Kapat altında kalır (contentSafeArea).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg || window.SniperHost?.isWebBrowser?.()) return;

  const BG = '#060910';
  const root = document.documentElement;
  let fullscreenRequested = false;
  let viewportTimer = null;
  let profileTimer = null;

  function scheduleProfileApply() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
    }, 60);
  }

  function applyViewportHeight() {
    const h = tg.viewportStableHeight || tg.viewportHeight;
    if (h) root.style.setProperty('--app-height', `${h}px`);
  }

  function applySafeArea() {
    const sa = tg.safeAreaInset || {};
    const csa = tg.contentSafeAreaInset || {};
    const fullscreen = !!tg.isFullscreen;

    let sTop = Math.round(Number(sa.top) || 0);
    let sBottom = Math.round(Number(sa.bottom) || 0);
    let cTop = Math.round(Number(csa.top) || 0);
    let cBottom = Math.round(Number(csa.bottom) || 0);
    let cLeft = Math.round(Number(csa.left) || 0);
    let cRight = Math.round(Number(csa.right) || 0);

    let bgBleedTop;
    let contentTop;

    if (fullscreen) {
      if (cLeft < 44) cLeft = 56;
      if (cTop < 28) cTop = Math.max(sTop, 48);
      bgBleedTop = Math.max(sTop, cTop, 20);
      contentTop = cTop >= 8 ? Math.min(Math.max(cTop, sTop), 72) : Math.min(Math.max(sTop, 44), 72);
    } else {
      if (cTop > 20) cTop = 20;
      else if (cTop < 8) cTop = Math.max(sTop, 0);
      cLeft = 0;
      cRight = 0;
      bgBleedTop = Math.max(sTop, cTop);
      contentTop = cTop;
    }

    root.style.setProperty('--sniper-bg-bleed-top', `${bgBleedTop}px`);
    root.style.setProperty('--sniper-bg-bleed-bottom', `${Math.max(sBottom, 0)}px`);
    root.style.setProperty('--sniper-content-top', `${contentTop}px`);
    root.style.setProperty('--tg-safe-top', `${sTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${sBottom}px`);
    root.style.setProperty('--tg-content-safe-top', `${contentTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left', `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);

    applyViewportHeight();

    root.classList.toggle('tg-fullscreen', fullscreen);
    root.classList.toggle('tg-expanded', !fullscreen);
    root.dataset.tgViewport = fullscreen ? 'fullscreen' : 'expanded';
  }

  function setChromeColors() {
    try {
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
      if (typeof tg.setBottomBarColor === 'function') tg.setBottomBarColor(BG);
    } catch (_) {
      /* yoksay */
    }
  }

  function enterFullscreenMode() {
    if (typeof tg.expand === 'function') tg.expand();
    if (tg.isFullscreen) return;
    if (typeof tg.requestFullscreen !== 'function') return;
    if (fullscreenRequested) return;
    fullscreenRequested = true;
    try {
      tg.requestFullscreen();
    } catch (_) {
      fullscreenRequested = false;
    }
  }

  function applyViewport() {
    tg.ready();
    setChromeColors();

    if (typeof tg.disableVerticalSwipes === 'function') {
      try {
        tg.disableVerticalSwipes();
      } catch (_) {
        /* yoksay */
      }
    }

    enterFullscreenMode();
    applySafeArea();
    scheduleProfileApply();

    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      if (!tg.isFullscreen) enterFullscreenMode();
      applySafeArea();
      scheduleProfileApply();
    }, 200);
  }

  document.documentElement.classList.add('tg-mini-app');
  applyViewport();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', (payload) => {
      applySafeArea();
      scheduleProfileApply();
      if (payload?.isStateStable && !tg.isFullscreen) enterFullscreenMode();
    });
    tg.onEvent('safeAreaChanged', () => {
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('contentSafeAreaChanged', () => {
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('fullscreenChanged', () => {
      fullscreenRequested = !!tg.isFullscreen;
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('fullscreenFailed', () => {
      fullscreenRequested = false;
      if (typeof tg.expand === 'function') tg.expand();
      applySafeArea();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyViewport();
  });

  window.__tgApplyFullscreen = applyViewport;
  window.__tgApplySafeArea = applySafeArea;
  window.SniperSafeArea = {
    apply: applySafeArea,
    scheduleRetries: applyViewport,
  };
})();
