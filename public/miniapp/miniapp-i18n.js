/**
 * Mini App UI — EN (default) / TR / RU
 */
(function () {
  const root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this;
  const LANG_KEY = 'sniperMiniAppLang';
  const SUPPORTED = ['en', 'tr', 'ru'];
  const DEFAULT_LANG = 'en';
  const STRINGS = root.__MiniAppI18nStrings || {};

  let currentLang = DEFAULT_LANG;

  function normalizeLang(lang) {
    const l = String(lang || '').toLowerCase().slice(0, 2);
    return SUPPORTED.includes(l) ? l : DEFAULT_LANG;
  }

  function loadStoredLang() {
    try {
      const raw = localStorage.getItem(LANG_KEY);
      if (raw) return normalizeLang(raw);
    } catch {
      /* yoksay */
    }
    return DEFAULT_LANG;
  }

  function getLang() {
    return currentLang;
  }

  function t(key, vars) {
    const entry = STRINGS[key];
    if (!entry) return key;
    let s = entry[currentLang] ?? entry[DEFAULT_LANG] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return s;
  }

  function applyNode(el) {
    if (!el || el.classList.contains('miniapp-lang-btn')) return;
    const key = el.getAttribute('data-i18n');
    if (key) {
      const html = el.getAttribute('data-i18n-html') === '1';
      const val = t(key);
      if (html) el.innerHTML = val;
      else el.textContent = val;
    }
    const phKey = el.getAttribute('data-i18n-placeholder');
    if (phKey) el.placeholder = t(phKey);
    const titleKey = el.getAttribute('data-i18n-title');
    if (titleKey) el.title = t(titleKey);
    const ariaKey = el.getAttribute('data-i18n-aria');
    if (ariaKey) el.setAttribute('aria-label', t(ariaKey));
  }

  function applyTfMenus() {
    document.querySelectorAll('[data-i18n-tf]').forEach((btn) => {
      const tf = btn.getAttribute('data-i18n-tf');
      if (!tf) return;
      const label = btn.querySelector('.feed-tf-option-label');
      const check = btn.querySelector('.feed-tf-check');
      const text = t(`tf.${tf}`);
      if (label) label.textContent = text;
      else if (!check) btn.textContent = text;
    });
    document.querySelectorAll('[data-i18n-np-age]').forEach((btn) => {
      const age = btn.getAttribute('data-i18n-np-age');
      const label = btn.querySelector('.feed-tf-option-label');
      const text = t(`npAge.${age}`);
      if (label) label.textContent = text;
    });
  }

  function applyLangButtons() {
    const lang = getLang();
    document.querySelectorAll('.miniapp-lang-btn').forEach((btn) => {
      const code = btn.dataset.lang;
      const on = code === lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applyAccountModal(mode) {
    const m = mode === 'register' ? 'register' : 'login';
    const title = document.getElementById('accountLoginTitle');
    const lead = document.getElementById('accountLoginLead');
    const submit = document.getElementById('accountLoginSubmit');
    if (title) title.textContent = t(`account.${m}.title`);
    if (lead) lead.textContent = t(`account.${m}.lead`);
    if (submit) submit.textContent = t(`account.${m}.submit`);
    document.querySelectorAll('.account-login-tab').forEach((btn) => {
      const on = btn.dataset.mode === m;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      const tabKey = btn.getAttribute('data-i18n');
      if (tabKey) btn.textContent = t(tabKey);
    });
    const pass = document.getElementById('accountLoginPass');
    if (pass) pass.setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
  }

  function applyLogin() {
    const modal = document.getElementById('accountLoginModal');
    if (modal) {
      modal.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]').forEach(applyNode);
    }
    applyLangButtons();
    const mode = window.SniperSidebarAccount?.getModalMode?.() || 'login';
    applyAccountModal(mode);
  }

  function applySidebarStatic() {
    const admin = document.getElementById('sidebarAdminPanel');
    if (admin) admin.textContent = t('sidebar.adminPanel');
    const signedIn = window.SniperSidebarAccount?.isSignedIn?.();
    const btn = document.getElementById('sidebarSignIn');
    if (btn && !btn.hidden) {
      btn.textContent = signedIn ? t('sidebar.signOut') : t('sidebar.signIn');
    }
    if (!signedIn) {
      const name = document.getElementById('sidebarUserName');
      const sub = document.getElementById('sidebarUserSub');
      if (name) name.textContent = t('sidebar.anon');
      if (sub) sub.textContent = t('sidebar.guest');
    }
    const watchHead = document.querySelector('.dex-sidebar-watch-head span:last-child');
    if (watchHead) watchHead.textContent = t('sidebar.watchTitle');
    const watchEmpty = document.getElementById('dexSidebarWatchEmpty');
    if (watchEmpty && !watchEmpty.dataset.dynamic) watchEmpty.textContent = t('sidebar.watchEmpty');
  }

  function applyDocument() {
    document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]').forEach(applyNode);
    applyTfMenus();
    applyLangButtons();
    applyLogin();
    applySidebarStatic();
  }

  function feedTfMeta(tf) {
    const key = ['5m', '1h', '6h', '24h'].includes(tf) ? tf : '24h';
    return {
      label: t(`tf.${key}`),
      short: t(`tf.${key}.short`),
      col: t(`tf.${key}.col`),
      changeKey: { '5m': 'change5m', '1h': 'change1h', '6h': 'change6h', '24h': 'change24h' }[key],
      volKey: { '5m': 'volume5m', '1h': 'volume1h', '6h': 'volume6h', '24h': 'volume24h' }[key],
      volFmtKey: { '5m': 'volume5mFmt', '1h': 'volume1hFmt', '6h': 'volume6hFmt', '24h': 'volume24hFmt' }[key],
    };
  }

  function npAgeMeta(age) {
    const key = ['1h', '6h', '12h', '24h', '48h'].includes(age) ? age : '24h';
    return { label: t(`npAge.${key}`), short: t(`npAge.${key}`) };
  }

  function chainUi(chain) {
    const id = String(chain || 'solana').toLowerCase();
    const labels = { solana: 'Solana', ton: 'TON', bsc: 'BSC', eth: 'Ethereum' };
    const shorts = { solana: 'SOL', ton: 'TON', bsc: 'BSC', eth: 'ETH' };
    const srcKey = `chain.${id}.src`;
    return {
      short: shorts[id] || id.toUpperCase().slice(0, 4),
      label: labels[id] || id,
      src: STRINGS[srcKey] ? t(srcKey) : t('chain.liveMarket'),
      live: id === 'solana',
    };
  }

  function emitLangChange() {
    document.dispatchEvent(new CustomEvent('miniapp:langchange', { detail: { lang: getLang() } }));
  }

  function setLang(lang, opts = {}) {
    currentLang = normalizeLang(lang);
    try {
      localStorage.setItem(LANG_KEY, currentLang);
    } catch {
      /* yoksay */
    }
    document.documentElement.lang = currentLang;
    applyAll();
    emitLangChange();
    if (!opts.skipServerSync) {
      const tg = root.Telegram?.WebApp;
      const initData = String(tg?.initData || '').trim();
      if (initData && typeof root.SniperMiniAppSyncLang === 'function') {
        void root.SniperMiniAppSyncLang(initData, currentLang);
      }
    }
    return currentLang;
  }

  function applyAll() {
    applyDocument();
  }

  function bindLangClicks() {
    if (document.documentElement.dataset.i18nLangBound) return;
    document.documentElement.dataset.i18nLangBound = '1';
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest?.('.miniapp-lang-btn[data-lang]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        setLang(btn.dataset.lang);
      },
      true,
    );
  }

  function hasStoredLang() {
    try {
      return !!localStorage.getItem(LANG_KEY);
    } catch {
      return false;
    }
  }

  function init() {
    currentLang = loadStoredLang();
    document.documentElement.lang = currentLang;
    bindLangClicks();
    applyAll();
    const tg = root.Telegram?.WebApp;
    const initData = String(tg?.initData || '').trim();
    if (initData && typeof root.SniperMiniAppSyncLang === 'function') {
      if (hasStoredLang()) {
        void root.SniperMiniAppSyncLang(initData, currentLang);
      } else {
        void root.SniperMiniAppSyncLang(initData).then(() => {
          applyAll();
          emitLangChange();
        });
      }
    }
  }

  window.MiniAppI18n = {
    SUPPORTED,
    DEFAULT_LANG,
    getLang,
    setLang,
    t,
    feedTfMeta,
    npAgeMeta,
    chainUi,
    applyLogin,
    applyAccountModal,
    applySidebarStatic,
    applyDocument,
    applyAll,
    normalizeLang,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
