// Abone / admin için istatistik metinleri — storage verisinden HTML veya Markdown üretir.

function pct(part, total, digits = 1) {
  if (!total || total <= 0) return '—';
  return `${((part / total) * 100).toFixed(digits)}%`;
}

function barSpark(values, width = 12) {
  const arr = Array.isArray(values) ? values.filter((n) => n >= 0) : [];
  if (!arr.length) return '—';
  const max = Math.max(...arr, 1);
  const blocks = '▁▂▃▄▅▆▇█';
  const slice = arr.length > width ? arr.slice(-width) : arr;
  return slice.map((v) => blocks[Math.min(blocks.length - 1, Math.floor((v / max) * (blocks.length - 1)))]).join('');
}

/** @param {{ daily, weekly, stats, last24h }} bundle */
function formatSubscriberStats(bundle, lang = 'tr') {
  const { daily = {}, weekly = {}, stats = {}, last24h = {} } = bundle;
  const L = lang === 'en' ? 'en' : lang === 'ru' ? 'ru' : 'tr';

  const lines = [];
  if (L === 'tr') {
    lines.push('📊 <b>Kanal performans özeti</b>');
    lines.push('');
    lines.push('🛡 <b>Son 24 saat</b>');
    lines.push(`• Paylaşılan token: <b>${last24h.shared || 0}</b>`);
    lines.push(`• 🔴 Rug / scam uyarısı: <b>${last24h.scams || 0}</b>`);
    lines.push(`• 🟡 Erken risk uyarısı: <b>${last24h.risks || 0}</b>`);
    if ((last24h.recovered || 0) > 0) {
      lines.push(`• ♻️ Toparlanan: <b>${last24h.recovered}</b>`);
    }
    lines.push('');
    lines.push('📅 <b>Bugün</b>');
    lines.push(`• Paylaşım: <b>${daily.shared || 0}</b>  •  Scam: <b>${daily.scams || 0}</b>  •  Risk: <b>${daily.risks || 0}</b>`);
    lines.push('');
    lines.push('📆 <b>Bu hafta</b>');
    lines.push(`• Paylaşım: <b>${weekly.shared || 0}</b>  •  Scam: <b>${weekly.scams || 0}</b>  •  Risk: <b>${weekly.risks || 0}</b>`);
    lines.push('');
    lines.push('🏆 <b>Tüm zamanlar</b>');
    lines.push(`• Toplam paylaşım: <b>${stats.totalShared || 0}</b>`);
    lines.push(`• Yakalanan scam: <b>${stats.scamsCaught || 0}</b>`);
    lines.push(`• Risk uyarısı: <b>${stats.risksFlagged || 0}</b>`);
    const inspected = last24h.found || 0;
    if (inspected > 0 && (last24h.shared || 0) > 0) {
      lines.push(`• Filtre sonrası kanala çıkan: <b>${pct(last24h.shared, inspected)}</b> (24s)`);
    }
    lines.push('');
    lines.push('<i>Uyarılar otomatik izleme ile üretilir; yatırım tavsiyesi değildir.</i>');
  } else if (L === 'ru') {
    lines.push('📊 <b>Сводка канала</b>');
    lines.push('');
    lines.push(`🛡 <b>24ч</b>: shared <b>${last24h.shared || 0}</b> · scam <b>${last24h.scams || 0}</b> · risk <b>${last24h.risks || 0}</b>`);
    lines.push(`📅 <b>Сегодня</b>: shared <b>${daily.shared || 0}</b> · scam <b>${daily.scams || 0}</b>`);
    lines.push(`📆 <b>Неделя</b>: shared <b>${weekly.shared || 0}</b> · scam <b>${weekly.scams || 0}</b>`);
    lines.push(`🏆 <b>Всего</b>: shared <b>${stats.totalShared || 0}</b> · scam <b>${stats.scamsCaught || 0}</b>`);
    lines.push('<i>Не финансовый совет.</i>');
  } else {
    lines.push('📊 <b>Channel performance</b>');
    lines.push('');
    lines.push(`🛡 <b>Last 24h</b>: shared <b>${last24h.shared || 0}</b> · scams <b>${last24h.scams || 0}</b> · risks <b>${last24h.risks || 0}</b>`);
    lines.push(`📅 <b>Today</b>: shared <b>${daily.shared || 0}</b> · scams <b>${daily.scams || 0}</b>`);
    lines.push(`📆 <b>This week</b>: shared <b>${weekly.shared || 0}</b> · scams <b>${weekly.scams || 0}</b>`);
    lines.push(`🏆 <b>All-time</b>: shared <b>${stats.totalShared || 0}</b> · scams <b>${stats.scamsCaught || 0}</b>`);
    lines.push('<i>Automated alerts — not financial advice.</i>');
  }
  return lines.join('\n');
}

