/**
 * Gerçek Telegram mini app vs tarayıcı (localhost Chrome).
 * telegram-web-app.js Chrome'da da yüklü — initData boşsa web sayılır.
 */
(function () {
  function isRealTelegramHost() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;
    const uid = tg.initDataUnsafe?.user?.id;
    if (uid != null && String(uid) !== '0') return true;
    const p = String(tg.platform || '').toLowerCase();
    return ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  const web = !isRealTelegramHost();
  const root = document.documentElement;
  window.SniperHost = {
    isTelegram: () => !web,
    isWebBrowser: () => web,
  };

  if (web) {
    root.classList.add('web-browser');
    root.classList.remove('tg-mini-app');
  } else {
    root.classList.remove('web-browser');
    root.classList.add('tg-mini-app');
  }
})();
