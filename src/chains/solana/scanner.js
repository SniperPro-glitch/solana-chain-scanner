// Solana scanner — adapter üzerinden discovery (tarama kapalıyken manuel resolve yeterli).

const adapter = require('./adapter');
const risk = require('./risk');

async function scanNewTokens(opts = {}) {
  return adapter.scanNewTokens(opts);
}

async function resolveTokenFromInput(input) {
  const result = await adapter.resolveTokenFromInput(input);
  if (!result?.token) return null;
  const token = result.token;
  await risk.enrichToken(token).catch(() => {});
  return token;
}

function extractSolanaAddress(text) {
  return adapter.extractAddress(text);
}

module.exports = {
  scanNewTokens,
  resolveTokenFromInput,
  extractSolanaAddress,
};
