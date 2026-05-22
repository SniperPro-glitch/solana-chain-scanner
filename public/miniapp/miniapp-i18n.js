/**
 * Mini App UI — EN (default) / TR / RU
 */
(function () {
  const LANG_KEY = 'sniperMiniAppLang';
  const SUPPORTED = ['en', 'tr', 'ru'];
  const DEFAULT_LANG = 'en';

  const STRINGS = {
    'account.login.lang': { en: 'Language', tr: 'Dil', ru: 'Язык' },
    'account.login.tab': { en: 'Sign in', tr: 'Giriş yap', ru: 'Вход' },
    'account.register.tab': { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать аккаунт' },
    'account.login.title': { en: 'Sign in', tr: 'Giriş yap', ru: 'Вход' },
    'account.register.title': { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать аккаунт' },
    'account.login.lead': {
      en: 'Sign in with your username and password. Admin panel is only available on authorized accounts.',
      tr: 'Kullanıcı adı ve şifrenle giriş yap. Yönetim paneli yalnızca yetkili hesaplarda görünür.',
      ru: 'Войдите с именем пользователя и паролем. Панель администратора только для авторизованных аккаунтов.',
    },
    'account.register.lead': {
      en: 'Pick a username and password (min. 6 characters). You will be signed in automatically after registration.',
      tr: 'Kullanıcı adı ve şifre seçin (en az 6 karakter). Kayıttan sonra otomatik giriş yapılır.',
      ru: 'Выберите имя пользователя и пароль (мин. 6 символов). После регистрации вход выполняется автоматически.',
    },
    'account.login.username': { en: 'Username', tr: 'Kullanıcı adı', ru: 'Имя пользователя' },
    'account.login.password': { en: 'Password', tr: 'Şifre', ru: 'Пароль' },
    'account.login.submit': { en: 'Sign in', tr: 'Giriş yap', ru: 'Войти' },
    'account.register.submit': { en: 'Create account', tr: 'Hesap oluştur', ru: 'Создать' },
    'account.login.cancel': { en: 'Cancel', tr: 'Vazgeç', ru: 'Отмена' },
    'account.login.hint': {
      en: 'For wallet use <b>Connect Wallet</b> above. Panel: founder (.env) or accounts defined in admin panel.',
      tr: 'Cüzdan için üstteki <b>Connect Wallet</b>. Panel: kurucu (.env) veya admin panelinde tanımlı hesaplar.',
      ru: 'Для кошелька — <b>Connect Wallet</b> сверху. Панель: основатель (.env) или учётные записи в админ-панели.',
    },
    'account.login.close': { en: 'Close', tr: 'Kapat', ru: 'Закрыть' },
    'account.login.errRequired': {
      en: 'Username and password are required.',
      tr: 'Kullanıcı adı ve şifre gerekli.',
      ru: 'Требуются имя пользователя и пароль.',
    },
    'account.login.err503': {
      en: 'Sign-in is disabled on the server. Set ADMIN_USERNAME and ADMIN_PASSWORD.',
      tr: 'Giriş sunucuda kapalı. ADMIN_USERNAME ve ADMIN_PASSWORD tanımlayın.',
      ru: 'Вход отключён на сервере. Укажите ADMIN_USERNAME и ADMIN_PASSWORD.',
    },
    'account.login.err401': {
      en: 'Invalid username or password.',
      tr: 'Kullanıcı adı veya şifre hatalı.',
      ru: 'Неверное имя пользователя или пароль.',
    },
    'account.login.errGeneric': {
      en: 'Sign-in failed. Try again.',
      tr: 'Giriş başarısız. Tekrar deneyin.',
      ru: 'Ошибка входа. Попробуйте снова.',
    },
    'account.login.errNetwork': {
      en: 'Connection error. Check your internet.',
      tr: 'Bağlantı hatası. İnterneti kontrol edin.',
      ru: 'Ошибка соединения. Проверьте интернет.',
    },
    'account.register.err409': {
      en: 'This username is already taken.',
      tr: 'Bu kullanıcı adı zaten kullanılıyor.',
      ru: 'Это имя пользователя уже занято.',
    },
    'account.register.err400': {
      en: 'Invalid username or password (min. 2 / 6 characters).',
      tr: 'Geçersiz kullanıcı adı veya şifre (en az 2 / 6 karakter).',
      ru: 'Неверное имя или пароль (мин. 2 / 6 символов).',
    },
    'account.register.errGeneric': {
      en: 'Registration failed. Try again.',
      tr: 'Kayıt başarısız. Tekrar deneyin.',
      ru: 'Ошибка регистрации. Попробуйте снова.',
    },
    'sidebar.anon': { en: 'anon', tr: 'anon', ru: 'anon' },
    'sidebar.guest': { en: 'Guest', tr: 'Misafir', ru: 'Гость' },
    'sidebar.signIn': { en: 'Sign in', tr: 'Giriş yap', ru: 'Войти' },
    'sidebar.signOut': { en: 'Sign out', tr: 'Çıkış', ru: 'Выйти' },
    'sidebar.adminPanel': { en: 'Admin panel', tr: 'Yönetim Paneli', ru: 'Панель админа' },
    'lang.en': { en: 'English', tr: 'English', ru: 'English' },
    'lang.tr': { en: 'Türkçe', tr: 'Türkçe', ru: 'Türkçe' },
    'lang.ru': { en: 'Русский', tr: 'Русский', ru: 'Русский' },
  };

  function normalizeLang(lang) {
    const l = String(lang || '').toLowerCase().slice(0, 2);
    return SUPPORTED.includes(l) ? l : DEFAULT_LANG;
  }

  function getLang() {
    try {
      return normalizeLang(localStorage.getItem(LANG_KEY) || DEFAULT_LANG);
    } catch {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    const l = normalizeLang(lang);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* yoksay */
    }
    document.documentElement.lang = l;
    applyAll();
    return l;
  }

  function t(key, vars) {
    const l = getLang();
    const entry = STRINGS[key];
    if (!entry) return key;
    let s = entry[l] ?? entry[DEFAULT_LANG] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return s;
  }

  function applyNode(el) {
    if (!el) return;
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const html = el.getAttribute('data-i18n-html') === '1';
    const val = t(key);
    if (html) el.innerHTML = val;
    else el.textContent = val;
    const aria = el.getAttribute('data-i18n-aria');
    if (aria) el.setAttribute('aria-label', t(aria));
  }

  function applyLoginLangButtons() {
    const lang = getLang();
    document.querySelectorAll('.account-login-lang-btn').forEach((btn) => {
      const code = btn.dataset.lang;
      btn.classList.toggle('active', code === lang);
      btn.setAttribute('aria-pressed', code === lang ? 'true' : 'false');
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
    });
    const pass = document.getElementById('accountLoginPass');
    if (pass) pass.setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
  }

  function applyLogin() {
    document.querySelectorAll('#accountLoginModal [data-i18n]').forEach(applyNode);
    document.querySelectorAll('#accountLoginModal [data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    applyLoginLangButtons();
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
  }

  function applyAll() {
    applyLogin();
    applySidebarStatic();
  }

  function bindLangSelector() {
    const wrap = document.getElementById('accountLoginLang');
    if (!wrap || wrap.dataset.bound) return;
    wrap.dataset.bound = '1';
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.account-login-lang-btn');
      if (!btn?.dataset.lang) return;
      setLang(btn.dataset.lang);
    });
  }

  function init() {
    document.documentElement.lang = getLang();
    bindLangSelector();
    applyAll();
  }

  window.MiniAppI18n = {
    SUPPORTED,
    DEFAULT_LANG,
    getLang,
    setLang,
    t,
    applyLogin,
    applyAccountModal,
    applySidebarStatic,
    applyAll,
    normalizeLang,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
