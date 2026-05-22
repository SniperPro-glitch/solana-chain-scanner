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
    const sa  = tg.safeAreaInset        || {};
    const csa = tg.contentSafeAreaInset || {};
    const fullscreen = !!tg.isFullscreen;

    const sTop    = Number(sa.top)    || 0;
    const sBottom = Number(sa.bottom) || 0;

    let cTop    = Number(csa.top)    || 0;
    let cBottom = Number(csa.bottom) || 0;
    let cLeft   = Number(csa.left)   || 0;
    let cRight  = Number(csa.right)  || 0;

    if (fullscreen) {
      /* Tam ekran: Dynamic Island/notch için güvenli alan */
      if (cLeft < 44) cLeft = 56;
      if (cTop  < 36) cTop  = Math.max(sTop, 52);
    } else {
      /* Expanded: Telegram bar yüksekliği = contentSafeAreaInset.top
         Bu değer scan-header padding-top'una eklenmeli ki içerik bar'ın
         altında başlasın ve "Kapat" butonu ile çakışmasın.
         Ama makul bir üst sınır koy (max 70px — aşırı büyük gelirse kırp). */
      cTop   = Math.min(Math.max(cTop, 0), 70);
      cLeft  = 0;
      cRight = 0;
    }

    root.style.setProperty('--tg-safe-top',            `${sTop}px`);
    root.style.setProperty('--tg-safe-bottom',         `${sBottom}px`);
    root.style.setProperty('--tg-content-safe-top',    `${cTop}px`);
    root.style.setProperty('--tg-content-safe-bottom', `${cBottom}px`);
    root.style.setProperty('--tg-content-safe-left',   `${cLeft}px`);
    root.style.setProperty('--tg-content-safe-right',  `${cRight}px`);

    if (tg.viewportStableHeight) {
      root.style.setProperty('--app-height', `${tg.viewportStableHeight}px`);
    } else if (tg.viewportHeight) {
      root.style.setProperty('--app-height', `${tg.viewportHeight}px`);
    }

    root.classList.toggle('tg-fullscreen', fullscreen);
    root.classList.toggle('tg-expanded',  !fullscreen);
  }

  let viewportTimer = null;
  let profileTimer  = null;

  function scheduleProfileApply() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => {
      if (window.SniperCropProfile?.applyWhenReady) window.SniperCropProfile.applyWhenReady();
      else if (window.SniperCropProfile?.apply)     window.SniperCropProfile.apply();
    }, 60);
  }

  function applyViewport() {
    tg.ready();

    /* X'li tam ekrandan çık → üstte aşağı ok (küçült) modu */
    if (tg.isFullscreen && typeof tg.exitFullscreen === 'function') {
      try { tg.exitFullscreen(); } catch (_) {}
    }

    try {
      if (typeof tg.setHeaderColor     === 'function') tg.setHeaderColor(BG);
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(BG);
    } catch (_) {}

    if (typeof tg.expand === 'function') tg.expand();

    applySafeArea();
    scheduleProfileApply();
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      applySafeArea();
      scheduleProfileApply();
    }, 180);
  }

  function bindBackButton() {
    if (!tg.BackButton || tg.__sniperBackBound) return;
    tg.__sniperBackBound = true;
    tg.BackButton.onClick(() => {
      if (typeof window.SniperNavBack === 'function')        window.SniperNavBack();
      else if (typeof window.SniperNavBack?.back === 'function') window.SniperNavBack.back();
    });
  }

  document.documentElement.classList.add('tg-mini-app');
  applyViewport();
  bindBackButton();

  if (typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', applyViewport);
    tg.onEvent('safeAreaChanged', () => {
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('contentSafeAreaChanged', () => {
      applySafeArea();
      scheduleProfileApply();
    });
    tg.onEvent('fullscreenChanged', () => {
      if (tg.isFullscreen && typeof tg.exitFullscreen === 'function') {
        try { tg.exitFullscreen(); } catch (_) {}
      }
      applySafeArea();
      scheduleProfileApply();
      if (typeof window.SniperNavBack?.sync === 'function') window.SniperNavBack.sync();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyViewport();
  });

  window.__tgApplyFullscreen = applyViewport;
  window.__tgApplySafeArea   = applySafeArea;
})();
