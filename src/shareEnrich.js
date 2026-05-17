// Paylaşım öncesi Solana SPL / holder zenginleştirme.

async function ensureShareEnrichment(token, _chainId = 'solana') {
  if (!token) return token;
  if (token._shareEnriched) return token;
  try {
    const risk = require('./chains/solana/risk');
    await risk.enrichToken(token);
  } catch (e) {
    console.warn('[shareEnrich]', e.message);
  }
  try {
    const pumpfun = require('./chains/solana/pumpfun');
    await pumpfun.enrichPumpGraduation(token);
  } catch (e) {
    console.warn('[shareEnrich] pump:', e.message);
  }
  token._shareEnriched = true;
  token.chain = token.chain || 'solana';
  return token;
}

module.exports = { ensureShareEnrichment };
