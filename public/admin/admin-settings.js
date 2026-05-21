/**
 * Admin — Ayarlar (mockup admin_06: Admin Hesabı + Genel Ayarlar).
 */
(function () {
  const $ = (id) => document.getElementById(id);

  function setStatus(elId, msg, isErr) {
    const el = $(elId);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  async function load() {
    if (!window.SniperAdminApi) return;
    try {
      const data = await window.SniperAdminApi('/api/admin/settings');
      const s = data.settings || {};
      if ($('settingsUsername')) $('settingsUsername').value = data.username || 'admin';
      if ($('settingsSiteTitle')) $('settingsSiteTitle').value = s.siteTitle || '';
      if ($('settingsLang')) $('settingsLang').value = s.defaultLang || 'tr';
      if ($('settingsFeedRefresh')) $('settingsFeedRefresh').value = s.feedRefreshSec ?? 30;
      if ($('settingsMaintenance')) $('settingsMaintenance').checked = !!s.maintenanceMode;
    } catch (e) {
      if (e.status === 403) {
        setStatus('settingsStatus', 'Genel ayarlar yalnızca OWNER (kurucu) hesabında.', true);
      } else {
        setStatus('settingsStatus', e.message || 'Yüklenemedi', true);
      }
    }
  }

  async function saveGeneral() {
    const btn = $('settingsSave');
    if (btn) btn.disabled = true;
    setStatus('settingsStatus', 'Kaydediliyor…');
    try {
      await window.SniperAdminApi('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          siteTitle: $('settingsSiteTitle')?.value,
          defaultLang: $('settingsLang')?.value,
          feedRefreshSec: $('settingsFeedRefresh')?.value,
          maintenanceMode: $('settingsMaintenance')?.checked,
        }),
      });
      setStatus('settingsStatus', 'Kaydedildi.');
    } catch (e) {
      setStatus('settingsStatus', e.message || 'Kaydedilemedi', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function changePassword() {
    const btn = $('settingsChangePass');
    if (btn) btn.disabled = true;
    setStatus('settingsPassStatus', 'Güncelleniyor…');
    try {
      const result = await window.SniperAdminApi('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: $('settingsCurrentPass')?.value,
          newPassword: $('settingsNewPass')?.value,
        }),
      });
      if ($('settingsCurrentPass')) $('settingsCurrentPass').value = '';
      if ($('settingsNewPass')) $('settingsNewPass').value = '';
      setStatus('settingsPassStatus', result.message || 'Şifre güncellendi.');
    } catch (e) {
      setStatus('settingsPassStatus', e.message || 'Güncellenemedi', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bind() {
    $('settingsSave')?.addEventListener('click', saveGeneral);
    $('settingsChangePass')?.addEventListener('click', changePassword);
    const orig = window.showPage;
    if (typeof orig === 'function' && !window.__adminSettingsShowPatched) {
      window.showPage = function (id) {
        orig(id);
        if (id === 'settings') load();
      };
      window.__adminSettingsShowPatched = true;
    }
    document.addEventListener('sniper-admin-ready', load);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
