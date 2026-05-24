/** Watchlist canlı fiyat — DexScreener + feed satır formatı */

const { fetchTokenData } = require('./dexscreenerApi');
const miniAppFeed = require('./miniAppFeed');
const solana = require('./chains/solana');

function dexPairToToken(pair) {
  if (!pair?.baseToken?.address) return null;
  const base = pair.baseToken;
  const quote = pair.quoteToken || {};
  return {
    tokenAddress: base.address,
    tokenSymbol: base.symbol,
    tokenName: base.name,
    tokenImage: pair.info?.imageUrl || null,
    dex: pair.dexId,
    poolAddress: pair.pairAddress,
    priceUsd: parseFloat(pair.priceUsd),
    priceChange24h: parseFloat(pair.priceChange?.h24),
    priceChange6h: parseFloat(pair.priceChange?.h6),
    priceChange1h: parseFloat(pair.priceChange?.h1),
    priceChange5m: parseFloat(pair.priceChange?.m5),
    volume24h: parseFloat(pair.volume?.h24),
    volume6h: parseFloat(pair.volume?.h6),
    volume1h: parseFloat(pair.volume?.h1),
    volume5m: parseFloat(pair.volume?.m5),
    liquidityUsd: parseFloat(pair.liquidity?.usd),
    marketCapUsd: parseFloat(pair.marketCap),
    fdvUsd: parseFloat(pair.fdv),
    buys24h: pair.txns?.h24?.buys,
    sells24h: pair.txns?.h24?.sells,
    buys1h: pair.txns?.h1?.buys,
    sells1h: pair.txns?.h1?.sells,
    dexScreener: { url: pair.url, pairAddress: pair.pairAddress },
    poolName:
      base.symbol && quote.symbol ? `${base.symbol}/${quote.symbol}` : `${base.symbol || '?'}/SOL`,
    createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
  };
}

async function quotesForMints(mints) {
  const list = [...new Set((mints || []).map((m) => String(m || '').trim()).filter(Boolean))].slice(
    0,
    40,
  );
  const items = [];
  for (let i = 0; i < list.length; i++) {
    const mint = list[i];
    try {
      const data = await fetchTokenData(mint, { fresh: true });
      const token = dexPairToToken(data?.best);
      if (!token) continue;
      let audit = null;
      try {
        audit = solana.auditToken(token);
      } catch {
        audit = { risk: { code: 'MEDIUM' }, riskPercent: 55 };
      }
      const item = miniAppFeed.tokenToFeedItem(token, audit, i + 1, null);
      item.chain = 'solana';
      item.watchlist = true;
      items.push(item);
    } catch {
      /* tek mint atla */
    }
  }
  return items;
}

module.exports = { quotesForMints, dexPairToToken };
