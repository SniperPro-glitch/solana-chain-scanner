const config = require('./config');
const adapter = require('./adapter');
const risk = require('./risk');
const { auditToken } = require('../../auditor');

async function scanNewTokens(opts = {}) {
  return adapter.scanNewTokens(opts);
}

async function resolveTokenFromInput(input) {
  const token = await adapter.resolveTokenFromInput(input);
  if (!token) return null;
  await risk.enrichToken(token).catch(() => {});
  return token;
}

function extractAddress(text) {
  return adapter.extractAddress(text);
}

async function fetchPoolLiquidity(poolAddress) {
  return adapter.fetchPoolLiquidity(poolAddress);
}

function getExplorerLinks(token) {
  const tokenAddr = token.tokenAddress;
  const poolAddr = token.poolAddress;
  return {
    token: config.explorer.token(tokenAddr),
    pool: poolAddr ? config.data.geckoTerminal(poolAddr) : null,
    swap: config.dex.swap(tokenAddr),
    dexScreener: config.data.dexScreener(poolAddr || tokenAddr),
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
  risk,
  adapter,
};
