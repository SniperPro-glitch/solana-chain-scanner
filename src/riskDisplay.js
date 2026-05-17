// Risk gösterimi: iç risk % → kullanıcıya güven skoru (yüksek = daha iyi).

const { t, normalizeLang } = require('./i18n');

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

/** Kart / yorum: 🟡 %65 güven — ORTA */
function formatRiskLine(audit, lang, ce, riskLabelFn) {
  const L = normalizeLang(lang);
  const safe = safetyPercent(audit.riskPercent);
  const em = riskEmojiForCode(audit.risk.code, ce);
  const lbl = riskLabelFn(audit.risk.code, L);
  return `${ce('🔎')} <b>${t('card.risk', L)}:</b> ${em} <b>${fmtPct(safe, L)}</b> ${t('card.safetyWord', L)} — <b>${lbl}</b>`;
}

module.exports = {
  safetyPercent,
  fmtPct,
  riskEmojiForCode,
  formatRiskLine,
};
