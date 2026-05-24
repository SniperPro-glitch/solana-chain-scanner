/**
 * Admin giriş ekranı — EN / TR / RU
 */
(function (global) {
  const S = (en, tr, ru) => ({ en, tr, ru });
  const LANG_KEY = 'sniperAdminLoginLang';
  const MINIAPP_LANG_KEY = 'sniperMiniAppLang';
  const SUPPORTED = ['en', 'tr', 'ru'];
  const DEFAULT_LANG = 'en';

  const STRINGS = {
    'login.lang': S('Language', 'Dil', 'Язык'),
    'login.hint.default': S('Username and password', 'Kullanıcı adı ve şifre', 'Имя пользователя и пароль'),
    'login.label.user': S('Username', 'Kullanıcı adı', 'Имя пользователя'),
    'login.label.pass': S('Password', 'Şifre', 'Пароль'),
    'login.remember': S('Remember me', 'Beni hatırla', 'Запомнить меня'),
    'login.submit': S('Sign in', 'Giriş yap', 'Войти'),
    'login.hint.envUser': S(
      'User: {user} — password is ADMIN_PASSWORD in your .env file.',
      'Kullanıcı: {user} — şifre proje kökündeki .env dosyasındaki ADMIN_PASSWORD.',
      'Пользователь: {user} — пароль ADMIN_PASSWORD в файле .env.',
    ),
    'login.hint.envMissing': S(
      'ADMIN_USERNAME and ADMIN_PASSWORD are not set on the server (.env or Railway).',
      'Sunucuda ADMIN_USERNAME + ADMIN_PASSWORD yok (.env veya Railway).',
      'На сервере не заданы ADMIN_USERNAME и ADMIN_PASSWORD (.env или Railway).',
    ),
    'login.hint.crop': S('Admin sign-in required', 'Admin girişi gerekli', 'Требуется вход администратора'),
    'login.err.badCreds': S(
      'Invalid username or password (check ADMIN_PASSWORD in .env).',
      'Kullanıcı adı veya şifre hatalı (.env içindeki ADMIN_PASSWORD).',
      'Неверное имя пользователя или пароль (ADMIN_PASSWORD в .env).',
    ),
    'login.err.disabled': S(
      'Admin disabled — set ADMIN_USERNAME and ADMIN_PASSWORD in .env, then restart the server.',
      'Admin kapalı — .env içine ADMIN_USERNAME ve ADMIN_PASSWORD ekle, sunucuyu yeniden başlat.',
      'Админ отключён — добавьте ADMIN_USERNAME и ADMIN_PASSWORD в .env и перезапустите сервер.',
    ),
    'login.err.network': S(
      'Cannot reach server — is npm run miniapp:dev running? (http://localhost:3080)',
      'Sunucuya bağlanılamadı — npm run miniapp:dev çalışıyor mu? (http://localhost:3080)',
      'Нет связи с сервером — запущен ли npm run miniapp:dev? (http://localhost:3080)',
    ),
    'login.err.noToken': S(
      'Server did not return a session token — restart the server.',
      'Sunucu oturum jetonu döndürmedi — sunucuyu yeniden başlatın.',
      'Сервер не вернул токен сессии — перезапустите сервер.',
    ),
    'login.err.loadFailed': S(
      'Signed in, but panel data failed to load. Refresh the page (F5).',
      'Giriş başarılı; panel verisi yüklenemedi. Sayfayı yenileyin (F5).',
      'Вход выполнен, но данные панели не загрузились. Обновите страницу (F5).',
    ),
    'login.err.generic': S('Sign-in failed', 'Giriş başarısız', 'Ошибка входа'),
  };

  let currentLang = DEFAULT_LANG;

  function normalizeLang(lang) {
    const l = String(lang || '').toLowerCase().slice(0, 2);
    return SUPPORTED.includes(l) ? l : DEFAULT_LANG;
  }

  function loadStoredLang() {
    try {
      const raw = localStorage.getItem(LANG_KEY) || localStorage.getItem(MINIAPP_LANG_KEY);
      if (raw) return normalizeLang(raw);
    } catch { /* yoksay */ }
    return DEFAULT_LANG;
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
    if (!el) return;
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
    const phKey = el.getAttribute('data-i18n-placeholder');
    if (phKey) el.placeholder = t(phKey);
  }

  function applyLangButtons() {
    document.querySelectorAll('.login-lang-btn').forEach((btn) => {
      const code = btn.getAttribute('data-login-lang');
      btn.classList.toggle('active', code === currentLang);
      btn.setAttribute('aria-pressed', code === currentLang ? 'true' : 'false');
    });
  }

  function applyLoginGate() {
    const gate = document.getElementById('loginGate');
    if (!gate) return;
    gate.querySelectorAll('[data-i18n]').forEach(applyNode);
    gate.querySelectorAll('[data-i18n-placeholder]').forEach(applyNode);
    applyLangButtons();
  }

  function setLang(lang) {
    currentLang = normalizeLang(lang);
    try {
      localStorage.setItem(LANG_KEY, currentLang);
    } catch { /* yoksay */ }
    applyLoginGate();
    document.documentElement.lang = currentLang;
  }

  function init() {
    currentLang = loadStoredLang();
    document.documentElement.lang = currentLang;
    applyLoginGate();
    document.querySelectorAll('.login-lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLang(btn.getAttribute('data-login-lang'));
      });
    });
  }

  global.SniperAdminLoginI18n = { init, t, setLang, getLang: () => currentLang };
})();
