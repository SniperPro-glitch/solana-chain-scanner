// Admin — hassas işlemler öncesi şifre doğrulama (step-up auth).

const crypto = require('crypto');

const ACTION_TTL_MS = 5 * 60 * 1000;

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ACTION_AUTH_EXEMPT = new Set([
  '/api/admin/login',
  '/api/admin/register',
  '/api/admin/verify-action',
  '/api/admin/session',
  '/api/admin/feed/preview',
]);

function actionSecret() {
  const custom = String(process.env.ADMIN_ACTION_SECRET || process.env.ADMIN_SESSION_SECRET || '').trim();
  if (custom) return custom;
  const { getAdminCredentials } = require('./adminPanel');
  const { username, password } = getAdminCredentials();
  return `sniper-admin-action:${username}:${password}`;
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function normalizeAdminPassword(password) {
  return String(password || '').replace(/\r$/, '');
}

/** Oturumdaki kullanıcının kendi şifresini doğrular (kurucu .env veya JSON admin). */
function verifyPasswordForUsername(username, password) {
  const { getAdminCredentials } = require('./adminPanel');
  const cred = getAdminCredentials();
  const userIn = String(username || '').trim();
  const passIn = normalizeAdminPassword(password);
  if (!userIn || !passIn) return false;

  if (timingSafeEqual(userIn, cred.username) && timingSafeEqual(passIn, cred.password)) {
    return true;
  }

  const adminUsersStore = require('./adminUsersStore');
  const row = adminUsersStore.verifyStoredUser(userIn, passIn);
  return !!row;
}

function issueActionToken(username) {
  const user = String(username || '').trim();
  const exp = Date.now() + ACTION_TTL_MS;
  const payload = `act|${user}|${exp}`;
  const sig = crypto
    .createHmac('sha256', actionSecret())
    .update(payload)
    .digest('base64url');
  return {
    actionToken: Buffer.from(`${payload}|${sig}`).toString('base64url'),
    expiresAt: exp,
    expiresInSec: Math.floor(ACTION_TTL_MS / 1000),
  };
}

function verifyActionToken(token, username) {
  if (!token) return false;
  try {
    const raw = Buffer.from(String(token), 'base64url').toString('utf8');
    const lastPipe = raw.lastIndexOf('|');
    const secondPipe = raw.indexOf('|');
    const thirdPipe = raw.indexOf('|', secondPipe + 1);
    if (secondPipe < 0 || thirdPipe < 0 || lastPipe <= thirdPipe) return false;

    const prefix = raw.slice(0, secondPipe);
    const user = raw.slice(secondPipe + 1, thirdPipe);
    const exp = Number(raw.slice(thirdPipe + 1, lastPipe));
    const sig = raw.slice(lastPipe + 1);

    if (prefix !== 'act' || user !== String(username || '').trim()) return false;
    if (!Number.isFinite(exp) || Date.now() > exp) return false;

    const payload = `${prefix}|${user}|${exp}`;
    const expected = crypto
      .createHmac('sha256', actionSecret())
      .update(payload)
      .digest('base64url');
    return timingSafeEqual(sig, expected);
  } catch {
    return false;
  }
}

function readActionToken(req) {
  const h = req.headers || {};
  return String(h['x-admin-action-token'] || h['X-Admin-Action-Token'] || '').trim();
}

function requiresActionAuth(req, url) {
  if (!url.pathname.startsWith('/api/admin')) return false;
  if (!MUTATION_METHODS.has(req.method)) return false;
  if (ACTION_AUTH_EXEMPT.has(url.pathname)) return false;
  if (req.method === 'POST' && url.pathname === '/api/admin/change-password') return false;
  return true;
}

function assertActionAuthForRoute(req, url, auth) {
  if (!requiresActionAuth(req, url)) return { ok: true };
  const token = readActionToken(req);
  if (verifyActionToken(token, auth.username)) return { ok: true };
  return {
    ok: false,
    error: 'action_auth_required',
    message: 'Değişiklik yapmak için kendi şifrenizi doğrulayın.',
  };
}

module.exports = {
  ACTION_TTL_MS,
  verifyPasswordForUsername,
  issueActionToken,
  verifyActionToken,
  requiresActionAuth,
  assertActionAuthForRoute,
  readActionToken,
};