/** Admin DM — günlük rapor */
function formatAdminDailyDigest({ daily, stats, last24h, dateIso }) {
  const d = daily || {};
  const s = stats || {};
  const h = last24h || {};
  const catchRate = (h.found || 0) > 0 ? pct(h.scams || 0, h.found) : '—';

  return [
    `📊 <b>Günlük rapor</b> · ${dateIso || '—'}`,
    '',
    '<b>🎯 Aboneye değer (bugün)</b>',
    `🔴 Scam / rug: <b>${d.scams || 0}</b>`,
    `🟡 Risk uyarısı: <b>${d.risks || 0}</b>`,
    `🔍 Kanala paylaşım: <b>${d.shared || 0}</b>`,
    `♻️ Toparlanan: <b>${d.recovered || 0}</b>`,
    '',
    '<b>⏱ Son 24 saat (ring)</b>',
    `• Tarama döngüsü: ${h.scans || 0} · incelenen: ${h.found || 0}`,
    `• Paylaşılan: ${h.shared || 0} · reddedilen: ${h.rejected || 0}`,
    `• Scam: ${h.scams || 0} · risk: ${h.risks || 0} · hata: ${h.errors || 0}`,
    h.hourlyShared && h.hourlyShared.length ? `• Aktivite: <code>${barSpark(h.hourlyShared)}</code>` : null,
    '',
    '<b>🏆 Tüm zamanlar</b>',
    `• Paylaşım: <b>${s.totalShared || 0}</b> · scam: <b>${s.scamsCaught || 0}</b> · risk: <b>${s.risksFlagged || 0}</b>`,
    '',
    `<i>Son 24s scam / incelenen (yaklaşık): ${catchRate}</i>`,
  ].filter(Boolean).join('\n');
}

/** Admin DM — haftalık rapor (Pazartesi) */
function formatAdminWeeklyDigest({ weekly, stats, dateIso, weekStart }) {
  const w = weekly || {};
  const s = stats || {};
  return [
    `📆 <b>Haftalık rapor</b> · ${dateIso || '—'}`,
    weekStart ? `<i>Hafta başı: ${weekStart}</i>` : null,
    '',
    '<b>🎯 Bu hafta (abone özeti)</b>',
    `🔴 Scam / rug: <b>${w.scams || 0}</b>`,
    `🟡 Risk uyarısı: <b>${w.risks || 0}</b>`,
    `🔍 Paylaşım: <b>${w.shared || 0}</b>`,
    `♻️ Toparlanan: <b>${w.recovered || 0}</b>`,
    '',
    '<b>🏆 Tüm zamanlar</b>',
    `• Paylaşım: <b>${s.totalShared || 0}</b> · scam: <b>${s.scamsCaught || 0}</b> · risk: <b>${s.risksFlagged || 0}</b>`,
    '',
    '<i>Haftalık sayaçlar sıfırlandı. Günlük özet ayrı devam eder.</i>',
  ].filter(Boolean).join('\n');
}

/** /info paneli — kısa performans bloğu */
function formatInfoPerformanceBlock(bundle) {
  const { daily = {}, weekly = {}, last24h = {} } = bundle;
  const lines = [
    `🎯 *Performans (abone odaklı)*`,
    `• 24s: 🔴 ${last24h.scams || 0} scam · 🟡 ${last24h.risks || 0} risk · 📤 ${last24h.shared || 0} paylaşım`,
    `• Bugün: 🔴 ${daily.scams || 0} · 🟡 ${daily.risks || 0} · 📤 ${daily.shared || 0}`,
    `• Hafta: 🔴 ${weekly.scams || 0} · 🟡 ${weekly.risks || 0} · 📤 ${weekly.shared || 0}`,
  ];
  if (last24h.hourlyShared && last24h.hourlyShared.length) {
    lines.push(`• Paylaşım grafiği (24s): \`${barSpark(last24h.hourlyShared)}\``);
  }
  return lines.join('\n');
}

module.exports = {
  formatSubscriberStats,
  formatAdminDailyDigest,
  formatAdminWeeklyDigest,
  formatInfoPerformanceBlock,
  barSpark,
  pct,
};
