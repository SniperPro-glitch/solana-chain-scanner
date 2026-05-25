const { t } = require('./i18n');
const { getWebAppEntryUrl, getWebAppBaseUrl } = require('./miniAppServer');

/** Settings / hoş geldin / /dex — güncel WEB_APP_URL (+ eski DEX host düzeltmesi). */
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

function getSettingsDexWebAppUrl() {
  return getWebAppEntryUrl();
}

module.exports = {
  buildSniperDexWebAppButton,
  sniperDexMenuButton,
  getSettingsDexWebAppUrl,
  getWebAppBaseUrl,
};
