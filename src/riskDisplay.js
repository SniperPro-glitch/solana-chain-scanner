// Risk gösterimi: iç risk % → kullanıcıya güven skoru (yüksek = daha iyi).

const { t, normalizeLang } = require('./i18n');

const LOW_SAFETY_THRESHOLD = parseInt(process.env.LOW_SAFETY_WARN_PCT || '50', 10);

function safetyPercent(riskPercent) {
  return Math.max(0, Math.min(100, 100 - Math.round(Number(riskPercent) || 0)));
}

function fmtPct(p, lang) {
  const L = normalizeLang(lang);
  return L === 'tr' ? `%${p}` : `${p}%`;
}

function riskEmojiForCode(code, ce) {
  if (code === 'LOW' || code === 'VERY_LOW') return ce('🟢');
  if (code === 'MEDIUM') return ce('🟡');
  return ce('🔥');
}

/** Güven skoruna göre etiket (risk.LOW/MEDIUM ile karışmasın — o filtre içindir). */
function safetyTierLabel(safePct, lang) {
  const L = normalizeLang(lang);
  const p = Number(safePct) || 0;
  if (p < LOW_SAFETY_THRESHOLD) return t('safety.tier.low', L);
  if (p < 70) return t('safety.tier.mid', L);
  return t('safety.tier.high', L);
}

function safetyEmoji(safePct, ce) {
  const p = Number(safePct) || 0;
  if (p < LOW_SAFETY_THRESHOLD) return ce('🔴');
  if (p < 70) return ce('🟡');
  return ce('🟢');
}

/** Kart / yorum: 🟢 %85 güvenli — Güvenilir profil */
function formatRiskLine(audit, lang, ce, _riskLabelFn) {
  const L = normalizeLang(lang);
  const safe = safetyPercent(audit.riskPercent);
  const em = safetyEmoji(safe, ce);
  const tier = safetyTierLabel(safe, L);
  return `${ce('🪙')} <b>${t('card.risk', L)}:</b> ${em} <b>${fmtPct(safe, L)} ${t('card.safetyWord', L)}</b> — <b>${tier}</b>`;
}

module.exports = {
  safetyPercent,
  fmtPct,
  riskEmojiForCode,
  safetyTierLabel,
  safetyEmoji,
  formatRiskLine,
  LOW_SAFETY_THRESHOLD,
};
