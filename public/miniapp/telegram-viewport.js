/**
 * Telegram — genişletilmiş tam yükseklik (referans: X Kapat + ok + menü görünür, içerik altında).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#060910';
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
      tg.BackButton?.hide?.();
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
  }

  /** Referans layout: API fullscreen değil, expand + Telegram üst barı */
  function ensureExpandedMode() {
    if (window.SniperHost?.isWebBrowser?.()) return;

    if (tg.isFullscreen && typeof tg.exitFullscreen === 'function') {
      try {
        tg.exitFullscreen();
      } catch (_) {
        /* yoksay */
      }
    }

    if (typeof tg.expand === 'function') {
      try {
        tg.expand();
      } catch (_) {
        /* yoksay */
      }
    }
  }

  function scheduleExpandRetries() {
    const delays = [0, 80, 200, 450, 900, 1600];
    delays.forEach((ms) => {
      setTimeout(() => {
        if (tg.isFullscreen) ensureExpandedMode();
        else if (typeof tg.expand === 'function') {
          try {
            tg.expand();
          } catch (_) {
            /* yoksay */
          }
        }
        applySafeArea();
      }, ms);
    });
  }

  function applyStickyMobile() {
    const p = String(tg.platform || '').toLowerCase();
    root.classList.toggle('tg-sticky-mobile', MOBILE_PLATFORMS.includes(p));
  }

  function bindBackButton() {
    if (!tg.BackButton) return;
    if (!tg.__sniperBackBound) {
      tg.__sniperBackBound = true;
      tg.BackButton.onClick(() => {
        if (typeof window.SniperNavBack === 'function') window.SniperNavBack();
      });
    }
    tg.BackButton.hide();
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

    ensureExpandedMode();
    scheduleExpandRetries();

    applySafeArea();
    scheduleProfileApply();
    bindBackButton();
    if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
  }

  function onFullscreenChanged() {
    if (tg.isFullscreen) ensureExpandedMode();
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
    tg.onEvent('fullscreenFailed', scheduleExpandRetries);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || window.SniperHost?.isWebBrowser?.()) return;
    disableSwipeClose();
    hideTelegramUiExtras();
    ensureExpandedMode();
    applySafeArea();
  });

  window.addEventListener('sniper-host-changed', (ev) => {
    if (ev.detail?.web) return;
    startTelegramHost();
  });

  startTelegramHost();

  window.__tgBootUi = bootTelegramUi;
  window.__tgApplySafeArea = applySafeArea;
  window.__tgApplyExpanded = () => {
    ensureExpandedMode();
    scheduleExpandRetries();
    hideTelegramUiExtras();
    applySafeArea();
  };
  window.__tgApplyFullscreen = window.__tgApplyExpanded;
})();
