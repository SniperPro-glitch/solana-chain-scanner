/**
 * Telegram Mini App — tam ekran (X + aşağı ok kalkar), swipe ile küçültme kapalı.
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#0a0e1a';
  const root = document.documentElement;
  const MOBILE_PLATFORMS = ['android', 'ios', 'android_x', 'unigram'];

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

    const fs = !!tg.isFullscreen;
    root.classList.toggle('tg-fullscreen', fs);
    root.classList.toggle('tg-expanded', !fs);
    root.classList.toggle('tg-chrome-hidden', fs);
  }

  let profileTimer = null;
  let fsRetryTimer = null;

  function scheduleProfileApply() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
      if (typeof window.SniperSafeArea?.apply === 'function') window.SniperSafeArea.apply();
    }, 60);
  }

  function hideTelegramUiExtras() {
    try {
      tg.SettingsButton?.hide?.();
      tg.SecondaryButton?.hide?.();
    } catch (_) {
      /* yoksay */
    }
  }

  function disableSwipeClose() {
    if (typeof tg.disableVerticalSwipes === 'function') {
      try {
        tg.disableVerticalSwipes();
      } catch (_) {
        /* yoksay */
      }
    }
    if (typeof tg.postEvent === 'function') {
      try {
        tg.postEvent('web_app_setup_swipe_behavior', { allow_vertical_swipe: false });
      } catch (_) {
        /* yoksay */
      }
    }
  }

  function requestFullscreenMode() {
    if (window.SniperHost?.isWebBrowser?.()) return;
    if (tg.isFullscreen) return;

    if (typeof tg.requestFullscreen === 'function') {
      try {
        tg.requestFullscreen();
        return;
      } catch (_) {
        /* fallthrough */
      }
    }
    if (typeof tg.postEvent === 'function') {
      try {
        tg.postEvent('web_app_request_fullscreen');
      } catch (_) {
        /* yoksay */
      }
    }
  }

  function scheduleFullscreenRetries() {
    clearTimeout(fsRetryTimer);
    const delays = [0, 120, 350, 700, 1400, 2800];
    delays.forEach((ms) => {
      setTimeout(() => {
        if (!tg.isFullscreen) requestFullscreenMode();
      }, ms);
    });
  }

  function applyStickyMobile() {
    const p = String(tg.platform || '').toLowerCase();
    root.classList.toggle('tg-sticky-mobile', MOBILE_PLATFORMS.includes(p));
  }

  function bootTelegramUi() {
    if (window.SniperHost?.isWebBrowser?.()) return;

    tg.ready();
    hideTelegramUiExtras();
    disableSwipeClose();
    applyStickyMobile();

    try {
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
    } catch (_) {
      /* yoksay */
    }

    requestFullscreenMode();
    scheduleFullscreenRetries();

    if (typeof tg.expand === 'function') {
      try {
        tg.expand();
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

  function onFullscreenChanged() {
    if (!tg.isFullscreen) {
      requestFullscreenMode();
      scheduleFullscreenRetries();
    } else {
      hideTelegramUiExtras();
      disableSwipeClose();
    }
    applySafeArea();
    scheduleProfileApply();
    if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
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
    tg.onEvent('fullscreenChanged', onFullscreenChanged);
    tg.onEvent('fullscreenFailed', () => {
      scheduleFullscreenRetries();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || window.SniperHost?.isWebBrowser?.()) return;
    disableSwipeClose();
    if (!tg.isFullscreen) scheduleFullscreenRetries();
    else if (typeof tg.expand === 'function') tg.expand();
    applySafeArea();
  });

  window.addEventListener('sniper-host-changed', (ev) => {
    if (ev.detail?.web) return;
    startTelegramHost();
  });

  startTelegramHost();

  window.__tgBootUi = bootTelegramUi;
  window.__tgApplySafeArea = applySafeArea;
  window.__tgEnterFullscreen = requestFullscreenMode;
  window.__tgApplyFullscreen = () => {
    requestFullscreenMode();
    scheduleFullscreenRetries();
    applySafeArea();
  };
})();
