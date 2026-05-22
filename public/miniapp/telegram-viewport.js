/**
 * Telegram Mini App — genişletilmiş mod (expand), üstte ↓ ile küçültme.
 * requestFullscreen KULLANILMAZ: o modda sol üstte X çıkar ve logoyla çakışır.
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

    let cTop = Number(csa.top) || 0;
    let cBottom = Number(csa.bottom) || 0;
    let cLeft = Number(csa.left) || 0;
    let cRight = Number(csa.right) || 0;
    const sTop = Number(sa.top) || 0;
    const sBottom = Number(sa.bottom) || 0;

    /* Yanlışlıkla fullscreen açıldıysa X boşluğu (normalde exitFullscreen çağrılır) */
    if (fullscreen) {
      if (cLeft < 44) cLeft = 56;
      if (cTop < 36) cTop = Math.max(sTop, 52);
    } else {
      /* Expand mod: fazla üst inset grafikte boşluk bırakmasın */
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

  let viewportTimer = null;
  let cropTimer = null;

  /** TG viewport oturunca profil + kırpma (debounce — sersemleme yok). */
  function scheduleCropApply() {
    clearTimeout(cropTimer);
    cropTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
      if (window.SniperDexCrop?.handleCropProfileChange) window.SniperDexCrop.handleCropProfileChange();
      if (window.SniperDexCrop?.ensureMotorOnce) window.SniperDexCrop.ensureMotorOnce();
    }, 220);
  }

  function applyViewport() {
    tg.ready();

    /* X’li tam ekrandan çık → üstte aşağı ok (küçült) modu */
    if (tg.isFullscreen && typeof tg.exitFullscreen === 'function') {
      try {
        tg.exitFullscreen();
      } catch (_) { /* */ }
    }

    try {
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
    } catch (_) { /* */ }

    if (typeof tg.expand === 'function') tg.expand();

    applySafeArea();
    scheduleCropApply();
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      applySafeArea();
      scheduleCropApply();
    }, 180);
  }

  document.documentElement.classList.add('tg-mini-app');
  applyViewport();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', applyViewport);
    tg.onEvent('safeAreaChanged', () => {
      applySafeArea();
      scheduleCropApply();
    });
    tg.onEvent('contentSafeAreaChanged', () => {
      applySafeArea();
      scheduleCropApply();
    });
    tg.onEvent('fullscreenChanged', () => {
      if (tg.isFullscreen && typeof tg.exitFullscreen === 'function') {
        try {
          tg.exitFullscreen();
        } catch (_) { /* */ }
      }
      applySafeArea();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyViewport();
  });

  window.__tgApplyFullscreen = applyViewport;
  window.__tgApplySafeArea = applySafeArea;
})();
