// Token audit engine.
// Returns canonical codes (LOW/MEDIUM/HIGH) and i18n keys for labels — formatter resolves them.

// ─────────────────────────────────────────────────────────────
// Liquidity level — returns { code, emoji, score }
// ─────────────────────────────────────────────────────────────
function liquidityLevel(usd) {
  if (usd < 1_000) return { code: 'POOR', emoji: '🔴', score: 4 };
  if (usd < 5_000) return { code: 'WEAK', emoji: '🟠', score: 3 };
  if (usd < 20_000) return { code: 'OK', emoji: '🟡', score: 2 };
  if (usd < 100_000) return { code: 'GOOD', emoji: '🟢', score: 1 };
  return { code: 'STRONG', emoji: '🟢', score: 0 };
}

// ─────────────────────────────────────────────────────────────
// Age assessment — returns { code, value, score }
//   code: 'minutesNew' | 'minutes' | 'hours' | 'days' | 'unknown'
//   value: number (depends on code)
//   minutes: 0..29 -> minutesNew
//   30..179 -> minutes
//   180..1439 -> hours (with minutes)
//   1440+ -> days
// ─────────────────────────────────────────────────────────────
function ageAssessment(minutes) {
  if (minutes === null || minutes === undefined) return { code: 'unknown', score: 1 };
  if (minutes < 30) return { code: 'minutesNew', value: minutes, score: 3 };
  if (minutes < 180) return { code: 'minutes', value: minutes, score: 2 };
  if (minutes < 1440) {
    return { code: 'hours', hours: Math.round(minutes / 60), minutes: minutes % 60, score: 1 };
  }
  return { code: 'days', value: Math.round(minutes / 1440), score: 0 };
}

// ─────────────────────────────────────────────────────────────
// Volume/liquidity ratio
// ─────────────────────────────────────────────────────────────
function volumeLiquidityRatio(volume24h, liquidity) {
  if (!liquidity || liquidity < 1) return { ratio: null, score: 0, code: 'unknown' };
  const ratio = volume24h / liquidity;
  if (ratio > 20) return { ratio, score: 3, code: 'extreme' };
  if (ratio > 5) return { ratio, score: 2, code: 'high' };
  if (ratio > 1) return { ratio, score: 1, code: 'normal' };
  return { ratio, score: 0, code: 'low' };
}

// ─────────────────────────────────────────────────────────────
// Buyer/seller balance — returns { code, buys, sells, score }
//   code: 'none' | 'sellPressure' | 'buyPressure' | 'balanced'
// ─────────────────────────────────────────────────────────────
function buyerSellerBalance(buys, sells) {
  const total = buys + sells;
  if (total === 0) return { code: 'none', buys: 0, sells: 0, score: 2 };
  const sellRatio = sells / total;
  if (sellRatio > 0.7) return { code: 'sellPressure', buys, sells, score: 2 };
  if (sellRatio < 0.3) return { code: 'buyPressure', buys, sells, score: 0 };
  return { code: 'balanced', buys, sells, score: 0 };
}

// Tavan puan → riskPercent; etiket aynı yüzde bandından (kartta %35 + YÜKSEK çelişkisi olmasın).
const AUDIT_MAX_SCORE = 34;

/** riskPercent: 0–100, yüksek = daha riskli (toplam puan / AUDIT_MAX_SCORE). */
function riskFromPercent(riskPercent) {
  const p = Math.min(100, Math.max(0, Math.round(riskPercent)));
  if (p >= 65) return { code: 'HIGH', emoji: '🔴' };
  if (p >= 40) return { code: 'MEDIUM', emoji: '🟡' };
  if (p >= 15) return { code: 'LOW', emoji: '🟢' };
  return { code: 'VERY_LOW', emoji: '🟢' };
}

