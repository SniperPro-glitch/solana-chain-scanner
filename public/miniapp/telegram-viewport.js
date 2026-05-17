/**
 * Telegram Mini App — tam ekran + güvenli alan (Bot API 8.0 requestFullscreen, yoksa expand).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#0a0e1a';

  function applySafeArea() {
    const root = document.documentElement;
    const sa = tg.safeAreaInset || {};
    const csa = tg.contentSafeAreaInset || {};
    const top = Math.max(sa.top || 0, csa.top || 0);
    const bottom = Math.max(sa.bottom || 0, csa.bottom || 0);
    root.style.setProperty('--tg-safe-top', `${top}px`);
    root.style.setProperty('--tg-safe-bottom', `${bottom}px`);
    if (tg.viewportStableHeight) {
      root.style.setProperty('--app-height', `${tg.viewportStableHeight}px`);
    } else if (tg.viewportHeight) {
      root.style.setProperty('--app-height', `${tg.viewportHeight}px`);
    }
  }

  function applyFullscreen() {
    tg.ready();
    try {
      if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
    } catch (_) { /* eski istemci */ }
    try {
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
    } catch (_) { /* */ }
    if (typeof tg.expand === 'function') tg.expand();
    if (typeof tg.requestFullscreen === 'function') {
      try {
        tg.requestFullscreen();
      } catch (_) { /* */ }
    }
    applySafeArea();
  }

  document.documentElement.classList.add('tg-mini-app');
  applyFullscreen();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', applyFullscreen);
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenFailed', () => {
      if (typeof tg.expand === 'function') tg.expand();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyFullscreen();
  });

  window.__tgApplyFullscreen = applyFullscreen;
})();
