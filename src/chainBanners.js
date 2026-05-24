// Per-chain post banner sources (TON / BSC / Solana).

const path = require('path');
const fs = require('fs');

function _bannerSource(fileId, localPath) {
  if (fileId) return { photoFileId: fileId };
  try {
    if (fs.existsSync(localPath)) return { photoLocalPath: localPath };
  } catch (_) { /* yoksay */ }
  return {};
}

// TON
const GREEN_BANNER_FILE_ID = process.env.GREEN_BANNER_FILE_ID || 'AgACAgQAAxkDAAICbmoCGbYLqc67lJnAozAM38njxPXmAAK6Dmsb8AIQUD8DElTzsOWxAQADAgADdwADOwQ';
const RISK_BANNER_FILE_ID = process.env.RISK_BANNER_FILE_ID || 'AgACAgQAAyEGAATn3wzeAAIBuGoCKh5dyD8IJR0sTKb02RyPGRGlAAJQDmsbgdQRUJpYQJ19HkDuAQADAgADdwADOwQ';
const SCAM_BANNER_FILE_ID = null;
const CRITICAL_BANNER_FILE_ID = process.env.CRITICAL_BANNER_FILE_ID || 'AgACAgQAAyEGAATn3wzeAAIBy2oCVF_ejGdmUb-vcbPW_1b99vU9AALrDWsbgdQZUAABQ6WPAAEOhM0BAAMCAAN3AAM7BA';
const GREEN_BANNER_LOCAL = path.join(__dirname, '..', 'assets', 'green-banner.jpg');
const RISK_BANNER_LOCAL = path.join(__dirname, '..', 'assets', 'risk-banner.jpg');
const SCAM_BANNER_LOCAL = path.join(__dirname, '..', 'assets', 'scam-banner.jpg');
const CRITICAL_BANNER_LOCAL = path.join(__dirname, '..', 'assets', 'critical-banner.jpg');

function tonGreenBanner() { return _bannerSource(GREEN_BANNER_FILE_ID, GREEN_BANNER_LOCAL); }
function tonRiskBanner() { return _bannerSource(RISK_BANNER_FILE_ID, RISK_BANNER_LOCAL); }
function tonScamBanner() { return _bannerSource(SCAM_BANNER_FILE_ID, SCAM_BANNER_LOCAL); }
function tonCriticalBanner() {
  const own = _bannerSource(CRITICAL_BANNER_FILE_ID, CRITICAL_BANNER_LOCAL);
  if (own.photoFileId || own.photoLocalPath) return own;
  return tonScamBanner();
}

// BSC
const BSC_GREEN_BANNER_FILE_ID = process.env.BSC_GREEN_BANNER_FILE_ID || null;
const BSC_RISK_BANNER_FILE_ID = process.env.BSC_RISK_BANNER_FILE_ID || null;
const BSC_CRITICAL_BANNER_FILE_ID = process.env.BSC_CRITICAL_BANNER_FILE_ID || null;
const BSC_SCAM_BANNER_FILE_ID = process.env.BSC_SCAM_BANNER_FILE_ID || null;
const BSC_GREEN_LOCAL = path.join(__dirname, '..', 'assets', 'bsc', 'green-banner.jpg');
const BSC_RISK_LOCAL = path.join(__dirname, '..', 'assets', 'bsc', 'risk-banner.jpg');
const BSC_CRITICAL_LOCAL = path.join(__dirname, '..', 'assets', 'bsc', 'critical-banner.jpg');
const BSC_SCAM_LOCAL = path.join(__dirname, '..', 'assets', 'bsc', 'scam-banner.jpg');

function bscBannerSource(level) {
  let own = {};
  if (level === 'green') own = _bannerSource(BSC_GREEN_BANNER_FILE_ID, BSC_GREEN_LOCAL);
  else if (level === 'yellow') own = _bannerSource(BSC_RISK_BANNER_FILE_ID, BSC_RISK_LOCAL);
  else if (level === 'critical') own = _bannerSource(BSC_CRITICAL_BANNER_FILE_ID, BSC_CRITICAL_LOCAL);
  else if (level === 'red') own = _bannerSource(BSC_SCAM_BANNER_FILE_ID, BSC_SCAM_LOCAL);
  if (own.photoFileId || own.photoLocalPath) return own;
  return {};
}

// Solana
const SOL_BANNER = {
  green: process.env.SOLANA_GREEN_BANNER_FILE_ID || null,
  yellow: process.env.SOLANA_RISK_BANNER_FILE_ID || null,
  critical: process.env.SOLANA_CRITICAL_BANNER_FILE_ID || null,
  red: process.env.SOLANA_SCAM_BANNER_FILE_ID || null,
};

function solanaBannerSource(level) {
  const key = level === 'yellow' ? 'yellow' : (level === 'red' ? 'red' : (level === 'critical' ? 'critical' : 'green'));
  const fid = SOL_BANNER[key] || SOL_BANNER.green;
  return fid ? { photoFileId: fid } : {};
}

function bannerSourceForChain(chainId, level) {
  const cid = String(chainId || 'solana').toLowerCase();
  if (cid === 'bsc') return bscBannerSource(level);
  if (cid === 'ton') {
    if (level === 'critical') return tonCriticalBanner();
    if (level === 'yellow') return tonRiskBanner();
    if (level === 'red') return tonScamBanner();
    return tonGreenBanner();
  }
  return solanaBannerSource(level);
}

module.exports = {
  bannerSourceForChain,
  solanaBannerSource,
  bscBannerSource,
  tonGreenBanner,
};
