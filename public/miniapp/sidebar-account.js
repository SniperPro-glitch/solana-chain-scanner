/**
 * Sidebar — tüm kullanıcılar için kullanıcı adı / şifre girişi.
 * Yönetim Paneli: yalnızca .env kurucu veya admin panelinde tanımlı hesaplar (/api/admin/login).
 */
(function () {
  const SIGNED_KEY = 'sniperSidebarSignedIn';
  const TOKEN_KEY = 'sniperAdminTokenV2';
  const USER_KEY = 'sniperAdminUserV2';
  const PROFILE_KEY = 'sniperAdminProfileV1';
  let accountModalMode = 'login';

  function $(id) {
    return document.getElementById(id);
  }

  function isSignedIn() {
    try {
      return sessionStorage.getItem(SIGNED_KEY) === '1' && !!sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return false;
    }
  }

  function getProfile() {
    try {
      return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveSession(loginBody) {
    try {
      sessionStorage.setItem(SIGNED_KEY, '1');
      sessionStorage.setItem(TOKEN_KEY, loginBody.token || '');
      sessionStorage.setItem(USER_KEY, loginBody.username || '');
      sessionStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          username: loginBody.username,
          displayName: loginBody.displayName || loginBody.username,
          displayTitle: loginBody.displayTitle || loginBody.roleLabel || '',
          role: loginBody.role,
          roleLabel: loginBody.roleLabel,
          isFounder: !!loginBody.isFounder,
          permissions: loginBody.permissions || [],
          id: loginBody.id,
        }),
      );
    } catch {
      /* yoksay */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SIGNED_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
      sessionStorage.removeItem('sniperAdminActionToken');
      sessionStorage.removeItem('sniperAdminActionExp');
    } catch {
      /* yoksay */
    }
  }

  function t(key) {
    return window.MiniAppI18n?.t?.(key) ?? key;
  }

  function setGuestUi() {
    const ava = $('sidebarUserAva');
    const name = $('sidebarUserName');
    const sub = $('sidebarUserSub');
    const btn = $('sidebarSignIn');
    if (ava) ava.textContent = '👤';
    if (name) name.textContent = t('sidebar.anon');
    if (sub) sub.textContent = t('sidebar.guest');
    if (btn) {
      btn.textContent = t('sidebar.signIn');
      btn.hidden = false;
    }
    hideAdminButton();
  }

  function setSignedInUi(profile) {
    const ava = $('sidebarUserAva');
    const name = $('sidebarUserName');
    const sub = $('sidebarUserSub');
    const btn = $('sidebarSignIn');
    const title = profile.displayName || profile.username || 'Kullanıcı';
    const line2 = profile.displayTitle || profile.roleLabel || profile.username || '';
    if (ava) ava.textContent = profile.isFounder ? '👑' : '◎';
    if (name) name.textContent = title;
    if (sub) sub.textContent = line2;
    if (btn) {
      btn.textContent = t('sidebar.signOut');
      btn.hidden = false;
    }
    showAdminButton();
  }

  function showAdminButton() {
    const btn = $('sidebarAdminPanel');
    if (btn) btn.classList.remove('hidden');
  }

  function hideAdminButton() {
    const btn = $('sidebarAdminPanel');
    if (btn) btn.classList.add('hidden');
  }

  function showLoginError(msg) {
    const el = $('accountLoginErr');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function setAccountModalMode(mode) {
    accountModalMode = mode === 'register' ? 'register' : 'login';
    window.MiniAppI18n?.applyAccountModal?.(accountModalMode);
  }

  function getModalMode() {
    return accountModalMode;
  }

  function openLoginModal(mode) {
    const modal = $('accountLoginModal');
    if (!modal) return;
    setAccountModalMode(mode || 'login');
    showLoginError('');
    const user = $('accountLoginUser');
    const pass = $('accountLoginPass');
    if (user) user.value = '';
    if (pass) pass.value = '';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('account-login-open');
    window.MiniAppI18n?.applyLogin?.();
    if (typeof window.closeDexSidebar === 'function') window.closeDexSidebar();
    setTimeout(() => user?.focus(), 80);
  }

  function closeLoginModal() {
    const modal = $('accountLoginModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('account-login-open');
    showLoginError('');
  }

  async function submitAccountForm() {
    const username = ($('accountLoginUser')?.value || '').trim();
    const password = $('accountLoginPass')?.value || '';
    if (!username || !password) {
      showLoginError(t('account.login.errRequired'));
      return;
    }

    const isRegister = accountModalMode === 'register';
    const btn = $('accountLoginSubmit');
    if (btn) btn.disabled = true;
    showLoginError('');

    try {
      const res = await fetch(isRegister ? '/api/admin/register' : '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          showLoginError(t('account.login.err503'));
        } else if (res.status === 401) {
          showLoginError(t('account.login.err401'));
        } else if (isRegister && res.status === 409) {
          showLoginError(t('account.register.err409'));
        } else if (isRegister && res.status === 400) {
          showLoginError(body.message || t('account.register.err400'));
        } else if (isRegister) {
          showLoginError(t('account.register.errGeneric'));
        } else {
          showLoginError(t('account.login.errGeneric'));
        }
        return;
      }
      saveSession(body);
      setSignedInUi(getProfile());
      closeLoginModal();
    } catch {
      showLoginError(t('account.login.errNetwork'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function signOut() {
    clearSession();
    setGuestUi();
    closeLoginModal();
  }

  function openAdminPanel() {
    if (!isSignedIn()) {
      openLoginModal();
      return;
    }
    if (typeof window.closeDexSidebar === 'function') window.closeDexSidebar();
    closeLoginModal();
    window.location.assign('/admin/');
  }

  async function restoreSession() {
    if (!isSignedIn()) {
      setGuestUi();
      return;
    }
    const token = sessionStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        clearSession();
        setGuestUi();
        return;
      }
      saveSession({
        token,
        username: body.username,
        displayName: body.displayName,
        displayTitle: body.displayTitle,
        role: body.role,
        roleLabel: body.roleLabel,
        isFounder: body.isFounder,
        permissions: body.permissions,
        id: body.id,
      });
      setSignedInUi(getProfile());
    } catch {
      const profile = getProfile();
      if (profile?.username) setSignedInUi(profile);
      else {
        clearSession();
        setGuestUi();
      }
    }
  }

  function bind() {
    $('sidebarSignIn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isSignedIn()) {
        signOut();
        return;
      }
      openLoginModal();
    });

    $('accountLoginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void submitAccountForm();
    });

    $('accountLoginTabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.account-login-tab');
      if (!tab?.dataset.mode) return;
      setAccountModalMode(tab.dataset.mode);
      showLoginError('');
    });

    $('accountLoginBackdrop')?.addEventListener('click', closeLoginModal);
    $('accountLoginClose')?.addEventListener('click', closeLoginModal);
    $('accountLoginCancel')?.addEventListener('click', closeLoginModal);

    $('sidebarAdminPanel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAdminPanel();
    });

    restoreSession();
  }

  window.SniperSidebarAccount = {
    isSignedIn,
    signIn: openLoginModal,
    signOut,
    restoreSession,
    openLoginModal,
    closeLoginModal,
    getModalMode,
    setAccountModalMode,
  };
  window.openSniperAdminPanel = openAdminPanel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
