// Solana scanner — adapter üzerinden discovery (tarama kapalıyken manuel resolve yeterli).

const adapter = require('./adapter');
const risk = require('./risk');

async function scanNewTokens(opts = {}) {
  return adapter.scanNewTokens(opts);
}

async function resolveTokenFromInput(input) {
  const token = await adapter.resolveTokenFromInput(input);
  if (!token) return null;
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
