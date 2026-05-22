/** Telegram mini app — kurucu / ADMIN_USER_ID (initData veya telegramId). */

const crypto = require('crypto');

function getBotToken() {
  return String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

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

/** Telegram WebApp initData HMAC doğrulama → user objesi */
function parseUserFromInitData(initData, botToken) {
  const raw = String(initData || '').trim();
  const token = String(botToken || '').trim();
  if (!raw || !token) return null;
  try {
    const params = new URLSearchParams(raw);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculated = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');
    if (calculated !== hash) return null;
    const userJson = params.get('user');
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

function resolveAdminFromInitData(initData) {
  const user = parseUserFromInitData(initData, getBotToken());
  if (!user?.id) return { allowed: false, userId: '' };
  const userId = String(user.id);
  return { allowed: isTelegramAdmin(userId), userId };
}

async function handleMiniAppAdminAccess(req, res, url, sendJson, readBody) {
  if (url.pathname !== '/api/miniapp/admin-access') return false;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {}, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return true;
  }

  if (req.method === 'POST') {
    try {
      const raw = readBody ? await readBody(req) : Buffer.alloc(0);
      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const initData = String(payload.initData || '').trim();
      const { allowed, userId } = resolveAdminFromInitData(initData);
      sendJson(res, 200, { allowed, userId: userId || undefined, adminUrl: '/admin/' });
    } catch (e) {
      sendJson(res, 400, { allowed: false, error: 'bad_request', message: e.message });
    }
    return true;
  }

  if (req.method === 'GET') {
    const initData = url.searchParams.get('initData') || '';
    if (initData) {
      const { allowed, userId } = resolveAdminFromInitData(initData);
      sendJson(res, 200, { allowed, userId: userId || undefined, adminUrl: '/admin/' });
      return true;
    }
    const telegramId = url.searchParams.get('telegramId') || '';
    const allowed = isTelegramAdmin(telegramId);
    sendJson(res, 200, { allowed, adminUrl: '/admin/' });
    return true;
  }

  return false;
}

module.exports = {
  getBotToken,
  getAdminTelegramIds,
  isTelegramAdmin,
  parseUserFromInitData,
  resolveAdminFromInitData,
  handleMiniAppAdminAccess,
};
