/**
 * Hassas admin işlemleri — kaydetmeden önce kendi şifresi ile doğrulama.
 */
(function () {
  const TOKEN_KEY = 'sniperAdminActionToken';
  const EXP_KEY = 'sniperAdminActionExp';

  const MUTATE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const EXEMPT = new Set([
    '/api/admin/login',
    '/api/admin/verify-action',
    '/api/admin/session',
    '/api/admin/feed/preview',
    '/api/admin/change-password',
  ]);

  function getProfile() {
    try {
      return JSON.parse(sessionStorage.getItem('sniperAdminProfileV1') || 'null');
    } catch {
      return null;
    }
  }

  function getSessionToken() {
    return sessionStorage.getItem('sniperAdminTokenV2') || '';
  }

  function getStoredActionToken() {
    const t = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(EXP_KEY) || 0);
    if (!t || !exp || Date.now() > exp - 2000) {
      clearActionToken();
      return null;
    }
    return t;
  }

  function setActionToken(actionToken, expiresAt) {
    sessionStorage.setItem(TOKEN_KEY, actionToken);
    sessionStorage.setItem(EXP_KEY, String(expiresAt));
  }

  function clearActionToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXP_KEY);
  }

  window.SniperAdminClearActionAuth = clearActionToken;

  function ensureModal() {
    let el = document.getElementById('adminActionAuthModal');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'adminActionAuthModal';
    el.className = 'admin-action-modal hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="admin-action-backdrop" data-close="1"></div>
      <div class="admin-action-card">
        <h3>İşlem doğrulama</h3>
        <p class="admin-action-sub" id="adminActionAuthHint">Kaydetmek için hesap şifrenizi girin.</p>
        <label class="input-group">
          <div class="input-label">Şifre</div>
          <input class="input" id="adminActionAuthPass" type="password" autocomplete="current-password" />
        </label>
        <p class="admin-action-err" id="adminActionAuthErr" role="alert"></p>
        <div class="admin-action-btns">
          <button type="button" class="btn btn-ghost btn-sm" data-close="1">İptal</button>
          <button type="button" class="btn btn-primary btn-sm" id="adminActionAuthConfirm">Doğrula</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.classList.add('hidden');
        el.dataset.resolved = 'cancel';
      });
    });

    return el;
  }

  function promptPassword(profile) {
    const modal = ensureModal();
    const hint = document.getElementById('adminActionAuthHint');
    const err = document.getElementById('adminActionAuthErr');
    const input = document.getElementById('adminActionAuthPass');
    const confirm = document.getElementById('adminActionAuthConfirm');

    const name = profile?.displayName || profile?.username || 'Admin';
    const role = profile?.isFounder ? 'Kurucu (OWNER)' : (profile?.roleLabel || 'Admin');
    if (hint) hint.textContent = `${name} · ${role} — değişiklik için şifrenizi doğrulayın.`;

    return new Promise((resolve, reject) => {
      if (err) err.textContent = '';
      if (input) input.value = '';
      modal.classList.remove('hidden');
      modal.dataset.resolved = '';
      input?.focus();

      const onConfirm = async () => {
        const password = input?.value || '';
        if (!password) {
          if (err) err.textContent = 'Şifre gerekli';
          return;
        }
        confirm.disabled = true;
        try {
          const res = await fetch('/api/admin/verify-action', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getSessionToken()}`,
            },
            body: JSON.stringify({ password }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (err) err.textContent = body.message || 'Şifre hatalı';
            return;
          }
          setActionToken(body.actionToken, body.expiresAt);
          modal.classList.add('hidden');
          resolve(body.actionToken);
        } catch (e) {
          if (err) err.textContent = e.message || 'Doğrulama başarısız';
        } finally {
          confirm.disabled = false;
        }
      };

      const onKey = (e) => {
        if (e.key === 'Enter') onConfirm();
        if (e.key === 'Escape') {
          modal.classList.add('hidden');
          reject(new Error('cancelled'));
        }
      };

      confirm.onclick = onConfirm;
      input.onkeydown = onKey;

      const poll = setInterval(() => {
        if (modal.dataset.resolved === 'cancel') {
          clearInterval(poll);
          reject(new Error('cancelled'));
        }
        if (!modal.classList.contains('hidden') && getStoredActionToken()) {
          clearInterval(poll);
          resolve(getStoredActionToken());
        }
      }, 200);
    });
  }

  async function ensureActionToken() {
    const existing = getStoredActionToken();
    if (existing) return existing;
    const profile = getProfile();
    return promptPassword(profile);
  }

  function needsAuth(path, method) {
    const m = (method || 'GET').toUpperCase();
    if (!MUTATE.has(m)) return false;
    if (!String(path).startsWith('/api/admin')) return false;
    if (EXEMPT.has(path)) return false;
    return true;
  }

  function wrapApi() {
    if (!window.SniperAdminApi || window.__adminActionAuthWrapped) return;
    const orig = window.SniperAdminApi;

    window.SniperAdminApi = async function (path, opts = {}) {
      const method = (opts.method || 'GET').toUpperCase();
      if (!needsAuth(path, method)) {
        return orig(path, opts);
      }

      let actionToken;
      try {
        actionToken = await ensureActionToken();
      } catch (e) {
        if (e.message === 'cancelled') throw new Error('İşlem iptal edildi');
        throw e;
      }

      const headers = {
        ...(opts.headers || {}),
        'X-Admin-Action-Token': actionToken,
      };

      try {
        return await orig(path, { ...opts, headers });
      } catch (e) {
        if (e.code === 'action_auth_required' || e.status === 403) {
          clearActionToken();
          const retryToken = await ensureActionToken();
          return orig(path, {
            ...opts,
            headers: { ...(opts.headers || {}), 'X-Admin-Action-Token': retryToken },
          });
        }
        throw e;
      }
    };

    window.__adminActionAuthWrapped = true;
  }

  function patchLiveApiErrors() {
    const orig = window.SniperAdminApi;
    if (!orig || window.__adminActionErrPatched) return;
    // wrapApi replaces SniperAdminApi; patch happens after wrap via enhancing inner - done in wrap catch
    window.__adminActionErrPatched = true;
  }

  function patchSetSession() {
    const orig = window.SniperAdminSetProfile;
    if (typeof orig !== 'function' || window.__adminActionSessionPatched) return;
    window.SniperAdminSetProfile = function (profile) {
      if (!profile) clearActionToken();
      return orig(profile);
    };
    window.__adminActionSessionPatched = true;
  }

  function boot() {
    wrapApi();
    patchSetSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('sniper-admin-ready', boot);
})();
