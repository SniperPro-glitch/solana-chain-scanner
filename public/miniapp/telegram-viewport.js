/**
 * Telegram Mini App — örnek akış: ready → expand → requestFullscreen, BackButton.
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg || window.SniperHost?.isWebBrowser?.()) return;

  const BG = '#0a0e1a';
  const root = document.documentElement;

  function applySafeArea() {
    const sa = tg.safeAreaInset || {};
    const csa = tg.contentSafeAreaInset || {};
    const fullscreen = !!tg.isFullscreen;

    const sTop = Number(sa.top) || 0;
    const sBottom = Number(sa.bottom) || 0;
    let cTop = Number(csa.top) || 0;
    let cBottom = Number(csa.bottom) || 0;
    let cLeft = Number(csa.left) || 0;
    let cRight = Number(csa.right) || 0;

    if (!fullscreen) {
      if (cTop < 8) cTop = Math.max(sTop, 0);
      else if (cTop > 20) cTop = 20;
      cLeft = 0;
      cRight = 0;
    }

    root.style.setProperty('--tg-safe-top', `${sTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${sBottom}px`);
    root.style.setProperty('--tg-content-safe-top', `${cTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left', `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right', `${cRight}px`);

    if (tg.viewportStableHeight) {
      root.style.setProperty('--app-height', `${tg.viewportStableHeight}px`);
    } else if (tg.viewportHeight) {
      root.style.setProperty('--app-height', `${tg.viewportHeight}px`);
    }

    root.classList.toggle('tg-fullscreen', fullscreen);
    root.classList.toggle('tg-expanded', !fullscreen);
  }

  let profileTimer = null;

  function scheduleProfileApply() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
    }, 60);
  }

  function enterFullscreen() {
    if (typeof tg.requestFullscreen !== 'function') return;
    try {
      tg.requestFullscreen();
    } catch (_) {
      /* eski Telegram istemcisi */
    }
  }

  function bootTelegramUi() {
    tg.ready();

    try {
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
    } catch (_) {
      /* yoksay */
    }

    if (typeof tg.expand === 'function') tg.expand();
    enterFullscreen();

    if (typeof tg.disableVerticalSwipes === 'function') {
      try {
        tg.disableVerticalSwipes();
      } catch (_) {
        /* yoksay */
      }
    }

    applySafeArea();
    scheduleProfileApply();

    if (tg.BackButton) {
      tg.BackButton.show();
      if (!tg.__sniperBackBound) {
        tg.__sniperBackBound = true;
        tg.BackButton.onClick(() => {
          if (typeof window.SniperNavBack === 'function') window.SniperNavBack();
        });
      }
    }

    if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
  }

  document.documentElement.classList.add('tg-mini-app');
  bootTelegramUi();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', () => {
      applySafeArea();
      scheduleProfileApply();
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
      if (!tg.isFullscreen) enterFullscreen();
      applySafeArea();
      scheduleProfileApply();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (typeof tg.expand === 'function') tg.expand();
      if (!tg.isFullscreen) enterFullscreen();
      applySafeArea();
    }
  });

  window.__tgApplyFullscreen = bootTelegramUi;
  window.__tgApplySafeArea = applySafeArea;
  window.__tgEnterFullscreen = enterFullscreen;
})();
