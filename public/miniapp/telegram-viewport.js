/**
 * Telegram Mini App — expand + requestFullscreen (tam ekran).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#0a0e1a';
  const root = document.documentElement;

  function applySafeArea() {
    if (typeof window.SniperSafeArea?.scheduleRetries === 'function') {
      window.SniperSafeArea.scheduleRetries();
    } else if (typeof window.SniperSafeArea?.apply === 'function') {
      window.SniperSafeArea.apply();
    }

    if (tg.viewportStableHeight) {
      root.style.setProperty('--app-height', `${tg.viewportStableHeight}px`);
    } else if (tg.viewportHeight) {
      root.style.setProperty('--app-height', `${tg.viewportHeight}px`);
    }

    root.classList.toggle('tg-fullscreen', !!tg.isFullscreen);
    root.classList.toggle('tg-expanded', !tg.isFullscreen);
  }

  let profileTimer = null;

  function scheduleProfileApply() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
      if (typeof window.SniperSafeArea?.apply === 'function') window.SniperSafeArea.apply();
    }, 60);
  }

  function enterFullscreen() {
    if (window.SniperHost?.isWebBrowser?.()) return;
    if (typeof tg.requestFullscreen !== 'function') return;
    try {
      tg.requestFullscreen();
    } catch (_) {
      /* eski Telegram */
    }
  }

  function bootTelegramUi() {
    if (window.SniperHost?.isWebBrowser?.()) return;

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
    bindBackButton();
    if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
  }

  function bindBackButton() {
    if (!tg.BackButton) return;
    if (!tg.__sniperBackBound) {
      tg.__sniperBackBound = true;
      tg.BackButton.onClick(() => {
        if (typeof window.SniperNavBack === 'function') window.SniperNavBack();
      });
    }
  }

  function startTelegramHost() {
    if (window.SniperHost?.isWebBrowser?.()) return;
    if (document.documentElement.__sniperTgBooted) return;
    document.documentElement.__sniperTgBooted = true;
    document.documentElement.classList.add('tg-mini-app');
    bootTelegramUi();
  }

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', () => {
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenChanged', () => {
      if (!tg.isFullscreen) enterFullscreen();
      applySafeArea();
      scheduleProfileApply();
      if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || window.SniperHost?.isWebBrowser?.()) return;
    if (typeof tg.expand === 'function') tg.expand();
    if (!tg.isFullscreen) enterFullscreen();
    applySafeArea();
  });

  window.addEventListener('sniper-host-changed', (ev) => {
    if (ev.detail?.web) return;
    startTelegramHost();
  });

  startTelegramHost();

  window.__tgBootUi = bootTelegramUi;
  window.__tgApplySafeArea = applySafeArea;
  window.__tgEnterFullscreen = enterFullscreen;
  window.__tgApplyFullscreen = () => {
    enterFullscreen();
    applySafeArea();
  };
})();
