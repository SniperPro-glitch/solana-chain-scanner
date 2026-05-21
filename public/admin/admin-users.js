/**
 * Admin — Kullanıcılar & yetki matrisi (yalnızca kurucu düzenler).
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);

  const PROFILE_KEY = 'sniperAdminProfileV1';

  let catalog = [];
  let founderOnlyCatalog = [];
  let rolePresets = {};
  let users = [];
  let selectedId = null;
  let matrixDirty = false;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function getProfile() {
    try {
      return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isFounder() {
    return !!getProfile()?.isFounder;
  }

  function setStatus(msg, isErr) {
    const el = $('adminsStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function setMatrixSaveMsg(msg, isOk) {
    const el = $('adminsMatrixSaveMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isOk ? 'var(--green)' : (msg ? 'var(--red)' : 'var(--muted)');
    el.style.fontWeight = isOk ? '700' : '400';
  }

  function updateMatrixSaveBtn() {
    const bar = $('adminsMatrixSaveBar');
    const btn = $('adminsMatrixSaveBtn');
    const u = selectedUser();
    const canEdit = isFounder() && u?.canDelete;
    if (bar) bar.style.display = canEdit ? 'flex' : 'none';
    if (btn) btn.disabled = !matrixDirty || !canEdit;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function roleBadge(user) {
    const icons = { founder: '👑', viewer: '👁', moderator: '🛡', admin: '⚙️' };
    const colors = {
      founder: 'rgba(245,166,35,0.15);color:#f5a623;border:1px solid rgba(245,166,35,0.25)',
      moderator: 'rgba(0,229,255,0.12);color:var(--cyan);border:1px solid rgba(0,229,255,0.2)',
      admin: 'rgba(0,255,136,0.12);color:var(--green);border:1px solid rgba(0,255,136,0.25)',
      viewer: 'rgba(255,255,255,0.06);color:var(--muted);border:1px solid var(--border)',
    };
    const role = user.role || 'viewer';
    const style = colors[role] || colors.viewer;
    const label = user.isFounder ? 'KURUCU' : (user.roleLabel || role).toUpperCase();
    return `<span style="background:${style};font-size:10px;font-weight:700;border-radius:20px;padding:3px 9px;">${icons[role] || '👑'} ${esc(label)}</span>`;
  }

  function permTags(perms, max = 4) {
    const labels = {};
    catalog.forEach((p) => { labels[p.key] = p.label; });
    const list = perms || [];
    if (list.includes('admins.manage') || (catalog.length && list.length >= catalog.length + founderOnlyCatalog.length)) {
      return '<span class="tag" style="font-size:9px;color:var(--green);">Tümü + Kurucu</span>';
    }
    const shown = list.slice(0, max).map((k) => {
      const short = (labels[k] || k).split('(')[0].trim().slice(0, 14);
      return `<span class="tag" style="font-size:9px;">${esc(short)}</span>`;
    }).join('');
    const more = list.length > max ? `<span class="tag" style="font-size:9px;color:var(--muted);">+${list.length - max}</span>` : '';
    return shown + more;
  }

  function selectedUser() {
    return users.find((u) => u.id === selectedId) || null;
  }

  function renderUserList() {
    const tbody = $('adminsTableBody');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:20px;">Kayıt yok</td></tr>';
      return;
    }
    tbody.innerHTML = users.map((u) => {
      const sel = u.id === selectedId;
      const letter = u.isFounder ? 'JE' : (u.username || '?').charAt(0).toUpperCase();
      const grad = u.isFounder
        ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
        : 'linear-gradient(135deg,#0d9488,#0891b2)';
      const displayName = u.isFounder ? (u.displayName || 'JUSTİN EVAN') : u.username;
      const sub = u.isFounder
        ? `${u.displayTitle || 'OWNER'} · Kurucu`
        : esc(u.id.slice(0, 8));
      const ops = u.canDelete && isFounder()
        ? `<button type="button" class="btn btn-danger btn-sm admins-del-btn" data-id="${esc(u.id)}">Sil</button>`
        : '<span style="font-size:11px;color:var(--muted);">Silinemez</span>';
      return `<tr class="admins-user-row" data-id="${esc(u.id)}" style="cursor:pointer;${sel ? 'background:rgba(0,255,136,.04);' : ''}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${esc(letter)}</div>
            <div><div style="font-size:13px;font-weight:600;">${esc(displayName)}</div><div style="font-size:10px;color:var(--muted);">${sub}</div></div>
          </div>
        </td>
        <td>${roleBadge(u)}</td>
        <td style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--muted);">${fmtDate(u.lastLoginAt)}</td>
        <td><span class="dot ${u.active !== false ? 'green' : ''}" style="display:inline-block;${u.active === false ? 'background:var(--muted2);' : ''}"></span></td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${u.isFounder ? '<span class="tag" style="font-size:9px;color:var(--green);">OWNER · Kurucu yetkileri</span>' : permTags(u.permissions)}</div></td>
        <td style="padding-top:11px;">${ops}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.admins-user-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.admins-del-btn')) return;
        selectUser(row.dataset.id);
      });
    });
    tbody.querySelectorAll('.admins-del-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteUser(btn.dataset.id);
      });
    });
  }

  function renderPermCheckboxes(container, perms, editable) {
    if (!container) return;
    const set = new Set(perms || []);
    container.innerHTML = catalog.map((p) => {
      const on = set.has(p.key);
      const lock = p.key === 'admins.manage' && !editable;
      const disabled = !editable ? 'disabled' : '';
      const checked = on ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text);cursor:${editable ? 'pointer' : 'not-allowed'};opacity:${editable ? '1' : '.65'};">
        <input type="checkbox" class="admins-perm-cb" data-key="${esc(p.key)}" ${checked} ${disabled} style="accent-color:var(--green);width:14px;height:14px;" />
        <span>${esc(p.label)}</span>
      </label>`;
    }).join('');
  }

  function readCheckboxes(container) {
    const keys = [];
    container?.querySelectorAll('.admins-perm-cb:checked').forEach((cb) => {
      keys.push(cb.dataset.key);
    });
    return keys;
  }

  function renderMatrix() {
    const body = $('adminsMatrixBody');
    const col = $('adminsMatrixColUser');
    const hint = $('adminsMatrixHint');
    const u = selectedUser();
    if (!body) return;

    if (!u) {
      if (col) col.textContent = '—';
      if (hint) hint.textContent = 'Listeden bir kullanıcı seçin';
      setMatrixSaveMsg('');
      matrixDirty = false;
      updateMatrixSaveBtn();
      body.innerHTML = '<tr><td colspan="2" style="color:var(--muted);text-align:center;padding:20px;">Kullanıcı seçilmedi</td></tr>';
      return;
    }

    const displayLabel = u.isFounder ? (u.displayName || u.username) : u.username;
    if (col) col.textContent = esc(displayLabel);
    const canEdit = isFounder() && u.canDelete;
    if (hint) {
      hint.textContent = canEdit
        ? `${displayLabel} — yetkileri seç, Kaydet ile onayla`
        : `${displayLabel} — kurucu hesabı (tüm yetkiler)`;
    }
    if (!canEdit) {
      matrixDirty = false;
      setMatrixSaveMsg('');
    }
    updateMatrixSaveBtn();

    const assignableRows = catalog.map((p) => {
      const on = (u.permissions || []).includes(p.key);
      const cell = canEdit
        ? `<input type="checkbox" class="admins-matrix-cb" data-key="${esc(p.key)}" ${on ? 'checked' : ''} style="accent-color:var(--green);width:16px;height:16px;cursor:pointer;" />`
        : `<span style="color:${on ? 'var(--green)' : 'var(--muted2)'};font-size:14px;">${on ? '✓' : '—'}</span>`;
      return `<tr><td style="color:var(--muted);">${esc(p.label)}</td><td style="text-align:center;">${cell}</td></tr>`;
    }).join('');

    const founderRows = founderOnlyCatalog.map((p) => {
      const on = u.isFounder;
      return `<tr style="opacity:.85;"><td style="color:var(--yellow);">${esc(p.label)} <span style="font-size:9px;">(kurucu)</span></td><td style="text-align:center;color:var(--green);font-size:14px;">${on ? '✓' : '—'}</td></tr>`;
    }).join('');

    body.innerHTML = assignableRows
      + (founderRows ? `<tr><td colspan="2" style="padding:10px 0 4px;font-size:10px;color:var(--yellow);font-weight:700;">Kurucuya özel — atanamaz</td></tr>${founderRows}` : '');

    if (canEdit) {
      body.querySelectorAll('.admins-matrix-cb').forEach((cb) => {
        cb.addEventListener('change', () => {
          matrixDirty = true;
          setMatrixSaveMsg('');
          updateMatrixSaveBtn();
        });
      });
    }
  }

  function readMatrixPermissions() {
    const keys = [];
    $('adminsMatrixBody')?.querySelectorAll('.admins-matrix-cb:checked').forEach((cb) => {
      keys.push(cb.dataset.key);
    });
    return keys;
  }

  async function saveMatrixPermissions() {
    const u = selectedUser();
    if (!u || !u.canDelete || !isFounder() || !matrixDirty) return;
    const btn = $('adminsMatrixSaveBtn');
    if (btn) btn.disabled = true;
    setMatrixSaveMsg('Kaydediliyor…');
    setStatus('');
    try {
      const data = await window.SniperAdminApi(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: readMatrixPermissions() }),
      });
      const idx = users.findIndex((x) => x.id === u.id);
      if (idx >= 0) users[idx] = data.user;
      matrixDirty = false;
      renderUserList();
      renderMatrix();
      setMatrixSaveMsg('Kayıt başarılı.');
      setStatus('Kayıt başarılı.');
    } catch (e) {
      setMatrixSaveMsg(e.message || 'Kayıt başarısız.', false);
      setStatus(e.message || 'Kaydedilemedi', true);
      updateMatrixSaveBtn();
    }
  }

  function selectUser(id) {
    if (matrixDirty && !confirm('Kaydedilmemiş yetki değişiklikleri var. Devam edilsin mi?')) return;
    selectedId = id;
    matrixDirty = false;
    setMatrixSaveMsg('');
    renderUserList();
    renderMatrix();
  }

  function applyRolePresetToAddForm() {
    const role = $('adminsAddRole')?.value || 'viewer';
    const preset = rolePresets[role];
    renderPermCheckboxes($('adminsAddPermGrid'), preset?.permissions || [], true);
  }

  function updateFounderUi() {
    const founder = isFounder();
    const banner = $('adminsFounderOnly');
    const addBtn = $('adminsBtnShowAdd');
    if (banner) {
      banner.style.display = founder ? 'none' : 'block';
      banner.textContent = founder
        ? ''
        : 'Admin kullanıcı ekleme ve yetki düzenleme yalnızca kurucu hesabında (.env girişi).';
    }
    if (addBtn) addBtn.style.display = founder ? '' : 'none';
  }

  async function loadCatalog() {
    const data = await window.SniperAdminApi('/api/admin/permissions');
    catalog = data.permissions || [];
    founderOnlyCatalog = data.founderOnly || [];
    rolePresets = data.rolePresets || {};
    const hint = $('adminsFounderOnlyHint');
    if (hint && founderOnlyCatalog.length) {
      hint.textContent = `Kurucuya özel (seçilemez): ${founderOnlyCatalog.map((p) => p.label).join(', ')}.`;
    }
  }

  async function loadUsers() {
    const data = await window.SniperAdminApi('/api/admin/users');
    users = data.users || [];
    if (!selectedId && users.length) selectedId = users[0].id;
    renderUserList();
    renderMatrix();
  }

  async function submitAdd() {
    if (!isFounder()) return;
    const username = ($('adminsAddUsername')?.value || '').trim();
    const password = $('adminsAddPassword')?.value || '';
    const role = $('adminsAddRole')?.value || 'viewer';
    const permissions = readCheckboxes($('adminsAddPermGrid'));
    if (!username || !password) {
      setStatus('Kullanıcı adı ve şifre gerekli.', true);
      return;
    }
    setStatus('Ekleniyor…');
    try {
      await window.SniperAdminApi('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, permissions }),
      });
      $('add-admin-form').style.display = 'none';
      $('adminsAddUsername').value = '';
      $('adminsAddPassword').value = '';
      await loadUsers();
      setStatus('Kayıt başarılı — kullanıcı eklendi.');
    } catch (e) {
      setStatus(e.message || 'Eklenemedi', true);
    }
  }

  async function deleteUser(id) {
    if (!isFounder() || !confirm('Bu admin kullanıcısı silinsin mi?')) return;
    setStatus('Siliniyor…');
    try {
      await window.SniperAdminApi(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (selectedId === id) selectedId = null;
      await loadUsers();
      setStatus('Silindi.');
    } catch (e) {
      setStatus(e.message || 'Silinemedi', true);
    }
  }

  async function onPageOpen() {
    if (!$('page-admins')) return;
    updateFounderUi();
    setStatus('');
    try {
      if (!catalog.length) await loadCatalog();
      await loadUsers();
      applyRolePresetToAddForm();
    } catch (e) {
      if (e.status === 403) {
        $('adminsTableBody').innerHTML = '<tr><td colspan="6" style="color:var(--yellow);text-align:center;padding:20px;">Bu sayfayı yönetmek için kurucu hesabıyla giriş yapın.</td></tr>';
        setStatus(e.message, true);
      } else {
        setStatus(e.message || 'Yüklenemedi', true);
      }
    }
  }

  function bind() {
    $('adminsBtnShowAdd')?.addEventListener('click', () => {
      $('add-admin-form').style.display = 'block';
      applyRolePresetToAddForm();
    });
    $('adminsBtnCancelAdd')?.addEventListener('click', () => {
      $('add-admin-form').style.display = 'none';
    });
    $('adminsBtnSubmitAdd')?.addEventListener('click', () => submitAdd());
    $('adminsAddRole')?.addEventListener('change', applyRolePresetToAddForm);
    $('adminsMatrixSaveBtn')?.addEventListener('click', () => saveMatrixPermissions());

    const orig = window.showPage;
    if (typeof orig === 'function' && !window.__adminUsersShowPatched) {
      window.showPage = function (id) {
        orig(id);
        if (id === 'admins') onPageOpen();
      };
      window.__adminUsersShowPatched = true;
    }

    document.addEventListener('sniper-admin-ready', () => {
      updateFounderUi();
      if ($('page-admins')?.classList.contains('active')) onPageOpen();
    });

    window.addEventListener('sniper-admin-profile', updateFounderUi);
  }

  window.SniperAdminSetProfile = function (profile) {
    if (profile) {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      sessionStorage.removeItem(PROFILE_KEY);
    }
    window.dispatchEvent(new Event('sniper-admin-profile'));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
