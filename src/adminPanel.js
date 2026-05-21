// SNIPER Admin — durum, bağlantılar, feed, kanal özeti (API).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, isPersistentDataDir } = require('./data-path');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Shell'deki eski ADMIN_* değişkenleri .env'i ezmesin (Windows dev). */
function applyAdminEnvFromFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const parsed = require('dotenv').parse(fs.readFileSync(envPath, 'utf8'));
    if (parsed.ADMIN_USERNAME != null && String(parsed.ADMIN_USERNAME).trim()) {
      process.env.ADMIN_USERNAME = String(parsed.ADMIN_USERNAME).trim();
    }
    if (parsed.ADMIN_PASSWORD != null && String(parsed.ADMIN_PASSWORD).length > 0) {
      process.env.ADMIN_PASSWORD = String(parsed.ADMIN_PASSWORD).replace(/\r$/, '');
    }
  } catch (e) {
    console.warn('[admin] .env admin kimlik okunamadı:', e.message);
  }
}

applyAdminEnvFromFile();

const ENV_GROUPS = [
  {
    id: 'core',
    title: 'Çekirdek',
    keys: [
      'BOT_TOKEN',
      'ADMIN_USER_ID',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD',
      'WEB_APP_URL',
      'MINI_APP_ENABLED',
      'MINIAPP_ONLY',
      'DATABASE_URL',
    ],
  },
  {
    id: 'bot',
    title: 'Bot & Kanal',
    keys: [
      'SOLANA_SCAN_ENABLED',
      'SOLANA_SCAN_INTERVAL_MIN',
      'SOLANA_SCAN_POOL_LIMIT',
      'CHANNEL_USERBOT_REQUIRED',
      'TG_API_ID',
      'TG_SESSION',
      'TELEGRAM_CHANNEL_IDS',
    ],
  },
  {
    id: 'dex',
    title: 'DEX & Feed',
    keys: [
      'BOT_API_URL',
      'BOT_RAILWAY_PRIVATE_DOMAIN',
      'MINI_APP_SEED',
      'MINI_APP_BANNER_ENABLED',
      'CROP_PUBLISH_KEY',
    ],
  },
  {
    id: 'rpc',
    title: 'RPC & Keşif',
    keys: [
      'HELIUS_API_KEY',
      'SOLANA_RPC_URL',
      'PUMP_DISCOVERY_ENABLED',
      'RUGCHECK_ENABLED',
    ],
  },
];

function normalizeAdminPassword(raw) {
  return String(raw ?? '').replace(/\r$/, '');
}

function getAdminCredentials() {
  applyAdminEnvFromFile();
  let username = String(
    process.env.ADMIN_USERNAME || process.env.ADMIN_PANEL_USER || '',
  ).trim();
  let password = normalizeAdminPassword(
    process.env.ADMIN_PASSWORD || process.env.ADMIN_PANEL_PASSWORD || '',
  );
  try {
    const { loadCredentialOverride } = require('./adminSettingsStore');
    const o = loadCredentialOverride();
    if (o?.username) username = String(o.username).trim();
    if (o?.password) password = normalizeAdminPassword(o.password);
  } catch { /* */ }
  return { username, password };
}

