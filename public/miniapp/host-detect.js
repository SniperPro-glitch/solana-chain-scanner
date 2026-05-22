/**
 * Gerçek Telegram mini app vs tarayıcı.
 * tgWebAppData hash'i veya session kaydı varsa Telegram sayılır (#r= ezilmesine karşı).
 */
(function () {
  const TG_PLATFORMS = ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk', 'unigram'];

  function isRealTelegramHost() {
    if (window.SniperTgLaunch?.hasLaunchData?.()) return true;

    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;

    const unsafe = tg.initDataUnsafe || {};
    if (unsafe.user?.id || unsafe.query_id) return true;

    const p = String(tg.platform || '').toLowerCase();
    if (TG_PLATFORMS.includes(p)) return true;

    const lp = window.SniperTgLaunch?.launchPlatform?.() || '';
    if (TG_PLATFORMS.includes(lp)) return true;

    return false;
  }

  let web = !isRealTelegramHost();

  function applyHostState() {
    window.SniperHost = {
      isTelegram: () => !web,
      isWebBrowser: () => web,
    };
    document.documentElement.classList.toggle('web-browser', web);
    if (!web) {
      document.documentElement.classList.remove('web-browser');
      document.documentElement.classList.add('tg-mini-app');
    }
  }

  function recheck() {
    const nowWeb = !isRealTelegramHost();
    if (nowWeb === web) return;
    web = nowWeb;
    applyHostState();
    window.dispatchEvent(new CustomEvent('sniper-host-changed', { detail: { web } }));
  }

  applyHostState();

  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.ready === 'function') {
    try {
      tg.ready(recheck);
    } catch (_) {
      setTimeout(recheck, 0);
    }
  }
  setTimeout(recheck, 50);
  setTimeout(recheck, 200);
  setTimeout(recheck, 600);
})();
