/**
 * Telegram — expand + requestFullscreen (retry) + sabit viewport.
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#060910';
  const root = document.documentElement;
  const MOBILE_PLATFORMS = ['android', 'ios', 'android_x', 'unigram'];
  let heightLocked = false;
  let lockedHeight = 0;

  function skipFullscreen() {
    try {
      return /(?:^|[?&])nofs=1(?:&|$)/.test(location.search || '');
    } catch (_) {
      return false;
    }
  }

  function enterFullscreen() {
    if (skipFullscreen() || typeof tg.requestFullscreen !== 'function') return;
    try {
      tg.requestFullscreen();
    } catch (_) {
      /* yoksay */
    }
    setTimeout(() => {
      if (!tg.isFullscreen && typeof tg.requestFullscreen === 'function') {
        try {
          tg.requestFullscreen();
        } catch (_) {
          /* yoksay */
        }
      }
    }, 300);
    setTimeout(() => {
      if (!tg.isFullscreen && typeof tg.requestFullscreen === 'function') {
        try {
          tg.requestFullscreen();
        } catch (_) {
          /* yoksay */
        }
      }
    }, 1000);
  }

  function applySafeArea() {
    if (typeof window.SniperSafeArea?.apply === 'function') {
      window.SniperSafeArea.apply();
    }

    const stable = Math.round(Number(tg.viewportStableHeight) || 0);
    const vh = Math.round(Number(tg.viewportHeight) || 0);
    const next = stable > 0 ? stable : vh;

    if (!heightLocked && next > 0) {
      lockedHeight = next;
      heightLocked = true;
      root.style.setProperty('--app-height', `${lockedHeight}px`);
    } else if (heightLocked && lockedHeight > 0) {
      root.style.setProperty('--app-height', `${lockedHeight}px`);
    }

    const fs = !!tg.isFullscreen;
    const expanded = !!tg.isExpanded;
    root.classList.toggle('tg-fullscreen', fs);
    root.classList.toggle('tg-expanded', !fs && expanded);
    root.classList.toggle('tg-sheet', !fs && !expanded);
    root.classList.toggle('tg-chrome-hidden', fs);
    root.classList.toggle('tg-maxed', fs || expanded || heightLocked);
  }

  function ensureMaxViewport() {
    if (window.SniperHost?.isWebBrowser?.()) return;
    try {
      if (typeof tg.expand === 'function') tg.expand();
    } catch (_) {
      /* yoksay */
    }
    try {
      if (typeof tg.requestViewport === 'function') tg.requestViewport({ height: 10000 });
    } catch (_) {
      /* yoksay */
    }
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

  function bootTelegramUi() {
    if (window.SniperHost?.isWebBrowser?.()) return;

    const run = () => {
      hideTelegramUiExtras();
      disableSwipeClose();
      const p = String(tg.platform || '').toLowerCase();
      root.classList.toggle('tg-sticky-mobile', MOBILE_PLATFORMS.includes(p));

      try {
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
      } catch (_) {
        /* yoksay */
      }

      ensureMaxViewport();
      enterFullscreen();
      setTimeout(ensureMaxViewport, 300);
      applySafeArea();
      setTimeout(applySafeArea, 450);
      setTimeout(() => {
        applySafeArea();
        if (typeof window.SniperSafeArea?.lockLayout === 'function') {
          window.SniperSafeArea.lockLayout();
        }
      }, 1200);

      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();

      if (tg.BackButton && !tg.__sniperBackBound) {
        tg.__sniperBackBound = true;
        tg.BackButton.onClick(() => {
          if (typeof window.SniperNavBack === 'function') window.SniperNavBack();
        });
      }
      tg.BackButton?.hide?.();
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
    if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
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
      if (!heightLocked) applySafeArea();
    });
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenChanged', onFullscreenChanged);
    tg.onEvent('fullscreenFailed', () => {
      ensureMaxViewport();
      enterFullscreen();
      applySafeArea();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || window.SniperHost?.isWebBrowser?.()) return;
    disableSwipeClose();
    ensureMaxViewport();
    enterFullscreen();
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
    enterFullscreen();
    applySafeArea();
  };
  window.__tgEnterFullscreen = enterFullscreen;
})();
