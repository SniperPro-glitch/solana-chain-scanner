/** Mini App açılışında initData ile abone kaydı + dil senkronu (bot /start ile aynı). */

const { parseUserFromInitData, getBotToken } = require('./miniAppAdminAccess');
const botSubscribers = require('./botSubscribers');
const users = require('./users');
const { normalizeLang } = require('./i18n');

async function handleMiniAppTouchUser(req, res, url, sendJson, readBody) {
  if (url.pathname !== '/api/miniapp/touch') return false;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {}, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return true;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }

  try {
    await users.reloadFromPostgres().catch(() => false);

    const raw = readBody ? await readBody(req) : Buffer.alloc(0);
    const payload = JSON.parse(raw.toString('utf8') || '{}');
    const initData = String(payload.initData || '').trim();
    const user = parseUserFromInitData(initData, getBotToken());
    if (!user?.id) {
      sendJson(res, 401, { ok: false, error: 'invalid_init_data' });
      return true;
    }

    const source = String(payload.source || 'miniapp').slice(0, 32);
    botSubscribers.touch(user, { source });

    const explicitLang = payload.lang ? normalizeLang(payload.lang) : null;
    if (explicitLang && ['en', 'tr', 'ru'].includes(explicitLang)) {
      users.setLang(user.id, explicitLang, { langChosen: true });
    } else if (!users.hasChosenLang(user.id) && user.language_code) {
      const code = String(user.language_code).slice(0, 2).toLowerCase();
      if (['en', 'tr', 'ru'].includes(code)) {
        users.setLang(user.id, code, { langChosen: false });
      }
    }

    const lang = users.getLang(user.id);
    sendJson(res, 200, {
      ok: true,
      registered: true,
      lang,
      langChosen: users.hasChosenLang(user.id),
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: 'bad_request', message: e.message });
  }
  return true;
}

module.exports = { handleMiniAppTouchUser };
