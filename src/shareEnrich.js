// Paylaşım öncesi ağır kontroller (LP, sybil, BSC risk, Solana SPL).

async function ensureShareEnrichment(token, chainId = 'solana') {
  if (!token) return token;
  const chain = token.chain || chainId || 'solana';

  if (chain === 'solana') {
    if (token._shareEnriched) return token;
    try {
      const risk = require('./chains/solana/risk');
      await risk.enrichToken(token, { deep: true });
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
    token.chain = 'solana';
    return token;
  }

  if (chain === 'bsc') {
    if (!token.contract?.bsc_extra) {
      const risk = require('./chains/bsc/risk');
      await risk.enrichToken(token, { includeSybil: true });
    } else if (
      process.env.BSC_SYBIL_ENABLED !== '0'
      && (!token.sybilAnalysis || token.sybilAnalysis.source === 'unknown')
      && token.poolAddress
    ) {
      try {
        const sybil = require('./chains/bsc/sybilDetector');
        token.sybilAnalysis = await sybil.analyzePool(token.poolAddress, 6);
      } catch (_) { /* yoksay */ }
    }
    token.chain = 'bsc';
    return token;
  }

  const pool = token.poolAddress;
  if (!pool) return token;

  const needLp = !token.lpBurnAnalysis || token.lpBurnAnalysis.source === 'unknown';
  const needSybil = !token.sybilAnalysis || token.sybilAnalysis.source === 'unknown';
  if (!needLp && !needSybil) return token;

  const tasks = [];
  if (needLp) {
    tasks.push(require('./lpBurnDetector').analyzePool(pool).catch(() => null));
  } else tasks.push(Promise.resolve(null));
  if (needSybil && process.env.TON_SYBIL_ENABLED !== '0') {
    tasks.push(require('./sybilDetector').analyzePool(pool, 6).catch(() => null));
  } else tasks.push(Promise.resolve(null));

  const [lpAnalysis, sybilAnalysis] = await Promise.all(tasks);
  if (lpAnalysis) token.lpBurnAnalysis = lpAnalysis;
  if (sybilAnalysis) token.sybilAnalysis = sybilAnalysis;
  token.chain = 'ton';
  return token;
}

module.exports = { ensureShareEnrichment };
