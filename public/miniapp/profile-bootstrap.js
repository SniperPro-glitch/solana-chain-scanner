/**
 * Kayıtlı profil seçimi — sayfa yüklenmeden data-dex-crop-profile (CSS dosyası bunu okur).
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
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim().length > 0) return true;
    const p = String(tg.platform || '').toLowerCase();
    return ['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk'].includes(p);
  }

  function detect() {
    const forced = fromUrl();
    if (forced) return forced;
    if (document.documentElement.classList.contains('web-browser')) return 'web';
    if (!isTelegramApp()) return 'web';
    const w = window.innerWidth || 390;
    if (w >= 429) return 'app16';
    if (w >= 426) return 'app13pm';
    if (w >= 400) return 'app11';
    return 'app13';
  }

  function apply() {
    const id = detect();
    document.documentElement.dataset.dexCropProfile = id;
    return id;
  }

  apply();
  window.SniperCropProfile = { detect, apply, IDS };
})();
