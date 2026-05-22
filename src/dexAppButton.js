const { t } = require('./i18n');
const { getWebAppEntryUrl } = require('./miniAppServer');

/** Telegram inline / menü — tam yükseklik (expand + requestViewport, X Kapat görünür). */
function buildSniperDexWebAppButton(lang) {
  const webEntry = getWebAppEntryUrl();
  if (!/^https:\/\//i.test(webEntry)) return null;
  return { text: t('welcome.openDex', lang), web_app: { url: webEntry } };
}

function sniperDexMenuButton() {
  return {
    type: 'web_app',
    text: 'Sniper DEX',
    web_app: { url: getWebAppEntryUrl() },
  };
}

module.exports = { buildSniperDexWebAppButton, sniperDexMenuButton };
