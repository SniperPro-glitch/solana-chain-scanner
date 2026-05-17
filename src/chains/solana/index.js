const config = require('./config');
const adapter = require('./adapter');
const risk = require('./risk');
const pumpfun = require('./pumpfun');
const { auditToken } = require('../../auditor');

async function scanNewTokens(opts = {}) {
  return adapter.scanNewTokens(opts);
}

async function resolveTokenFromInput(input) {
  const result = await adapter.resolveTokenFromInput(input);
  if (result?.error === 'wrong_chain') {
    const e = new Error('wrong_chain');
    e.code = 'WRONG_CHAIN';
    e.foreignChain = result.chain || '?';
    throw e;
  }
  if (!result?.token) return null;
  const token = result.token;
  await risk.enrichToken(token).catch(() => {});
  await pumpfun.enrichPumpGraduation(token).catch(() => {});
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
