// Ortak akış: önce Sniper DEX (Mini App) → URL → sonra kanal paylaşımı.

const reportStore = require('./reportStore');
const { buildWebAppUrl } = require('./miniAppServer');

/**
 * Tokeni DEX / Mini App'e kaydet, paylaşım URL'si üret.
 * @returns {{ reportId: string, dexAppUrl: string|null }}
 */
function publishToDexFirst(token, audit, lang = 'tr', level = 'green') {
  const reportId = reportStore.saveReport({
    token,
    audit,
    lang,
    level: level || 'green',
  });
  const dexAppUrl = buildWebAppUrl(reportId);
  const sym = token?.tokenSymbol || token?.tokenAddress?.slice(0, 8) || '?';
  if (dexAppUrl && /^https:\/\//i.test(dexAppUrl)) {
    console.log(`[dex] ${sym} listed → ${dexAppUrl}`);
  } else {
    console.warn(`[dex] ${sym} kayıt ok (${reportId}) ama WEB_APP_URL HTTPS değil — kanal linki zayıf`);
  }
  return { reportId, dexAppUrl: dexAppUrl || null };
}

module.exports = { publishToDexFirst };
