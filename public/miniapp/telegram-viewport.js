/**
 * Telegram — tam yükseklik: expand + requestViewport (X Kapat görünür, referans gibi).
 * API requestFullscreen yalnızca ?fs=1 ile (üst chrome kalkar).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#060910';
  const root = document.documentElement;
  const MOBILE_PLATFORMS = ['android', 'ios', 'android_x', 'unigram'];
  let cachedAppHeight = 0;

  function isMobilePlatform() {
    const p = String(tg.platform || '').toLowerCase();
    return MOBILE_PLATFORMS.includes(p);
  }

  function wantApiFullscreen() {
    try {
      if (/(?:^|[?&])fs=1(?:&|$)/.test(location.search || '')) return true;
      if (/(?:^|[?&])nofs=1(?:&|$)/.test(location.search || '')) return false;
    } catch (_) {
      /* yoksay */
    }
    return false;
  }

  function applySafeArea() {
    if (typeof window.SniperSafeArea?.scheduleRetries === 'function') {
      window.SniperSafeArea.scheduleRetries();
    } else if (typeof window.SniperSafeArea?.apply === 'function') {
      window.SniperSafeArea.apply();
    }

    const stable = Math.round(Number(tg.viewportStableHeight) || 0);
    const vh = Math.round(Number(tg.viewportHeight) || 0);
    const next = stable > 0 ? stable : vh;
    if (next > 0) {
      if (!cachedAppHeight || stable > 0 || Math.abs(next - cachedAppHeight) > 48) {
        cachedAppHeight = next;
      }
      root.style.setProperty('--app-height', `${cachedAppHeight}px`);
    }

    const fs = !!tg.isFullscreen;
    const expanded = !!tg.isExpanded;
    root.classList.toggle('tg-fullscreen', fs);
    root.classList.toggle('tg-expanded', !fs && expanded);
    root.classList.toggle('tg-sheet', !fs && !expanded);
    root.classList.toggle('tg-chrome-hidden', fs);
    root.classList.toggle('tg-maxed', fs || expanded);
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

  /** Tam yükseklik — önce expand/viewport; isteğe bağlı API fullscreen */
  function ensureMaxViewport() {
    if (window.SniperHost?.isWebBrowser?.()) return;

    if (typeof tg.expand === 'function') {
      try {
        tg.expand();
      } catch (_) {
        /* yoksay */
      }
    }
    if (typeof tg.requestViewport === 'function') {
      try {
        tg.requestViewport({ height: 10000 });
      } catch (_) {
        /* yoksay */
      }
    }

    if (
      wantApiFullscreen()
      && isMobilePlatform()
      && typeof tg.requestFullscreen === 'function'
      && !tg.isFullscreen
    ) {
      try {
        tg.requestFullscreen();
      } catch (_) {
        /* yoksay */
      }
    }
  }

  function scheduleViewportRetries() {
    const delays = [0, 50, 120, 250, 500, 900, 1400, 2200, 3200, 4500];
    delays.forEach((ms) => {
      setTimeout(() => {
        if (!tg.isExpanded && !tg.isFullscreen) ensureMaxViewport();
        else ensureMaxViewport();
        applySafeArea();
      }, ms);
    });
  }

  function applyStickyMobile() {
    root.classList.toggle('tg-sticky-mobile', isMobilePlatform());
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

    const run = () => {
      hideTelegramUiExtras();
      disableSwipeClose();
      applyStickyMobile();

      try {
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
      } catch (_) {
        /* yoksay */
      }

      ensureMaxViewport();
      scheduleViewportRetries();
      applySafeArea();
      scheduleProfileApply();
      bindBackButton();
      if (typeof window.syncTgBackButton === 'function') window.syncTgBackButton();
    };

    if (typeof tg.ready === 'function') {
      try {
        tg.ready(run);
      } catch (_) {
        run();
      }
    } else {
      run();
    }
  }

  function onFullscreenChanged() {
    applySafeArea();
    scheduleProfileApply();
    if (!tg.isFullscreen && isMobilePlatform()) ensureMaxViewport();
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
      if (!tg.isExpanded && !tg.isFullscreen) ensureMaxViewport();
      scheduleProfileApply();
    });
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenChanged', onFullscreenChanged);
    tg.onEvent('fullscreenFailed', () => {
      ensureMaxViewport();
      scheduleViewportRetries();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || window.SniperHost?.isWebBrowser?.()) return;
    disableSwipeClose();
    hideTelegramUiExtras();
    ensureMaxViewport();
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
    ensureMaxViewport();
    scheduleViewportRetries();
    hideTelegramUiExtras();
    applySafeArea();
  };
  window.__tgApplyFullscreen = window.__tgApplyExpanded;
})();
