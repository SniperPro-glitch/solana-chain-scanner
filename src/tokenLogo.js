// Token logosu — çoklu kaynak, DexScreener öncelikli.

const axios = require('axios');

const probe = axios.create({
  timeout: 4_000,
  maxRedirects: 3,
  validateStatus: (s) => s >= 200 && s < 400,
  headers: { 'User-Agent': 'solana-chain-scanner/miniapp' },
});

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const s = String(u || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Aday logo URL listesi (öncelik sırası). */
function buildLogoCandidates(token, pair) {
  const mint = token?.tokenAddress || '';
  const list = [];

  if (token?.tokenImage) list.push(token.tokenImage);
  if (pair?.info?.imageUrl) list.push(pair.info.imageUrl);
  if (pair?.info?.header) list.push(pair.info.header);
  if (pair?.baseToken?.address === mint && pair?.baseToken?.logoURI) {
    list.push(pair.baseToken.logoURI);
  }

  if (mint) {
    list.push(`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
    list.push(`https://img-api.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
    list.push(`https://token.jup.ag/strict/${mint}`);
    list.push(
      `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`,
    );
  }

  return uniqueUrls(list);
}

async function urlReachable(url) {
  try {
    const res = await probe.head(url);
    const ct = String(res.headers['content-type'] || '');
    if (ct.includes('text/html')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * İlk erişilebilir logo URL — pair varsa DexScreener öncelikli.
 * @returns {{ url: string|null, source: string, fallbacks: string[] }}
 */
async function resolveTokenLogo(token, pair = null) {
  const candidates = buildLogoCandidates(token, pair);
  if (!candidates.length) {
    return { url: null, source: null, fallbacks: [] };
  }

  for (let i = 0; i < Math.min(candidates.length, 4); i++) {
    const url = candidates[i];
    // eslint-disable-next-line no-await-in-loop
    if (await urlReachable(url)) {
      return {
        url,
        source: i === 0 && token?.tokenImage ? 'scanner' : 'dexscreener',
        fallbacks: candidates.filter((u) => u !== url),
      };
    }
  }

  return {
    url: candidates[0],
    source: 'fallback',
    fallbacks: candidates.slice(1),
  };
}

function chartStatsFromCandles(candles) {
  if (!candles?.length) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    high = Math.max(high, Number(c.high) || 0);
    low = Math.min(low, Number(c.low) || Infinity);
  }
  const first = Number(candles[0].open) || Number(candles[0].close);
  const last = Number(candles[candles.length - 1].close);
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  return {
    periodHigh: high,
    periodLow: low === Infinity ? null : low,
    periodChangePct: changePct,
    firstPrice: first,
    lastPrice: last,
  };
}

/** Senkron varsayılan logo (DexScreener mint path). */
function tokenLogoUrl(token, pair = null) {
  const candidates = buildLogoCandidates(token, pair);
  return candidates[0] || null;
}

module.exports = {
  buildLogoCandidates,
  resolveTokenLogo,
  tokenLogoUrl,
  chartStatsFromCandles,
};
