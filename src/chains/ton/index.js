// ──────────────────────────────────────────────────────────────────────
// TON chain — registry arayüzü (scanner + formatter bu klasörde).
// ──────────────────────────────────────────────────────────────────────

const config = require('./config');
const scanner = require('./scanner');
const { auditToken } = require('../../auditor');

async function scanNewTokens(opts = {}) {
  return scanner.scanNewTokens(opts);
}

async function resolveTokenFromInput(input) {
  return scanner.resolveTokenFromInput(input);
}

function extractAddress(text) {
  return scanner.extractTonAddress(text);
}

async function fetchPoolLiquidity(poolAddress) {
  return scanner.fetchPoolLiquidity(poolAddress);
}

function getExplorerLinks(token) {
  const tokenAddr = token.tokenAddress;
  const poolAddr = token.poolAddress;
  return {
    token: config.explorer.token(tokenAddr),
    pool: poolAddr ? config.data.geckoTerminal(poolAddr) : null,
    swap: config.dex.swap(tokenAddr),
    dexScreener: poolAddr ? config.data.dexScreener(poolAddr) : null,
    geckoTerminal: poolAddr ? config.data.geckoTerminal(poolAddr) : null,
  };
}

module.exports = {
  id: config.id,
  config,
  scanNewTokens,
  resolveTokenFromInput,
  auditToken,
  extractAddress,
  fetchPoolLiquidity,
  getExplorerLinks,
};
