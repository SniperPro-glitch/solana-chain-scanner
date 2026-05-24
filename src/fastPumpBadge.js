// Otomatik "hızlı yükselme" rozeti — yüksek kısa vadeli momentum + işlem hızı.
// Filtreleri bypass etmez; bilgilendirme amaçlıdır.

const MIN_PRICE_1H = parseFloat(process.env.FAST_PUMP_MIN_PRICE_1H || '30', 10);
const MIN_TXNS_5M = parseInt(process.env.FAST_PUMP_MIN_TXNS_5M || '6', 10);
const MIN_BUY_RATIO_5M = parseFloat(process.env.FAST_PUMP_MIN_BUY_RATIO_5M || '0.52', 10);
const HOT_PRICE_1H = parseFloat(process.env.FAST_PUMP_HOT_PRICE_1H || '60', 10);
const HOT_TXNS_5M = parseInt(process.env.FAST_PUMP_HOT_TXNS_5M || '14', 10);
const MIN_TXNS_1H_FALLBACK = parseInt(process.env.FAST_PUMP_MIN_TXNS_1H || '22', 10);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @returns {null | { tier: 'fast'|'hot', price1h: number, txns5m: number, buyRatio: number, window: '5m'|'1h' }}
 */
function detectFastPump(token) {
  if (!token) return null;

  const pc1 = num(token.priceChange1h);
  const buys5 = num(token.buys5m);
  const sells5 = num(token.sells5m);
  const buys1 = num(token.buys1h);
  const sells1 = num(token.sells1h);
  const tx5 = buys5 + sells5;
  const tx1 = buys1 + sells1;

  const tierFrom = (price1h, txCount, buyRatio, window) => {
    const hot = price1h >= HOT_PRICE_1H && txCount >= HOT_TXNS_5M && buyRatio >= MIN_BUY_RATIO_5M;
    return {
      tier: hot ? 'hot' : 'fast',
      price1h,
      txns5m: txCount,
      buyRatio,
      window,
    };
  };

  // 5 dk penceresi (tercih): fiyat artışı + yoğun işlem + alım baskısı
  if (tx5 >= MIN_TXNS_5M && pc1 >= MIN_PRICE_1H) {
    const buyRatio = buys5 / tx5;
    if (buyRatio >= MIN_BUY_RATIO_5M) {
      return tierFrom(pc1, tx5, buyRatio, '5m');
    }
  }

  // 5m verisi yoksa 1s fallback (eski kartlar / Gecko yedek)
  if (tx5 === 0 && tx1 >= MIN_TXNS_1H_FALLBACK && pc1 >= MIN_PRICE_1H) {
    const buyRatio = buys1 / tx1;
    if (buyRatio >= MIN_BUY_RATIO_5M) {
      return tierFrom(pc1, tx1, buyRatio, '1h');
    }
  }

  return null;
}

function applyFastPumpBadge(token) {
  if (!token) return token;
  const hit = detectFastPump(token);
  if (hit) token.fastPump = hit;
  else delete token.fastPump;
  return token;
}

module.exports = { detectFastPump, applyFastPumpBadge };
