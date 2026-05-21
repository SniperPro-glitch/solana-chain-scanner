/**
 * SNIPER Admin Control Center
 */
(function () {
  const TOKEN_STORAGE = 'sniperAdminTokenV2';
  const USER_STORAGE = 'sniperAdminUserV2';
  let dashboard = null;

  const $ = (id) => document.getElementById(id);

  function getToken() {
    return sessionStorage.getItem(TOKEN_STORAGE) || '';
  }

  function setSession(token, username) {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE, token);
      if (username) sessionStorage.setItem(USER_STORAGE, username);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE);
      sessionStorage.removeItem(USER_STORAGE);
    }
  }

  async function api(path, opts = {}) {
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function badge(ok) {
    if (ok === true) return '<span class="badge ok">OK</span>';
    if (ok === false) return '<span class="badge err">HATA</span>';
    return '<span class="badge na">—</span>';
  }

  function showLogin() {
    $('loginScreen')?.classList.remove('hidden');
    $('appShell')?.classList.add('hidden');
  }

  function showApp() {
    $('loginScreen')?.classList.add('hidden');
    $('appShell')?.classList.remove('hidden');
    const user = sessionStorage.getItem(USER_STORAGE) || 'admin';
    const el = $('sidebarUser');
    if (el) el.innerHTML = `<strong>${esc(user)}</strong>Oturum açık`;
  }

  let adminEnabled = false;

  async function checkEnabled() {
    try {
      const st = await fetch('/api/admin/status').then((r) => r.json());
      adminEnabled = !!st.enabled;
      const btn = $('btnLogin');
      const hint = $('loginHint');
      if (!adminEnabled) {
        if (hint) {
          hint.innerHTML = 'Sunucuda admin kapalı. <code>.env</code> veya Railway’e <code>ADMIN_USERNAME</code> + <code>ADMIN_PASSWORD</code> ekleyip sunucuyu yeniden başlatın.';
          hint.classList.add('login-hint-err');
        }
        if (btn) btn.disabled = true;
        return;
      }
      if (hint) {
        hint.classList.remove('login-hint-err');
        hint.innerHTML = 'Giriş bilgilerinizi girin (<code>.env</code> / Railway Variables).';
      }
      if (btn) btn.disabled = false;
    } catch {
      adminEnabled = false;
    }
  }

  async function login() {
    const username = ($('loginUser')?.value || '').trim();
    const password = $('loginPass')?.value || '';
    if (!username || !password) return;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'login_failed');
        err.status = res.status;
        throw err;
      }
      setSession(body.token, body.username || username);
      showApp();
      await refreshAll();
    } catch (e) {
      setSession('');
      const hint = $('loginHint');
      if (!hint) return;
      hint.classList.add('login-hint-err');
      if (e.status === 401) {
        hint.textContent = 'Kullanıcı adı veya şifre hatalı.';
      } else if (e.status === 503) {
        hint.innerHTML = 'Admin kapalı — sunucuda <code>ADMIN_USERNAME</code> ve <code>ADMIN_PASSWORD</code> yok. Ekleyip <strong>npm run miniapp:dev</strong> yeniden başlatın.';
      } else {
        hint.textContent = 'Giriş başarısız — sunucu çalışıyor mu kontrol edin.';
      }
    }
  }

  function setView(name) {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === `view-${name}`);
    });
    const active = document.querySelector(`.view#view-${name}`);
    if ($('viewTitle')) $('viewTitle').textContent = active?.dataset.title || name;
  }

  function linkRow(label, url) {
    if (!url) return '';
    return `<div class="link-row">
      <span>${esc(label)}</span>
      <button type="button" class="btn btn-secondary btn-copy" data-copy="${esc(url)}">Kopyala</button>
    </div>`;
  }

  function renderStats(d) {
    const st = d.storage || {};
    const ch = d.channels?.stats || {};
    const uptime = d.service?.uptimeSec != null
      ? `${Math.floor(d.service.uptimeSec / 60)} dk`
      : '—';
    const pg = st.postgres ? 'PostgreSQL' : 'Dosya';
    $('statGrid').innerHTML = [
      card('Feed token', st.feedCount ?? '—', 'Kanal + seed'),
      card('Rapor', st.reportCount ?? '—', 'Mini App'),
      card('Kanallar', ch.total ?? 0, `${ch.enabled ?? 0} aktif`),
      card('Uptime', uptime, `${d.service?.mode || '—'} · ${pg}`),
    ].join('');
  }

  function card(label, value, sub) {
    return `<article class="stat-card">
      <div class="label">${esc(label)}</div>
      <div class="value">${esc(value)}</div>
      <div class="sub">${esc(sub)}</div>
    </article>`;
  }

  function renderProbes(d) {
    const probes = d.probes || {};
    $('probeList').innerHTML = Object.values(probes).map((p) => {
      const err = p.error === 'not_configured' ? 'yapılandırılmadı' : (p.error || '');
      return `<div class="probe-row">
        <div>
          <div class="probe-name">${esc(p.id)}</div>
          <div class="probe-meta">${esc(p.url || '—')}</div>
        </div>
        <div>${badge(p.ok === null ? null : p.ok)}
          <span class="probe-meta">${p.ms != null ? `${p.ms} ms` : ''} ${esc(err)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderQuickLinks(d) {
    const u = d.urls || {};
    const entries = [
      ['Mini App', u.miniApp],
      ['Feed API', u.feedApi],
      ['Admin', u.admin],
      ['Bot API', u.botApi],
    ].filter(([, url]) => url);
    $('quickLinks').innerHTML = entries.map(([label, url]) => `
      <div class="link-row">
        <div><div class="probe-name">${esc(label)}</div><div class="conn-url">${esc(url)}</div></div>
        <button type="button" class="btn btn-secondary btn-copy" data-copy="${esc(url)}">Kopyala</button>
      </div>
    `).join('');
  }

  function renderConnections(d) {
    const u = d.urls || {};
    const entries = Object.entries(u).filter(([, v]) => v);
    $('connGrid').innerHTML = entries.map(([k, url]) => `
      <div class="conn-row">
        <div>
          <div class="probe-name">${esc(k)}</div>
          <div class="conn-url">${esc(url)}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-copy" data-copy="${esc(url)}">Kopyala</button>
      </div>
    `).join('');
  }

  function renderChannels(d) {
    const ch = d.channels?.stats || {};
    $('channelStats').innerHTML = [
      card('Toplam', ch.total ?? 0, 'kayıtlı'),
      card('Aktif', ch.enabled ?? 0, 'enabled'),
      card('Solana', ch.solana ?? 0, 'zincir seçili'),
      card('Hatalı', ch.withErrors ?? 0, 'son hata var'),
    ].join('');
    const tbody = $('channelTable')?.querySelector('tbody');
    if (!tbody) return;
    const items = d.channels?.items || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="4">Kanal verisi yok (bot servisinde veya channels.json)</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((c) => `
      <tr>
        <td><strong>${esc(c.title)}</strong><br><span class="probe-meta">${esc(c.id)}</span></td>
        <td>${esc((c.chains || []).join(', ') || '—')}</td>
        <td>${c.enabled ? badge(true) : badge(false)}</td>
        <td>${c.lastError ? esc(String(c.lastError).slice(0, 80)) : '—'}</td>
      </tr>
    `).join('');
  }

  function renderFeed(d) {
    const st = d.storage || {};
    $('feedStats').innerHTML = [
      card('Listede', (d.feedPreview || []).length, 'önizleme'),
      card('Toplam feed', st.feedCount ?? '—', 'veritabanı'),
      card('Seed', d.flags?.miniAppSeed ? 'Açık' : 'Kapalı', 'MINI_APP_SEED'),
      card('Tarama', d.flags?.solanaScan ? 'Açık' : 'Kapalı', 'SOLANA_SCAN'),
    ].join('');
    const tbody = $('feedTable')?.querySelector('tbody');
    if (!tbody) return;
    const items = d.feedPreview || [];
    tbody.innerHTML = items.length
      ? items.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(it.symbol)}</strong><br><span class="probe-meta">${esc((it.mint || '').slice(0, 12))}…</span></td>
          <td>${esc(it.dex || '—')}</td>
          <td>${esc(it.volume24hFmt || '—')}</td>
          <td>${it.change24h != null ? `${Number(it.change24h).toFixed(2)}%` : '—'}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="5">Feed boş</td></tr>';
  }

  function renderMiniApp(d) {
    const f = d.flags || {};
    $('flagGrid').innerHTML = [
      ['Seed tokenlar', f.miniAppSeed],
      ['Solana tarama', f.solanaScan],
      ['Üst banner', f.banner],
    ].map(([label, on]) => `
      <div class="flag-item"><span>${esc(label)}</span>${on ? badge(true) : badge(false)}</div>
    `).join('');
    $('promoBlock').textContent = JSON.stringify(d.promo || {}, null, 2);
  }

  async function renderEnv() {
    const data = await api('/api/admin/env');
    const root = $('envGroups');
    if (!root) return;
    root.innerHTML = (data.groups || []).map((g) => `
      <section class="env-group">
        <h3>${esc(g.title)}</h3>
        ${(g.vars || []).map((v) => `
          <div class="env-row">
            <span class="env-key">${esc(v.key)}</span>
            <span class="env-val${v.set ? '' : ' unset'}">${esc(v.value)}</span>
          </div>
        `).join('')}
      </section>
    `).join('');
  }

  function setGlobalStatus(d) {
    const pill = $('globalStatus');
    if (!pill) return;
    pill.classList.remove('ok', 'warn', 'bad');
    if (d.ok) {
      pill.textContent = 'Sistem sağlıklı';
      pill.classList.add('ok');
    } else {
      pill.textContent = 'Dikkat gerekli';
      pill.classList.add('warn');
    }
    if ($('lastRefresh')) {
      $('lastRefresh').textContent = `Son güncelleme: ${new Date().toLocaleString('tr-TR')}`;
    }
  }

  async function refreshAll() {
    dashboard = await api('/api/admin/dashboard');
    setGlobalStatus(dashboard);
    renderStats(dashboard);
    renderProbes(dashboard);
    renderQuickLinks(dashboard);
    renderConnections(dashboard);
    renderChannels(dashboard);
    renderFeed(dashboard);
    renderMiniApp(dashboard);
    await renderEnv();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn?.dataset.copy) {
      navigator.clipboard?.writeText(btn.dataset.copy);
      btn.textContent = 'OK';
      setTimeout(() => { btn.textContent = 'Kopyala'; }, 1200);
    }
    const nav = e.target.closest('.nav-item');
    if (nav?.dataset.view) setView(nav.dataset.view);
  });

  $('btnLogin')?.addEventListener('click', login);
  $('loginPass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  $('loginUser')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('loginPass')?.focus();
  });
  $('btnLogout')?.addEventListener('click', () => {
    setSession('');
    if ($('loginPass')) $('loginPass').value = '';
    showLogin();
  });
  $('btnRefresh')?.addEventListener('click', () => refreshAll().catch(() => {}));

  async function boot() {
    await checkEnabled();
    if (getToken()) {
      try {
        await api('/api/admin/session', { method: 'POST' });
        showApp();
        await refreshAll();
        return;
      } catch {
        setSession('');
      }
    }
    showLogin();
  }

  boot();
})();
