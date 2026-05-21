/**
 * SNIPER Admin — giriş + canlı API verisi
 */
(function () {
  const TOKEN_KEY = 'sniperAdminTokenV2';
  const USER_KEY = 'sniperAdminUserV2';
  const PROFILE_KEY = 'sniperAdminProfileV1';

  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(token, user, profile) {
    if (typeof window.SniperAdminClearActionAuth === 'function') {
      window.SniperAdminClearActionAuth();
    }
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (user) sessionStorage.setItem(USER_KEY, user);
      if (profile) {
        sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        if (typeof window.SniperAdminSetProfile === 'function') {
          window.SniperAdminSetProfile(profile);
        }
      }
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(PROFILE_KEY);
      if (typeof window.SniperAdminSetProfile === 'function') window.SniperAdminSetProfile(null);
    }
  }

  function storeProfileFromBody(body) {
    const profile = {
      username: body.username,
      displayName: body.displayName,
      displayTitle: body.displayTitle,
      role: body.role,
      roleLabel: body.roleLabel,
      isFounder: !!body.isFounder,
      permissions: body.permissions || [],
      id: body.id,
    };
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    if (typeof window.SniperAdminSetProfile === 'function') window.SniperAdminSetProfile(profile);
    return profile;
  }

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || body.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = body.error;
      throw err;
    }
    return body;
  }

  window.SniperAdminApi = api;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function showLogin() {
    $('loginGate')?.classList.remove('hidden');
    $('appLayout')?.classList.add('hidden');
  }

  const FOUNDER_PAGES = ['channels', 'trending', 'risk', 'chains', 'admins', 'env', 'settings'];

  function getProfile() {
    try {
      return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function applyProfileUI(profile) {
    const p = profile || getProfile();
    const nameEl = qs('.admin-name');
    const roleEl = qs('.admin-role');
    const ava = qs('.admin-avatar');
    if (!p) return;
    if (p.isFounder) {
      if (nameEl) nameEl.textContent = p.displayName || 'JUSTİN EVAN';
      if (roleEl) roleEl.textContent = `${p.displayTitle || 'OWNER'} · ${p.roleLabel || 'Kurucu'}`;
      if (ava) ava.textContent = 'JE';
    } else {
      if (nameEl) nameEl.textContent = p.username || 'admin';
      if (roleEl) roleEl.textContent = p.roleLabel || p.role || 'Admin';
      if (ava) ava.textContent = (p.username?.[0] || 'A').toUpperCase();
    }
    document.querySelectorAll('[data-founder-only]').forEach((el) => {
      el.style.display = p.isFounder ? '' : 'none';
    });
  }

  function showApp() {
    $('loginGate')?.classList.add('hidden');
    $('appLayout')?.classList.remove('hidden');
    applyProfileUI(getProfile());
  }

  function setLoginError(msg) {
    const hint = $('loginHint');
    if (!hint) return;
    hint.classList.add('err');
    hint.textContent = msg;
  }

  async function login() {
    const username = ($('loginUser')?.value || '').trim();
    const password = $('loginPass')?.value || '';
    const hint = $('loginHint');
    if (!username || !password) return;
    if (hint) hint.classList.remove('err');
    try {
      const body = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (!body?.token) {
        setLoginError('Sunucu oturum jetonu döndürmedi — sunucuyu yeniden başlatın.');
        return;
      }
      const profile = storeProfileFromBody({
        username: body.username || username,
        role: body.role,
        roleLabel: body.roleLabel,
        isFounder: body.isFounder,
        permissions: body.permissions,
        id: body.id,
      });
      setSession(body.token, profile.username, profile);
      showApp();
      if ($('loginPass')) $('loginPass').value = '';
      try {
        await refreshAll();
        document.dispatchEvent(new Event('sniper-admin-ready'));
      } catch (loadErr) {
        console.warn('[admin] panel verisi:', loadErr);
        setLoginError('Giriş başarılı; panel verisi yüklenemedi. Sayfayı yenileyin (F5).');
      }
    } catch (e) {
      setSession('');
      showLogin();
      if (e.status === 401) setLoginError('Kullanıcı adı veya şifre hatalı (.env içindeki ADMIN_PASSWORD).');
      else if (e.status === 503) setLoginError('Admin kapalı — .env içine ADMIN_USERNAME ve ADMIN_PASSWORD ekle, sunucuyu yeniden başlat.');
      else if (e.message === 'Failed to fetch') setLoginError('Sunucuya bağlanılamadı — npm run miniapp:dev çalışıyor mu? (http://localhost:3080)');
      else setLoginError(`Giriş başarısız${e.status ? ` (HTTP ${e.status})` : ''}.`);
    }
  }

  function renderHealth(probes) {
    const grid = qs('#page-dashboard .health-grid');
    if (!grid) return;
    const items = Object.values(probes || {});
    grid.innerHTML = items.map((p) => {
      const online = p.ok === true;
      const warn = p.ok === null || p.error === 'not_configured';
      const st = online ? 'online' : (warn ? 'warn' : 'offline');
      const label = online ? 'Online' : (warn ? 'N/A' : 'Offline');
      const dot = online ? 'green' : (warn ? 'yellow' : 'red');
      return `<div class="health-item">
        <span class="dot ${dot}"></span>
        <div class="health-info">
          <div class="health-name">${esc(p.id)}</div>
          <div class="health-detail">${esc(p.url || p.error || '—')}</div>
        </div>
        <span class="health-status ${st}">${label}</span>
      </div>`;
    }).join('');
  }

  function renderDashboard(d) {
    const cards = qs('#page-dashboard .stat-grid')?.querySelectorAll('.stat-value');
    if (cards && cards.length >= 4) {
      cards[0].textContent = d.storage?.feedCount ?? '0';
      cards[2].textContent = d.channels?.stats?.total ?? '0';
      cards[3].textContent = d.storage?.reportCount ?? '0';
      const vol = (d.feedPreview || []).reduce((s, t) => s + (t.volume24h || 0), 0);
      cards[1].textContent = vol > 0 ? `$${(vol / 1e6).toFixed(2)}M` : '—';
    }
    renderHealth(d.probes);
    const topbar = qs('.topbar-right');
    if (topbar) {
      const ok = d.ok;
      topbar.innerHTML = `
        <div class="status-dot"><span class="dot ${ok ? 'green' : 'yellow'}"></span>${ok ? 'Sistem OK' : 'Kontrol gerekli'}</div>
        <div class="status-dot"><span class="dot green"></span>${d.storage?.feedCount ?? 0} token</div>
        <div class="status-dot"><span class="dot ${d.storage?.postgres ? 'green' : 'yellow'}"></span>${d.storage?.postgres ? 'PostgreSQL' : 'Dosya'}</div>`;
    }
    const feedTbl = qs('#page-dashboard .tbl tbody');
    if (feedTbl && d.feedPreview?.length) {
      feedTbl.innerHTML = d.feedPreview.slice(0, 5).map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><div class="token-cell"><div class="token-avatar">${esc((it.symbol || '?').slice(0, 2))}</div><div><div class="token-sym">${esc(it.symbol)}</div><div class="token-pair">${esc(it.dex || '')}</div></div></div></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${esc((it.mint || '').slice(0, 8))}…</td>
          <td><span class="dex-badge">${esc(it.dex || '—')}</span></td>
          <td>${esc(it.volume24hFmt || '—')}</td>
          <td style="color:${(it.change24h || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${it.change24h != null ? `${Number(it.change24h).toFixed(1)}%` : '—'}</td>
          <td><span class="risk-pill med">—</span></td>
        </tr>`).join('');
    }
  }

  function renderChannels(d) {
    const page = $('page-channels');
    if (!page) return;
    const stats = d.channels?.stats || {};
    const statVals = page.querySelectorAll('.stat-value');
    if (statVals[0]) statVals[0].textContent = stats.total ?? 0;
    if (statVals[1]) statVals[1].textContent = `${stats.enabled ?? 0} aktif`;
    const card = page.querySelector('.card .channel-row')?.parentElement;
    if (!card) return;
    const hdr = card.querySelector('.section-hdr');
    const items = d.channels?.items || [];
    card.innerHTML = '';
    if (hdr) card.appendChild(hdr);
    else {
      card.innerHTML = '<div class="section-hdr"><div class="card-title" style="margin:0">Kayıtlı Kanallar</div></div>';
    }
    if (!items.length) {
      const empty = document.createElement('p');
      empty.style.cssText = 'padding:12px;color:var(--muted)';
      empty.textContent = 'Kanal yok — botu kanala admin ekle.';
      card.appendChild(empty);
      return;
    }
    items.forEach((ch) => {
      const row = document.createElement('div');
      row.className = 'channel-row';
      row.innerHTML = `
        <div class="channel-icon">📢</div>
        <div class="channel-info">
          <div class="channel-name">${esc(ch.title)}</div>
          <div class="channel-meta">ID: ${esc(ch.id)} · ${esc((ch.chains || []).join(', ') || '—')} · ${ch.enabled ? 'aktif' : 'kapalı'}</div>
        </div>
        <div class="channel-actions">
          <span class="risk-pill ${ch.enabled ? 'low' : 'med'}" style="font-size:9px;">${ch.enabled ? 'AKTİF' : 'KAPALI'}</span>
          ${ch.lastError ? `<span class="tag" style="font-size:9px;color:var(--red)">HATA</span>` : ''}
        </div>`;
      card.appendChild(row);
    });
  }

  function renderFeedPage(d) {
    const tbody = qs('#page-feed tbody');
    if (!tbody) return;
    const items = d.feedPreview || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="10">Feed boş</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><div class="token-cell"><div class="token-avatar">${esc((it.symbol || '?').slice(0, 2))}</div><div><div class="token-sym">${esc(it.symbol)}</div><div class="token-pair">${esc(it.dex || '')}</div></div></div></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${esc((it.mint || '').slice(0, 12))}…</td>
        <td><span class="dex-badge">${esc(it.dex || '—')}</span></td>
        <td>—</td>
        <td style="color:var(--cyan)">${esc(it.volume24hFmt || '—')}</td>
        <td style="color:${(it.change24h || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${it.change24h != null ? `${Number(it.change24h).toFixed(1)}%` : '—'}</td>
        <td><span class="risk-pill med">—</span></td>
        <td>—</td>
        <td><span class="dot green" style="display:inline-block"></span></td>
      </tr>`).join('');
  }

  async function renderEnv() {
    if (!getProfile()?.isFounder) return;
    const wrap = qs('#page-env .card > div[style]') || qs('#page-env .card div');
    const data = await api('/api/admin/env');
    const host = $('page-env');
    if (!host) return;
    let box = host.querySelector('.env-list-live');
    if (!box) {
      box = document.createElement('div');
      box.className = 'env-list-live';
      box.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;';
      const card = host.querySelector('.card');
      if (card) {
        const old = card.querySelector('div[style*="surface2"]');
        if (old) old.remove();
        card.appendChild(box);
      }
    }
    const rows = [];
    (data.groups || []).forEach((g) => {
      g.vars.forEach((v) => {
        rows.push(`<div class="env-row"><span class="env-key">${esc(v.key)}</span><span class="env-val">${esc(v.value)}</span></div>`);
      });
    });
    if (!box) return;
    box.innerHTML = rows.join('') || '<div class="env-row"><span class="env-val">—</span></div>';
  }

  function renderConnections(d) {
    const page = $('page-connections');
    if (!page || !d.urls) return;
    const u = d.urls;
    page.innerHTML = `<div class="card"><div class="card-title">Bağlantılar</div>
      ${Object.entries(u).filter(([, v]) => v).map(([k, url]) => `
        <div class="env-row"><span class="env-key">${esc(k)}</span><span class="env-val">${esc(url)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(url)}">Kopyala</button></div>`).join('')}
    </div>`;
  }

  let dashboardCache = null;

  async function refreshAll() {
    dashboardCache = await api('/api/admin/dashboard');
    try { renderDashboard(dashboardCache); } catch (e) { console.warn('[admin] dashboard:', e); }
    try { renderChannels(dashboardCache); } catch (e) { console.warn('[admin] channels:', e); }
    try { renderFeedPage(dashboardCache); } catch (e) { console.warn('[admin] feed:', e); }
    try { renderConnections(dashboardCache); } catch (e) { console.warn('[admin] connections:', e); }
    try { await renderEnv(); } catch (e) { console.warn('[admin] env:', e); }
  }

  async function boot() {
    try {
      const st = await fetch('/api/admin/status').then((r) => r.json());
      if (st.username && $('loginUser') && !$('loginUser').value) {
        $('loginUser').value = st.username;
      }
      if (!st.enabled && $('loginHint')) {
        $('loginHint').classList.add('err');
        $('loginHint').textContent = 'Sunucuda ADMIN_USERNAME + ADMIN_PASSWORD yok (.env veya Railway).';
        $('btnLogin') && ($('btnLogin').disabled = true);
      } else if (st.enabled && st.username && $('loginHint')) {
        $('loginHint').textContent = `Kullanıcı: ${st.username} — şifre proje kökündeki .env dosyasındaki ADMIN_PASSWORD.`;
      }
    } catch { /* yoksay */ }

    $('btnLogin')?.addEventListener('click', login);
    $('loginPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
    qs('.logout-btn')?.addEventListener('click', () => {
      setSession('');
      showLogin();
      if ($('loginPass')) $('loginPass').value = '';
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy]');
      if (btn?.dataset.copy) navigator.clipboard?.writeText(btn.dataset.copy);
    });

    if (getToken()) {
      try {
        const sess = await api('/api/admin/session', { method: 'POST' });
        const profile = storeProfileFromBody(sess);
        setSession(getToken(), profile.username, profile);
        showApp();
        await refreshAll();
        document.dispatchEvent(new Event('sniper-admin-ready'));
        return;
      } catch {
        setSession('');
      }
    }
    showLogin();
  }

  function patchShowPageGuard() {
    const orig = window.showPage;
    if (typeof orig !== 'function' || window.__adminFounderPageGuard) return;
    window.showPage = function (id) {
      const p = getProfile();
      if (FOUNDER_PAGES.includes(id) && !p?.isFounder) {
        alert('Bu bölüm yalnızca kurucu (OWNER) hesabında.');
        orig('dashboard');
        return;
      }
      orig(id);
    };
    window.__adminFounderPageGuard = true;
  }

  document.addEventListener('sniper-admin-ready', () => {
    applyProfileUI(getProfile());
    patchShowPageGuard();
  });

  boot();
  patchShowPageGuard();
})();
