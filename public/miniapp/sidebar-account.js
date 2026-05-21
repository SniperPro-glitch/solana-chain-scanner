/**
 * Sidebar hesap — giriş sonrası profil; yalnızca yetkili Telegram ID'de Yönetim Paneli.
 */
(function () {
  const SIGNED_KEY = 'sniperSidebarSignedIn';
  const TG_ID_KEY = 'sniperSidebarTgId';

  function $(id) {
    return document.getElementById(id);
  }

  function getTelegramUser() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  }

  function isSignedIn() {
    try {
      return sessionStorage.getItem(SIGNED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setSignedIn(telegramId) {
    try {
      sessionStorage.setItem(SIGNED_KEY, '1');
      if (telegramId) sessionStorage.setItem(TG_ID_KEY, String(telegramId));
    } catch {
      /* yoksay */
    }
  }

  function clearSignedIn() {
    try {
      sessionStorage.removeItem(SIGNED_KEY);
      sessionStorage.removeItem(TG_ID_KEY);
    } catch {
      /* yoksay */
    }
  }

  function setGuestUi() {
    const ava = $('sidebarUserAva');
    const name = $('sidebarUserName');
    const sub = $('sidebarUserSub');
    const btn = $('sidebarSignIn');
    if (ava) ava.textContent = '👤';
    if (name) name.textContent = 'anon';
    if (sub) sub.textContent = 'Misafir';
    if (btn) {
      btn.textContent = 'Giriş yap';
      btn.hidden = false;
    }
    hideAdminButton();
  }

  function setTelegramUi(tg) {
    const ava = $('sidebarUserAva');
    const name = $('sidebarUserName');
    const sub = $('sidebarUserSub');
    const btn = $('sidebarSignIn');
    const display = [tg.first_name, tg.last_name].filter(Boolean).join(' ')
      || tg.username
      || 'Kullanıcı';
    if (ava) {
      if (tg.photo_url) {
        ava.innerHTML = `<img src="${tg.photo_url}" alt="" width="32" height="32" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
      } else {
        ava.textContent = (display[0] || '?').toUpperCase();
      }
    }
    if (name) name.textContent = display;
    if (sub) sub.textContent = tg.username ? `@${tg.username}` : 'Telegram';
    if (btn) {
      btn.textContent = 'Çıkış';
      btn.hidden = false;
    }
  }

  function setWalletUi(w) {
    const ava = $('sidebarUserAva');
    const name = $('sidebarUserName');
    const sub = $('sidebarUserSub');
    const btn = $('sidebarSignIn');
    if (ava) ava.textContent = '◎';
    if (name) name.textContent = w.shortAddr(w.pubkey);
    if (sub) sub.textContent = w.label || 'Cüzdan';
    if (btn) {
      btn.textContent = 'Çıkış';
      btn.hidden = false;
    }
    hideAdminButton();
  }

  function showAdminButton() {
    const btn = $('sidebarAdminPanel');
    if (btn) btn.classList.remove('hidden');
  }

  function hideAdminButton() {
    const btn = $('sidebarAdminPanel');
    if (btn) btn.classList.add('hidden');
  }

  function isLocalPreview() {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return false;
    return new URLSearchParams(window.location.search).get('previewAdmin') === '1';
  }

  async function checkAdminAccess(telegramId) {
    if (!telegramId) {
      hideAdminButton();
      return;
    }
    try {
      const res = await fetch(
        `/api/miniapp/admin-access?telegramId=${encodeURIComponent(telegramId)}`,
      );
      if (!res.ok) {
        hideAdminButton();
        return;
      }
      const data = await res.json();
      if (data.allowed) showAdminButton();
      else hideAdminButton();
    } catch {
      hideAdminButton();
    }
  }

  async function signInWithTelegram() {
    const tg = getTelegramUser();
    if (!tg?.id) return false;
    setSignedIn(tg.id);
    setTelegramUi(tg);
    await checkAdminAccess(String(tg.id));
    return true;
  }

  async function signIn() {
    if (await signInWithTelegram()) return;

    const w = window.SniperWallet;
    if (!w) return;
    if (typeof window.closeDexSidebar === 'function') window.closeDexSidebar();
    try {
      const pk = await w.connect();
      if (pk) {
        setSignedIn(null);
        setWalletUi(w);
      }
    } catch {
      /* yoksay */
    }
  }

  function signOut() {
    clearSignedIn();
    const w = window.SniperWallet;
    if (w?.pubkey) w.disconnect?.();
    setGuestUi();
  }

  function openAdminPanel() {
    if (typeof window.closeDexSidebar === 'function') window.closeDexSidebar();
    window.location.assign('/admin/');
  }

  async function restoreSession() {
    if (!isSignedIn()) {
      setGuestUi();
      return;
    }
    const tg = getTelegramUser();
    if (tg?.id) {
      setTelegramUi(tg);
      await checkAdminAccess(String(tg.id));
      return;
    }
    const w = window.SniperWallet;
    if (w?.pubkey) {
      setWalletUi(w);
      return;
    }
    clearSignedIn();
    setGuestUi();
  }

  function bind() {
    $('sidebarSignIn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isSignedIn()) {
        signOut();
        return;
      }
      signIn();
    });

    $('sidebarAdminPanel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAdminPanel();
    });

    window.SniperWallet?.onChange?.((w) => {
      if (!isSignedIn() || getTelegramUser()?.id) return;
      if (w.pubkey) setWalletUi(w);
      else if (!getTelegramUser()?.id) signOut();
    });

    restoreSession();

    if (isLocalPreview() && !isSignedIn()) {
      const fakeId = '7399188880';
      setSignedIn(fakeId);
      $('sidebarUserName').textContent = 'Önizleme';
      $('sidebarUserSub').textContent = '@admin';
      checkAdminAccess(fakeId);
      $('sidebarSignIn').textContent = 'Çıkış';
    }
  }

  window.SniperSidebarAccount = { signIn, signOut, restoreSession };
  window.openSniperAdminPanel = openAdminPanel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
