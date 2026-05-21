/** Feed rozetleri — src/feedBadges.js ile aynı kurallar (tarayıcı). */
(function (global) {
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function metrics(item) {
    const ch5 = num(item?.change5m);
    const ch1 = num(item?.change1h);
    const ch24 = num(item?.change24h);
    const buys5 = Math.max(0, Number(item?.buys5m) || 0);
    const sells5 = Math.max(0, Number(item?.sells5m) || 0);
    const tx5 = buys5 + sells5;
    const vol5 = Math.max(0, Number(item?.volume5m) || 0);
    const buyPressure5 = tx5 >= 3 && buys5 >= sells5 * 1.08;
    const sellPressure5 = tx5 >= 3 && sells5 >= buys5 * 1.12;
    const strongSell5 = tx5 >= 5 && sells5 >= buys5 * 1.35;
    const pumpThenDump =
      (ch24 != null && ch24 >= 35 && ch5 != null && ch5 <= -5)
      || (ch1 != null && ch1 >= 25 && ch5 != null && ch5 <= -4 && sellPressure5);
    return { ch5, ch1, ch24, buys5, sells5, tx5, vol5, buyPressure5, sellPressure5, strongSell5, pumpThenDump };
  }

  function isDump(item) {
    const m = metrics(item);
    if (m.ch5 != null && m.ch5 <= -7) return true;
    if (m.ch1 != null && m.ch1 <= -10) return true;
    if (m.ch24 != null && m.ch24 <= -15) return true;
    if (m.pumpThenDump) return true;
    if (m.ch5 != null && m.ch5 < 0 && m.strongSell5) return true;
    if (m.ch5 != null && m.ch5 <= -4 && m.sellPressure5 && m.tx5 >= 4) return true;
    if (m.ch1 != null && m.ch1 <= 2 && m.ch5 != null && m.ch5 < 0 && m.sellPressure5) return true;
    return false;
  }

  function isAth(item) {
    if (isDump(item)) return false;
    const m = metrics(item);
    if (m.ch5 != null && m.ch5 < 0) return false;
    if (m.ch1 != null && m.ch1 < 0) return false;
    if (m.ch5 != null && m.ch1 != null && m.ch5 >= 14 && m.ch1 >= 10 && m.buyPressure5) return true;
    if (m.ch5 != null && m.ch5 >= 22 && m.buyPressure5) return true;
    if (m.ch1 != null && m.ch1 >= 32 && m.ch5 != null && m.ch5 >= 0 && m.buyPressure5) return true;
    if (m.ch5 != null && m.ch5 >= 10 && m.ch1 != null && m.ch1 >= 18 && m.tx5 >= 6) return true;
    return false;
  }

  function isHot(item) {
    if (isDump(item) || isAth(item)) return false;
    const m = metrics(item);
    if (m.ch5 != null && m.ch5 < 0) return false;
    if (m.ch1 != null && m.ch1 < 0) return false;
    if (m.tx5 >= 10 && m.vol5 >= 5000 && m.buyPressure5 && m.ch5 != null && m.ch5 >= 3) return true;
    if (m.tx5 >= 14 && m.buyPressure5 && m.ch5 != null && m.ch5 >= 2 && m.ch5 < 14) return true;
    if (m.ch1 != null && m.ch1 >= 8 && m.ch1 < 28 && m.buyPressure5 && m.tx5 >= 6) return true;
    return false;
  }

  function classifyMomentumBadge(item) {
    if (!item) return null;
    if (isDump(item)) return 'dump';
    if (isAth(item)) return 'ath';
    if (isHot(item)) return 'hot';
    return null;
  }

  global.SniperFeedBadges = { classifyMomentumBadge, isDump, isAth, isHot };
})(typeof window !== 'undefined' ? window : globalThis);