function isAdminEnabled() {
  const { username, password } = getAdminCredentials();
  return !!(username && password);
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function sessionSecret() {
  const custom = String(process.env.ADMIN_SESSION_SECRET || '').trim();
  if (custom) return custom;
  const { username, password } = getAdminCredentials();
  return `sniper-admin:${username}:${password}`;
}

function issueSessionToken(username) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${username}|${exp}`;
  const sig = crypto
    .createHmac('sha256', sessionSecret())
    .update(payload)
    .digest('base64url');
  return {
    token: Buffer.from(`${payload}|${sig}`).toString('base64url'),
    expiresAt: exp,
    username,
  };
}

function verifySessionToken(token) {
  if (!token) return { ok: false, error: 'unauthorized' };
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const lastPipe = raw.lastIndexOf('|');
    const secondPipe = raw.indexOf('|');
    if (secondPipe < 0 || lastPipe <= secondPipe) return { ok: false, error: 'unauthorized' };
    const username = raw.slice(0, secondPipe);
    const exp = Number(raw.slice(secondPipe + 1, lastPipe));
    const sig = raw.slice(lastPipe + 1);
    if (!username || !Number.isFinite(exp) || Date.now() > exp) {
      return { ok: false, error: 'session_expired' };
    }
    const payload = `${username}|${exp}`;
    const expected = crypto
      .createHmac('sha256', sessionSecret())
      .update(payload)
      .digest('base64url');
    if (!timingSafeEqual(sig, expected)) return { ok: false, error: 'unauthorized' };
    return { ok: true, username };
  } catch {
    return { ok: false, error: 'unauthorized' };
  }
}

function readBearerToken(req) {
  const bearer = String(req.headers?.authorization || '');
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return String(req.headers?.['x-admin-token'] || '').trim();
}

function verifyAdmin(req) {
  if (!isAdminEnabled()) return { ok: false, error: 'admin_disabled' };
  const tok = verifySessionToken(readBearerToken(req));
  if (!tok.ok) return tok;
  const profile = resolveAdminProfile(tok.username);
  if (!profile) return { ok: false, error: 'unauthorized' };
  return { ok: true, ...profile };
}

function resolveAdminProfile(username) {
  const cred = getAdminCredentials();
  const uname = String(username || '').trim();
  const { permissionsFromRole } = require('./adminPermissions');
  if (cred.username && timingSafeEqual(uname, cred.username)) {
    const { FOUNDER_PROFILE } = require('./adminPermissions');
    return {
      username: cred.username,
      displayName: FOUNDER_PROFILE.displayName,
      displayTitle: FOUNDER_PROFILE.displayTitle,
      role: 'founder',
      roleLabel: FOUNDER_PROFILE.roleLabel,
      isFounder: true,
      permissions: permissionsFromRole('founder'),
      id: 'founder-env',
      canDelete: false,
    };
  }
  const adminUsersStore = require('./adminUsersStore');
  const row = adminUsersStore.findByUsername(uname);
  if (!row || row.active === false) return null;
  return {
    username: row.username,
    role: row.role,
    roleLabel: row.roleLabel,
    isFounder: false,
    permissions: row.permissions,
    id: row.id,
    canDelete: true,
  };
}

function verifyLogin(username, password) {
  if (!isAdminEnabled()) return { ok: false, error: 'admin_disabled' };
  const cred = getAdminCredentials();
  const userIn = String(username || '').trim();
  const passIn = normalizeAdminPassword(password);
  if (timingSafeEqual(userIn, cred.username) && timingSafeEqual(passIn, cred.password)) {
    const profile = resolveAdminProfile(cred.username);
    return { ok: true, ...profile };
  }
  const adminUsersStore = require('./adminUsersStore');
  const row = adminUsersStore.verifyStoredUser(userIn, passIn);
  if (row) {
    return {
      ok: true,
      username: row.username,
      role: row.role,
      roleLabel: row.roleLabel,
      isFounder: false,
      permissions: row.permissions,
      id: row.id,
      canDelete: true,
    };
  }
  return { ok: false, error: 'invalid_credentials' };
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function maskSecret(val) {
  const s = String(val || '').trim();
  if (!s) return { set: false, preview: '—' };
  if (s.length <= 8) return { set: true, preview: '••••••••' };
  return { set: true, preview: `${s.slice(0, 4)}…${s.slice(-4)}` };
}

function envSummary() {
  const allKeys = new Set();
  for (const g of ENV_GROUPS) g.keys.forEach((k) => allKeys.add(k));

  const groups = ENV_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    vars: g.keys.map((key) => {
      const raw = process.env[key];
      const sensitive = /TOKEN|KEY|SECRET|PASSWORD|SESSION|HASH|URL/i.test(key)
        && !/ENABLED|INTERVAL|LIMIT/i.test(key);
      if (sensitive) {
        const m = maskSecret(raw);
        return { key, set: m.set, value: m.preview, sensitive: true };
      }
      const set = raw != null && String(raw).trim() !== '';
      return {
        key,
        set,
        value: set ? String(raw).trim().slice(0, 120) : '—',
        sensitive: false,
      };
    }),
  }));

  const extra = Object.keys(process.env)
    .filter((k) => /^[A-Z][A-Z0-9_]+$/.test(k) && !allKeys.has(k))
    .sort()
    .slice(0, 40)
    .map((key) => {
      const raw = process.env[key];
      const sensitive = /TOKEN|KEY|SECRET|PASSWORD|SESSION/i.test(key);
      if (sensitive) {
        const m = maskSecret(raw);
        return { key, set: m.set, value: m.preview, sensitive: true };
      }
      return {
        key,
        set: !!String(raw || '').trim(),
        value: String(raw || '').trim().slice(0, 80) || '—',
        sensitive: false,
      };
    });

  return { groups, extraCount: Object.keys(process.env).length - allKeys.size };
}

async function probeUrl(label, url, timeoutMs = 8000) {
  const started = Date.now();
  if (!url) {
    return { id: label, url: null, ok: false, ms: 0, status: 0, error: 'not_configured' };
  }
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body = null;
    try {
      body = await r.json();
    } catch {
      body = null;
    }
    return {
      id: label,
      url,
      ok: r.ok,
      ms: Date.now() - started,
      status: r.status,
      body: body && typeof body === 'object' ? body : null,
      error: r.ok ? null : `HTTP ${r.status}`,
    };
  } catch (e) {
    return {
      id: label,
      url,
      ok: false,
      ms: Date.now() - started,
      status: 0,
      error: e.message || 'fetch_failed',
    };
  }
}

function readChannelsFromFile() {
  const fp = path.join(DATA_DIR, 'channels.json');
  try {
    if (!fs.existsSync(fp)) return { file: fp, channels: [], error: 'file_missing' };
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const map = data.channels && typeof data.channels === 'object' ? data.channels : {};
    const channels = Object.entries(map)
      .map(([id, ch]) => {
        if (!ch || typeof ch !== 'object') return null;
        const archived = !!ch.archived || ch.status === 'left';
        return {
          id: ch.id || id,
          title: ch.title || ch.username || id,
          enabled: ch.settings?.enabled !== false,
          chains: ch.settings?.chains || [],
          lang: ch.settings?.lang || 'en',
          archived,
          lastError: ch.lastError || null,
          lastErrorAt: ch.lastErrorAt || null,
          lastSuccessAt: ch.lastSuccessAt || null,
        };
      })
      .filter(Boolean);
    return { file: fp, channels, error: null };
  } catch (e) {
    return { file: fp, channels: [], error: e.message };
  }
}

function getChannelsLive() {
  try {
    const channels = require('./channels');
    return channels.list().map((ch) => ({
      id: ch.id,
      title: ch.title || ch.username || ch.id,
      enabled: ch.settings?.enabled !== false,
      chains: ch.settings?.chains || [],
      lang: ch.settings?.lang || 'en',
      archived: false,
      lastError: ch.lastError || null,
      lastErrorAt: ch.lastErrorAt || null,
      lastSuccessAt: ch.lastSuccessAt || null,
      source: 'live',
    }));
  } catch {
    const file = readChannelsFromFile();
    return file.channels.map((c) => ({ ...c, source: 'file' }));
  }
}

async function buildDashboard(getWebAppBaseUrl, getBotApiBaseUrl) {
  const pg = require('./pgClient');
  const botFeedStore = require('./botFeedStore');
  const reportStore = require('./reportStore');
  const { isMiniAppOnlyMode } = require('../scripts/railway-env');
  const { getPromoBanner } = require('./miniAppPromo');

  let feedPreview = [];
  try {
    const { buildFeedFromBotShares } = require('./miniAppFeed');
    const feed = await buildFeedFromBotShares('trending', 12, 'all');
    feedPreview = (feed.items || []).map((it) => ({
      symbol: it.symbol,
      mint: it.mint,
      dex: it.dexPlatform,
      volume24hFmt: it.volume24hFmt,
      change24h: it.change24h,
    }));
  } catch (e) {
    feedPreview = [];
  }

  const webBase = getWebAppBaseUrl();
  const botBase = getBotApiBaseUrl();
  const localHealth = await probeUrl('dex_local', `${webBase}/health`);
  const feedStatus = await probeUrl('dex_feed_status', `${webBase}/api/feed/status`);
  const botHealth = botBase
    ? await probeUrl('bot_api', `${botBase.replace(/\/$/, '')}/health`)
    : { id: 'bot_api', ok: null, error: 'not_configured', url: null };

  let botFeedStatus = null;
  if (botBase) {
    botFeedStatus = await probeUrl(
      'bot_feed_status',
      `${botBase.replace(/\/$/, '')}/api/feed/status`,
    );
  }

  const channelList = getChannelsLive();
  const channelStats = {
    total: channelList.length,
    enabled: channelList.filter((c) => c.enabled).length,
    withErrors: channelList.filter((c) => c.lastError).length,
    solana: channelList.filter((c) => (c.chains || []).includes('solana')).length,
  };

  const overallOk =
    localHealth.ok
    && (feedStatus.ok !== false)
    && (!botBase || botHealth.ok !== false)
    && (!pg.enabled() || true);

  return {
    ok: overallOk,
    updatedAt: Date.now(),
    service: {
      mode: isMiniAppOnlyMode() ? 'dex_only' : 'full',
      node: process.version,
      uptimeSec: Math.floor(process.uptime()),
      pid: process.pid,
    },
    storage: {
      dataDir: DATA_DIR,
      persistent: isPersistentDataDir(),
      postgres: pg.enabled(),
      feedCount: await botFeedStore.feedCountAsync(),
      reportCount: await reportStore.reportCountAsync(),
    },
    probes: {
      localHealth,
      feedStatus,
      botHealth,
      botFeedStatus,
    },
    urls: {
      webApp: webBase,
      miniApp: `${webBase}/`,
      admin: `${webBase}/admin/`,
      botApi: botBase || null,
      feedApi: `${webBase}/api/feed`,
      searchApi: `${webBase}/api/search`,
    },
    channels: {
      stats: channelStats,
      items: channelList.slice(0, 80),
    },
    feedPreview,
    promo: getPromoBanner(),
    flags: {
      miniAppSeed: ['1', 'true', 'on'].includes(
        String(process.env.MINI_APP_SEED || '1').trim().toLowerCase(),
      ),
      solanaScan: ['1', 'true', 'on'].includes(
        String(process.env.SOLANA_SCAN_ENABLED || '0').trim().toLowerCase(),
      ),
      banner: ['1', 'true', 'on'].includes(
        String(process.env.MINI_APP_BANNER_ENABLED || '1').trim().toLowerCase(),
      ),
    },
  };
}

async function handleAdminApi(req, res, url, helpers) {
  if (!url.pathname.startsWith('/api/admin')) return false;

  const { sendJson, getWebAppBaseUrl, getBotApiBaseUrl } = helpers;

  if (req.method === 'GET' && url.pathname === '/api/admin/status') {
    const cred = getAdminCredentials();
    sendJson(res, 200, {
      enabled: isAdminEnabled(),
      auth: 'username_password',
      username: isAdminEnabled() ? cred.username : null,
      hint: isAdminEnabled()
        ? 'Kullanıcı adı ve şifre ile giriş yapın (.env dosyası).'
        : 'Railway: ADMIN_USERNAME ve ADMIN_PASSWORD tanımlayın.',
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const auth = verifyLogin(username, password);
    if (!auth.ok) {
      const code = auth.error === 'admin_disabled' ? 503 : 401;
      sendJson(res, code, { ok: false, error: auth.error });
      return true;
    }
    const session = issueSessionToken(auth.username);
    sendJson(res, 200, {
      ok: true,
      ...session,
      role: auth.role,
      roleLabel: auth.roleLabel,
      displayName: auth.displayName,
      displayTitle: auth.displayTitle,
      isFounder: !!auth.isFounder,
      permissions: auth.permissions || [],
      id: auth.id,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/session') {
    const auth = verifyAdmin(req);
    if (!auth.ok) {
      sendJson(res, auth.error === 'admin_disabled' ? 503 : 401, auth);
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      username: auth.username,
      displayName: auth.displayName,
      displayTitle: auth.displayTitle,
      role: auth.role,
      roleLabel: auth.roleLabel,
      isFounder: !!auth.isFounder,
      permissions: auth.permissions || [],
      id: auth.id,
    });
    return true;
  }

  const auth = verifyAdmin(req);
  if (!auth.ok) {
    sendJson(res, auth.error === 'admin_disabled' ? 503 : 401, auth);
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/verify-action') {
    const body = await readJsonBody(req);
    const password = String(body.password || '');
    const { verifyPasswordForUsername, issueActionToken } = require('./adminActionAuth');
    if (!verifyPasswordForUsername(auth.username, password)) {
      sendJson(res, 401, {
        ok: false,
        error: 'wrong_password',
        message: 'Şifre hatalı. Kendi hesap şifrenizi girin.',
      });
      return true;
    }
    const action = issueActionToken(auth.username);
    sendJson(res, 200, {
      ok: true,
      ...action,
      message: 'İşlem doğrulandı. Birkaç dakika içinde değişiklik yapabilirsiniz.',
    });
    return true;
  }

  const { assertActionAuthForRoute } = require('./adminActionAuth');
  const actionGate = assertActionAuthForRoute(req, url, auth);
  if (!actionGate.ok) {
    sendJson(res, 403, actionGate);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/me') {
    sendJson(res, 200, {
      ok: true,
      user: {
        username: auth.username,
        displayName: auth.displayName || auth.username,
        displayTitle: auth.displayTitle || null,
        role: auth.role,
        roleLabel: auth.roleLabel,
        isFounder: !!auth.isFounder,
        permissions: auth.permissions || [],
        id: auth.id,
      },
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/permissions') {
    const {
      ASSIGNABLE_PERMISSIONS,
      FOUNDER_ONLY_PERMISSIONS,
      filterRolePresetsForAssignable,
      FOUNDER_PROFILE,
    } = require('./adminPermissions');
    sendJson(res, 200, {
      permissions: ASSIGNABLE_PERMISSIONS,
      founderOnly: FOUNDER_ONLY_PERMISSIONS,
      rolePresets: filterRolePresetsForAssignable(),
      founderProfile: FOUNDER_PROFILE,
    });
    return true;
  }

  const founderOnlyApiPrefixes = [
    '/api/admin/trending',
    '/api/admin/settings',
    '/api/admin/trend-config',
    '/api/admin/users',
    '/api/admin/env',
    '/api/admin/change-password',
  ];
  const needsFounderApi = founderOnlyApiPrefixes.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
    || url.pathname === '/api/admin/channels';
  if (needsFounderApi && !auth.isFounder) {
    sendJson(res, 403, {
      error: 'founder_only',
      message: 'Bu işlem yalnızca kurucu (OWNER) hesabında.',
    });
    return true;
  }

  const adminUsersMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (url.pathname === '/api/admin/users' || adminUsersMatch) {
    if (!auth.isFounder) {
      sendJson(res, 403, {
        error: 'forbidden',
        message: 'Admin kullanıcı yönetimi yalnızca kurucu hesabında.',
      });
      return true;
    }
    const adminUsersStore = require('./adminUsersStore');
    const cred = getAdminCredentials();

    if (req.method === 'GET' && url.pathname === '/api/admin/users') {
      const { FOUNDER_PROFILE, permissionsFromRole } = require('./adminPermissions');
      const founderRow = {
        id: 'founder-env',
        username: cred.username,
        displayName: FOUNDER_PROFILE.displayName,
        displayTitle: FOUNDER_PROFILE.displayTitle,
        role: 'founder',
        roleLabel: FOUNDER_PROFILE.roleLabel,
        permissions: permissionsFromRole('founder'),
        active: true,
        lastLoginAt: null,
        createdAt: null,
        isFounder: true,
        canDelete: false,
      };
      sendJson(res, 200, { users: [founderRow, ...adminUsersStore.listUsers()] });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/users') {
      try {
        const body = await readJsonBody(req);
        const user = adminUsersStore.createUser({
          username: body.username,
          password: body.password,
          role: body.role,
          permissions: body.permissions,
        });
        sendJson(res, 200, { ok: true, user });
      } catch (e) {
        sendJson(res, 400, { error: 'user_create_failed', message: e.message });
      }
      return true;
    }

    if (adminUsersMatch) {
      const id = decodeURIComponent(adminUsersMatch[1]);
      if (id === 'founder-env') {
        sendJson(res, 400, { error: 'founder_locked', message: 'Kurucu hesabı düzenlenemez.' });
        return true;
      }
      if (req.method === 'PUT') {
        try {
          const body = await readJsonBody(req);
          const user = adminUsersStore.updateUser(id, {
            password: body.password,
            role: body.role,
            permissions: body.permissions,
            active: body.active,
          });
          sendJson(res, 200, { ok: true, user });
        } catch (e) {
          sendJson(res, 400, { error: 'user_update_failed', message: e.message });
        }
        return true;
      }
      if (req.method === 'DELETE') {
        try {
          adminUsersStore.deleteUser(id);
          sendJson(res, 200, { ok: true });
        } catch (e) {
          sendJson(res, 400, { error: 'user_delete_failed', message: e.message });
        }
        return true;
      }
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/dashboard') {
    const body = await buildDashboard(getWebAppBaseUrl, getBotApiBaseUrl);
    sendJson(res, 200, body);
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/env') {
    sendJson(res, 200, envSummary());
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/channels') {
    const items = getChannelsLive();
    sendJson(res, 200, {
      items,
      stats: {
        total: items.length,
        enabled: items.filter((c) => c.enabled).length,
        withErrors: items.filter((c) => c.lastError).length,
      },
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/feed') {
    try {
      const { buildFeedFromBotShares } = require('./miniAppFeed');
      const feed = await buildFeedFromBotShares('trending', 80, 'all');
      sendJson(res, 200, { items: feed.items || [], total: (feed.items || []).length });
    } catch (e) {
      sendJson(res, 500, { error: 'feed_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/feed/preview') {
    try {
      const body = await readJsonBody(req);
      const { previewTokenFromInput } = require('./adminFeed');
      const result = await previewTokenFromInput(body.input || body.mint || body.q, body.lang || 'tr');
      sendJson(res, 200, result);
    } catch (e) {
      const code = e.code === 'not_found' || e.code === 'bad_input' || e.code === 'wrong_chain'
        ? 400
        : 500;
      sendJson(res, code, { error: e.code || 'preview_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/feed/add') {
    try {
      const body = await readJsonBody(req);
      const { addTokenToFeed } = require('./adminFeed');
      const input = body.input || body.mint || body.q || body.contract;
      const result = await addTokenToFeed(input, body.lang || 'tr');
      sendJson(res, 200, result);
    } catch (e) {
      const code = e.code === 'not_found' || e.code === 'bad_input' || e.code === 'wrong_chain'
        ? 400
        : 500;
      sendJson(res, code, { error: e.code || 'add_failed', message: e.message });
    }
    return true;
  }

  if (url.pathname === '/api/admin/settings') {
    const adminSettingsStore = require('./adminSettingsStore');
    if (req.method === 'GET') {
      const creds = getAdminCredentials();
      sendJson(res, 200, {
        settings: adminSettingsStore.loadSettings(),
        username: creds.username,
      });
      return true;
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const saved = adminSettingsStore.saveSettings(body);
        sendJson(res, 200, { ok: true, settings: saved });
      } catch (e) {
        sendJson(res, 400, { error: 'save_failed', message: e.message });
      }
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/change-password') {
    try {
      const body = await readJsonBody(req);
      const current = String(body.currentPassword || '');
      const next = String(body.newPassword || '');
      const creds = getAdminCredentials();
      if (!timingSafeEqual(current, creds.password)) {
        sendJson(res, 401, { error: 'wrong_password', message: 'Mevcut şifre hatalı' });
        return true;
      }
      if (next.length < 8) {
        sendJson(res, 400, { error: 'weak_password', message: 'Yeni şifre en az 8 karakter olmalı' });
        return true;
      }
      const adminSettingsStore = require('./adminSettingsStore');
      adminSettingsStore.savePassword(creds.username, next);
      process.env.ADMIN_PASSWORD = next.replace(/\r$/, '');
      sendJson(res, 200, { ok: true, message: 'Şifre güncellendi' });
    } catch (e) {
      sendJson(res, 400, { error: 'change_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/trending') {
    try {
      const adminTrendService = require('./adminTrendService');
      const timeframe = url.searchParams.get('timeframe') || '24h';
      const chain = url.searchParams.get('chain') || 'all';
      const data = await adminTrendService.buildTrendingTable({ timeframe, chain });
      sendJson(res, 200, data);
    } catch (e) {
      sendJson(res, 500, { error: 'trend_list_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/trending') {
    try {
      const body = await readJsonBody(req);
      const adminTrendStore = require('./adminTrendStore');
      adminTrendStore.addManual({
        token_id: body.token_id,
        position: body.position,
        is_pinned: body.is_pinned,
      });
      const adminTrendService = require('./adminTrendService');
      const list = await adminTrendService.buildTrendingTable();
      sendJson(res, 200, { ok: true, ...list });
    } catch (e) {
      sendJson(res, 400, { error: 'trend_add_failed', message: e.message });
    }
    return true;
  }

  const trendDelete = url.pathname.match(/^\/api\/admin\/trending\/([^/]+)$/);
  if (req.method === 'DELETE' && trendDelete) {
    try {
      const id = decodeURIComponent(trendDelete[1]);
      const adminTrendStore = require('./adminTrendStore');
      const removed = adminTrendStore.removeById(id);
      if (!removed) {
        const mint = id.startsWith('auto-') ? id.slice(5) : id;
        adminTrendStore.hideMint(mint);
      }
      const adminTrendService = require('./adminTrendService');
      const list = await adminTrendService.buildTrendingTable();
      sendJson(res, 200, { ok: true, ...list });
    } catch (e) {
      sendJson(res, 400, { error: 'trend_remove_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/tokens') {
    try {
      const adminTrendService = require('./adminTrendService');
      const search = url.searchParams.get('search') || '';
      const net = url.searchParams.get('net') || 'ALL';
      const tokens = await adminTrendService.searchTokens(search, net);
      sendJson(res, 200, { tokens });
    } catch (e) {
      sendJson(res, 500, { error: 'tokens_search_failed', message: e.message });
    }
    return true;
  }

  if (url.pathname === '/api/admin/settings/trend') {
    const adminTrendService = require('./adminTrendService');
    if (req.method === 'GET') {
      sendJson(res, 200, { settings: adminTrendService.settingsPayload() });
      return true;
    }
    if (req.method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        const saved = adminTrendService.saveSettings(body);
        sendJson(res, 200, { ok: true, settings: adminTrendService.settingsPayload() });
      } catch (e) {
        sendJson(res, 400, { error: 'trend_settings_failed', message: e.message });
      }
      return true;
    }
  }

  if (url.pathname === '/api/admin/trend-config') {
    const trendConfigStore = require('./trendConfigStore');
    const { buildFeedFromBotShares } = require('./miniAppFeed');
    if (req.method === 'GET') {
      try {
        const config = trendConfigStore.loadConfig();
        const feed = await buildFeedFromBotShares('trending', 24, 'all');
        sendJson(res, 200, {
          config,
          preview: {
            ticker: feed.trendingTicker || [],
            topItems: (feed.items || []).slice(0, 8),
            sortMode: feed.sortMode,
          },
        });
      } catch (e) {
        sendJson(res, 500, { error: 'trend_load_failed', message: e.message });
      }
      return true;
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const saved = trendConfigStore.saveConfig(body);
        const feed = await buildFeedFromBotShares('trending', 24, 'all');
        sendJson(res, 200, {
          ok: true,
          config: saved,
          preview: {
            ticker: feed.trendingTicker || [],
            topItems: (feed.items || []).slice(0, 8),
            sortMode: feed.sortMode,
          },
        });
      } catch (e) {
        sendJson(res, 400, { error: 'trend_save_failed', message: e.message });
      }
      return true;
    }
  }

  if (url.pathname === '/api/admin/promo-banner') {
    const promoBannerStore = require('./promoBannerStore');
    const { getPromoBanner } = require('./miniAppPromo');
    if (req.method === 'GET') {
      sendJson(res, 200, {
        config: promoBannerStore.loadConfig(),
        live: getPromoBanner(),
      });
      return true;
    }
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req, 12 * 1024 * 1024);
        const saved = promoBannerStore.saveConfig(body);
        console.log('[admin] promo-banner kaydedildi');
        sendJson(res, 200, { ok: true, saved, live: getPromoBanner() });
      } catch (e) {
        sendJson(res, 400, { error: 'save_failed', message: e.message });
      }
      return true;
    }
  }

  if (url.pathname.startsWith('/api/admin/support')) {
    const { handleAdminSupportApi } = require('./supportApi');
    const handled = await handleAdminSupportApi(req, res, url, sendJson, auth);
    if (handled) return true;
  }

  sendJson(res, 404, { error: 'not_found' });
  return true;
}

module.exports = {
  handleAdminApi,
  isAdminEnabled,
  getAdminCredentials,
  verifyAdmin,
  ADMIN_PUBLIC_DIR: path.join(__dirname, '..', 'public', 'admin'),
};
