// ──────────────────────────────────────────────────────────────────────
// BSC chain interface — registry'nin beklediği şeklin BSC implementasyonu.
// ──────────────────────────────────────────────────────────────────────

const config = require('./config');
const adapter = require('./adapter');
const risk = require('./risk');
const { auditToken } = require('../../auditor');

// scanNewTokens: sadece DexScreener/Gecko listesi (hafif). Risk/sybil → paylaşım öncesi shareEnrich.
async function scanNewTokens(opts = {}) {
  const tokens = await adapter.scanNewTokens(opts);
  if (process.env.BSC_HEAVY_ON_SCAN === '1') {
    const enriched = [];
    const gap = parseInt(process.env.BSC_ENRICH_DELAY_MS || '800', 10);
    for (const t of tokens) {
      try {
        enriched.push(await risk.enrichToken(t, { includeSybil: true }));
      } catch (e) {
        console.warn('[bsc] enrichToken fail:', e.message);
        enriched.push(t);
      }
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    }
    return enriched;
  }
  return tokens;
}

async function resolveTokenFromInput(input) {
  const token = await adapter.resolveTokenFromInput(input);
  if (!token) return null;
  // Manuel preview için risk taraması zorunlu
  await risk.enrichToken(token).catch(() => {});
  return token;
}

function extractAddress(text) {
  return adapter.extractAddress(text);
}

// Watch loop için: BSC pool likidite güncel verisi (rüg/scam tespiti)
async function fetchPoolLiquidity(poolAddress) {
  return adapter.fetchPoolLiquidity(poolAddress);
}

function getExplorerLinks(token) {
  const tokenAddr = token.tokenAddress;
  const poolAddr = token.poolAddress;
  return {
    token: config.explorer.token(tokenAddr),
    address: config.explorer.address(tokenAddr),
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
  // BSC-spesifik (opsiyonel kullanım)
  risk,
  adapter,
};
