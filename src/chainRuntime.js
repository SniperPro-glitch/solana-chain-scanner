// Multi-chain formatter + scan env helpers.

const { bannerSourceForChain } = require('./chainBanners');

const FORMATTERS = {
  solana: () => require('./chains/solana/formatter'),
  ton: () => require('./chains/ton/formatter'),
  bsc: () => require('./chains/bsc/formatter'),
};

function formatTokenCardForChain(chainId, token, audit, lang, level, opts = {}) {
  const cid = String(chainId || 'solana').toLowerCase();
  const load = FORMATTERS[cid] || FORMATTERS.solana;
  return load().formatTokenCard(token, audit, lang, level, opts);
}

function formatRiskBannerForChain(chainId, payload, lang) {
  const cid = String(chainId || 'solana').toLowerCase();
  const load = FORMATTERS[cid] || FORMATTERS.solana;
  const fn = load().formatRiskBanner;
  if (typeof fn === 'function') return fn(payload, lang);
  return require('./chains/solana/formatter').formatRiskBanner(payload, lang);
}

function isScanEnabled(chainId) {
  const cid = String(chainId).toLowerCase();
  if (cid === 'solana') {
    return ['1', 'true', 'on', 'yes'].includes(String(process.env.SOLANA_SCAN_ENABLED || '0').trim().toLowerCase());
  }
  if (cid === 'ton') {
    return ['1', 'true', 'on', 'yes'].includes(String(process.env.TON_SCAN_ENABLED || process.env.SCAN_ENABLED || '1').trim().toLowerCase());
  }
  if (cid === 'bsc') {
    return ['1', 'true', 'on', 'yes'].includes(String(process.env.BSC_SCAN_ENABLED || '0').trim().toLowerCase());
  }
  return false;
}

function scanIntervalMin(chainId) {
  const cid = String(chainId).toLowerCase();
  if (cid === 'solana') return parseInt(process.env.SOLANA_SCAN_INTERVAL_MIN || '12', 10);
  if (cid === 'bsc') return parseInt(process.env.BSC_SCAN_INTERVAL_MIN || process.env.SCAN_INTERVAL_MIN || '12', 10);
  return parseInt(process.env.TON_SCAN_INTERVAL_MIN || process.env.SCAN_INTERVAL_MIN || '12', 10);
}

function scanPoolLimit(chainId) {
  const cid = String(chainId).toLowerCase();
  if (cid === 'solana') return parseInt(process.env.SOLANA_SCAN_POOL_LIMIT || '12', 10);
  if (cid === 'bsc') return parseInt(process.env.BSC_SCAN_POOL_LIMIT || '30', 10);
  return parseInt(process.env.TON_SCAN_POOL_LIMIT || '30', 10);
}

module.exports = {
  formatTokenCardForChain,
  formatRiskBannerForChain,
  bannerSourceForChain,
  isScanEnabled,
  scanIntervalMin,
  scanPoolLimit,
};