// ─────────────────────────────────────────────────────────────
// Main audit function
// ─────────────────────────────────────────────────────────────
function auditToken(t) {
  const liq = liquidityLevel(t.liquidityUsd);
  const age = ageAssessment(t.ageMinutes);
  const volRatio = volumeLiquidityRatio(t.volume24h, t.liquidityUsd);
  const balance = buyerSellerBalance(t.buys24h, t.sells24h);

  // Contract security score (from Tonapi)
  let contractScore = 0;
  const c = t.contract;
  if (c) {
    if (c.mintable === true) contractScore += 2;
    if (c.adminAddress) contractScore += 1;
    if (c.topHolderPct > 50) contractScore += 3;
    else if (c.topHolderPct > 30) contractScore += 2;
    else if (c.topHolderPct > 15) contractScore += 1;
    if (c.top10Pct > 90) contractScore += 2;
    else if (c.top10Pct > 70) contractScore += 1;
    if (c.verification === 'blacklist') contractScore += 4;
  }

  // Fiyat değişim skoru — son 24s/1s düşüşü audit skoruna yansıtsın
  //  -80%+ → +8 (rug paterni)
  //  -50%+ → +6 (ağır düşüş)
  //  -30%+ → +3 (orta düşüş)
  //  +200% spike (1s) → +2 (pump tehlikesi)
  let priceScore = 0;
  const pc24 = typeof t.priceChange24h === 'number' ? t.priceChange24h
             : (t.priceChange?.h24 ?? 0);
  const pc1 = typeof t.priceChange1h === 'number' ? t.priceChange1h
            : (t.priceChange?.h1 ?? 0);
  if (pc24 <= -80) priceScore += 8;
  else if (pc24 <= -50) priceScore += 6;
  else if (pc24 <= -30) priceScore += 3;
  if (pc1 >= 200) priceScore += 2;

  const totalScore = liq.score + age.score + volRatio.score + balance.score + contractScore + priceScore;
  const riskPercent = Math.min(100, Math.round((totalScore / AUDIT_MAX_SCORE) * 100));
  const risk = riskFromPercent(riskPercent);

  // ─── KRİTİK RİSK tespiti ───
  // 3 koşuldan en az 2'si sağlanırsa kart KIRMIZI olarak gösterilir:
  //  1) Risk skoru yüzdesi >= 70
  //  2) Top1 cüzdan > %50 (tek cüzdan supply'ı domine eder)
  //  3) Blacklist VEYA holder sayısı < 20 (yapay/onaylı olmayan token)
  let criticalConditions = 0;
  const reasons = [];
  if (riskPercent >= 70) { criticalConditions++; reasons.push('risk≥70'); }
  if (c && c.topHolderPct > 50) { criticalConditions++; reasons.push(`top1=${c.topHolderPct.toFixed(0)}%`); }
  if (c && (c.verification === 'blacklist' || (c.holdersCount && c.holdersCount < 20))) {
    criticalConditions++;
    if (c.verification === 'blacklist') reasons.push('blacklist');
    else reasons.push(`holders=${c.holdersCount}`);
  }
  // YENİ: -80%+ fiyat düşüşü tek başına kritik (rug paterni)
  if (pc24 <= -80) { criticalConditions++; reasons.push(`24h=${pc24.toFixed(0)}%`); }
  const isCritical = criticalConditions >= 2;

  // Warnings (i18n key + optional vars)
  const warnings = [];
  if (liq.score >= 3) warnings.push({ key: 'warn.lowLiq' });
  if (volRatio.score >= 3) warnings.push({ key: 'warn.pumpDump' });
  if (pc24 < -50) warnings.push({ key: 'warn.priceDrop' });
  if (pc1 > 200) warnings.push({ key: 'warn.priceSpike' });
  if (c) {
    if (c.mintable === true) warnings.push({ key: 'warn.mintOpen' });
    if (c.topHolderPct > 50) warnings.push({ key: 'warn.singleHolder', vars: { pct: c.topHolderPct.toFixed(0) } });
    else if (c.topHolderPct > 30) warnings.push({ key: 'warn.singleHolderMid', vars: { pct: c.topHolderPct.toFixed(0) } });
    if (c.top10Pct > 90) warnings.push({ key: 'warn.top10Concentrated', vars: { pct: c.top10Pct.toFixed(0) } });
  }

  const safetyPercent = Math.max(0, Math.min(100, 100 - riskPercent));

  return {
    risk,
    totalScore,
    riskPercent,
    safetyPercent,
    isCritical,
    criticalReasons: reasons,
    breakdown: {
      liquidity: liq,
      age,
      volumeLiquidityRatio: volRatio,
      buyerSellerBalance: balance,
      contract: { score: contractScore },
    },
    warnings,
  };
}

module.exports = { auditToken, liquidityLevel, ageAssessment, riskFromPercent, AUDIT_MAX_SCORE };
