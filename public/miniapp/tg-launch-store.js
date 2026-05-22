/**
 * Telegram launch hash (#tgWebAppData, tgWebAppPlatform) — app.js #r= ile ezilmesin diye saklanır.
 */
(function () {
  const KEY = 'sniper_tg_launch';
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function parseLaunchHash(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw || !raw.includes('tgWebApp')) return null;
    const p = new URLSearchParams(raw);
    const data = String(p.get('tgWebAppData') || '').trim();
    const platform = String(p.get('tgWebAppPlatform') || '').trim().toLowerCase();
    const version = String(p.get('tgWebAppVersion') || '').trim();
    if (!data && !platform) return null;
    return { data, platform, version, savedAt: Date.now() };
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || Date.now() - (o.savedAt || 0) > MAX_AGE_MS) {
        sessionStorage.removeItem(KEY);
        return null;
      }
      return o;
    } catch (_) {
      return null;
    }
  }

  function save(ctx) {
    if (!ctx) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(ctx));
    } catch (_) {
      /* yoksay */
    }
  }

  const fromHash = parseLaunchHash(location.hash);
  if (fromHash) save(fromHash);

  function get() {
    return load() || fromHash;
  }

  function hasLaunchData() {
    const c = get();
    if (c?.data || c?.platform) return true;
    const tg = window.Telegram?.WebApp;
    if (!tg) return false;
    if (String(tg.initData || '').trim()) return true;
    const u = tg.initDataUnsafe || {};
    return !!(u.user?.id || u.query_id);
  }

  function launchPlatform() {
    const c = get();
    if (c?.platform) return c.platform;
    return String(window.Telegram?.WebApp?.platform || '').toLowerCase();
  }

  /** Eski #r= linklerini ?r= yap — Telegram hash'i korunur */
  function migrateReportHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h || h.includes('tgWebApp')) return;
    const p = new URLSearchParams(h.includes('=') ? h : `r=${h}`);
    const rid = p.get('r');
    if (!rid) return;
    const u = new URL(location.href);
    if (!u.searchParams.get('r')) u.searchParams.set('r', rid);
    const qs = u.searchParams.toString();
    history.replaceState(null, '', `${u.pathname}${qs ? `?${qs}` : ''}`);
  }

  window.SniperTgLaunch = {
    get,
    hasLaunchData,
    launchPlatform,
    migrateReportHash,
  };
})();
