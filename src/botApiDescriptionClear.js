/**
 * Eski deploy veya dil seçimi API’ye en/tr/ru description yazdıysa BotFather metni görünmez.
 * Boş string = o dil kaydını kaldırır; BotFather varsayılanı kullanılır.
 */

const https = require('https');

/** Varsayılanı silme — sadece dil kodlu API kayıtları. */
const LOCALIZED_LANGS = ['en', 'tr', 'ru'];

function telegramGet(token, method, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const path = `/bot${token}/${method}?${q}`;
  return new Promise((resolve, reject) => {
    https
      .get(`https://api.telegram.org${path}`, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(body || e.message));
          }
        });
      })
      .on('error', reject);
  });
}

async function clearLocalizedField(token, methodSet, fieldName, lang) {
  const setParams = { [fieldName]: '', language_code: lang };
  return telegramGet(token, methodSet, setParams);
}

/**
 * @param {string} botToken
 * @param {{ langs?: string[], includeDefault?: boolean }} opts
 */
async function clearApiLocalizedBotTexts(botToken, opts = {}) {
  const token = String(botToken || '').trim();
  if (!token) return { cleared: 0, errors: [] };

  const langs = opts.langs || LOCALIZED_LANGS;
  const errors = [];
  let cleared = 0;

  const pairs = [
    ['setMyDescription', 'description'],
    ['setMyShortDescription', 'short_description'],
  ];

  for (const lang of langs) {
    for (const [method, field] of pairs) {
      try {
        const r = await clearLocalizedField(token, method, field, lang);
        if (r?.ok) cleared += 1;
        else errors.push(`${method}(${lang}): ${r?.description || 'fail'}`);
      } catch (e) {
        errors.push(`${method}(${lang}): ${e.message}`);
      }
    }
  }

  if (opts.includeDefault) {
    for (const [method, field] of pairs) {
      try {
        const r = await telegramGet(token, method, { [field]: '' });
        if (r?.ok) cleared += 1;
        else errors.push(`${method}(default): ${r?.description || 'fail'}`);
      } catch (e) {
        errors.push(`${method}(default): ${e.message}`);
      }
    }
  }

  return { cleared, errors };
}

module.exports = {
  LOCALIZED_LANGS,
  clearApiLocalizedBotTexts,
  telegramGet,
};
