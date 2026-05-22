/**
 * Gerçek Telegram mini app vs tarayıcı (localhost Chrome).
 * telegram-web-app.js Chrome'da da yüklü — ilk milisaniyede initData boş olabilir;
 * tg.ready() sonrası tekrar kontrol edilir.
 */
(function () {
  const TG_PLATFORMS = ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk'];

  function isRealTelegramHost() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;
    const uid = tg.initDataUnsafe?.user?.id;
    if (uid != null && String(uid) !== '0') return true;
    if (tg.initDataUnsafe?.auth_date) return true;
    const p = String(tg.platform || '').toLowerCase();
    if (TG_PLATFORMS.includes(p)) return true;
    return false;
  }

  function refreshHostClasses() {
    const tgHost = isRealTelegramHost();
    const root = document.documentElement;
    root.dataset.sniperHost = tgHost ? 'telegram' : 'web';
    if (tgHost) {
      root.classList.remove('web-browser');
      root.classList.add('tg-mini-app');
    } else {
      root.classList.add('web-browser');
      root.classList.remove('tg-mini-app');
    }
    return tgHost;
  }

  window.SniperHost = {
    isTelegram: () => isRealTelegramHost(),
    isWebBrowser: () => !isRealTelegramHost(),
    refresh: refreshHostClasses,
  };

  refreshHostClasses();

  const tg = window.Telegram?.WebApp;
  function onHostReady() {
    const before = document.documentElement.dataset.sniperHost;
    refreshHostClasses();
    const after = document.documentElement.dataset.sniperHost;
    if (window.SniperCropProfile?.apply) window.SniperCropProfile.apply();
    if (before !== after && after === 'telegram') {
      window.dispatchEvent(new Event('sniper-host-telegram'));
    }
  }

  if (tg && typeof tg.ready === 'function') {
    tg.ready(onHostReady);
  }
  document.addEventListener('DOMContentLoaded', onHostReady);
  setTimeout(onHostReady, 120);
  setTimeout(onHostReady, 600);
})();
