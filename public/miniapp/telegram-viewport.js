/**
 * Telegram Mini App — tam ekran, güvenli alan, kapat düğmesi boşluğu.
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const BG = '#0a0e1a';
  const root = document.documentElement;

  function applySafeArea() {
    const sa = tg.safeAreaInset || {};
    const csa = tg.contentSafeAreaInset || {};
    const fullscreen = !!tg.isFullscreen;

    let cTop = Number(csa.top) || 0;
    let cBottom = Number(csa.bottom) || 0;
    let cLeft = Number(csa.left) || 0;
    let cRight = Number(csa.right) || 0;
    const sTop = Number(sa.top) || 0;
    const sBottom = Number(sa.bottom) || 0;

    /* Tam ekranda API bazen 0 döner; kapat (X) sol üstte — logo çakışmasın */
    if (fullscreen) {
      if (cLeft < 44) cLeft = 56;
      if (cTop < 36) cTop = Math.max(sTop, 52);
      if (cRight < 8) cRight = 12;
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
  }

  function applyFullscreen() {
    tg.ready();
    try {
      if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
    } catch (_) { /* */ }
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
    /* contentSafeAreaInset bazen bir frame gecikmeli gelir */
    setTimeout(applySafeArea, 80);
    setTimeout(applySafeArea, 320);
  }

  document.documentElement.classList.add('tg-mini-app');
  applyFullscreen();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', applyFullscreen);
    tg.onEvent('safeAreaChanged', applySafeArea);
    tg.onEvent('contentSafeAreaChanged', applySafeArea);
    tg.onEvent('fullscreenChanged', applySafeArea);
    tg.onEvent('fullscreenFailed', () => {
      root.classList.remove('tg-fullscreen');
      if (typeof tg.expand === 'function') tg.expand();
      applySafeArea();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyFullscreen();
  });

  window.__tgApplyFullscreen = applyFullscreen;
  window.__tgApplySafeArea = applySafeArea;
})();
