/**
 * Kayıtlı profil — Telegram'da viewportWidth (kalibrasyon ile aynı ölçü).
 */
(function () {
  const IDS = ['web', 'app11', 'app13', 'app13pm', 'app16'];

  function fromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const id = String(q.get('profil') || q.get('profile') || '').trim();
      if (IDS.includes(id)) return id;
    } catch {
      /* yoksay */
    }
    return null;
  }

  function isTelegramApp() {
    if (window.SniperHost?.isTelegram) return window.SniperHost.isTelegram();
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;
    const uid = tg.initDataUnsafe?.user?.id;
    if (uid != null && String(uid) !== '0') return true;
    if (tg.initDataUnsafe?.auth_date) return true;
    const p = String(tg.platform || '').toLowerCase();
    return ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  /** Kalibrasyonda kullanılan genişlik — innerWidth değil, TG viewportWidth. */
  function layoutWidth() {
    const tg = window.Telegram?.WebApp;
    if (tg?.viewportWidth && tg.viewportWidth > 0) return Math.round(tg.viewportWidth);
    if (window.visualViewport?.width) return Math.round(window.visualViewport.width);
    return Math.round(window.innerWidth || 390);
  }

  function profileFromWidth(w) {
    if (w >= 429) return 'app16';
    if (w >= 426) return 'app13pm';
    if (w >= 400) return 'app11';
    return 'app13';
  }

  function detect() {
    const forced = fromUrl();
    if (forced) return forced;
    if (!isTelegramApp()) return 'web';
    return profileFromWidth(layoutWidth());
  }

  let lockedProfileId = null;

  function apply() {
    if (window.SniperHost?.refresh) window.SniperHost.refresh();
    const forced = fromUrl();
    if (lockedProfileId && !forced) {
      document.documentElement.dataset.dexCropProfile = lockedProfileId;
      document.documentElement.dataset.dexCropW = String(layoutWidth());
      return lockedProfileId;
    }
    const id = detect();
    lockedProfileId = id;
    document.documentElement.dataset.dexCropProfile = id;
    document.documentElement.dataset.dexCropW = String(layoutWidth());
    return id;
  }

  function boot() {
    apply();
  }

  window.SniperCropProfile = { detect, apply, layoutWidth, profileFromWidth, IDS };

  const tg = window.Telegram?.WebApp;
  if (tg && typeof tg.ready === 'function') {
    tg.ready(boot);
  } else {
    boot();
  }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('sniper-host-telegram', () => {
    lockedProfileId = null;
    boot();
  });
  setTimeout(boot, 400);
})();
