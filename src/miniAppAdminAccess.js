/** Telegram mini app — kurucu / ADMIN_USER_ID için yönetim paneli girişi. */

function getAdminTelegramIds() {
  const raw = String(process.env.ADMIN_USER_ID || '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isTelegramAdmin(telegramUserId) {
  if (telegramUserId == null || telegramUserId === '') return false;
  const id = String(telegramUserId);
  return getAdminTelegramIds().includes(id);
}

function handleMiniAppAdminAccess(req, res, url, sendJson) {
  if (req.method !== 'GET' || url.pathname !== '/api/miniapp/admin-access') {
    return false;
  }
  const telegramId = url.searchParams.get('telegramId') || '';
  const allowed = isTelegramAdmin(telegramId);
  sendJson(res, 200, {
    allowed,
    adminUrl: '/admin/',
  });
  return true;
}

module.exports = {
  getAdminTelegramIds,
  isTelegramAdmin,
  handleMiniAppAdminAccess,
};
