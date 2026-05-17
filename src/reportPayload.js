// Mini App JSON — tüm testler / detay burada.

const { t, normalizeLang } = require('./i18n');
const { safetyPercent, safetyTierLabel, fmtPct } = require('./riskDisplay');
const {
  collectAnalysisMetrics,
  collectRedFlags,
  collectReportBullets,
  buildRugCheckCompactLine,
  pickVerdictHtml,
  ageSummary,
  liqSummaryWord,
} = require('./analysis');
const { formatContractSecurityBlock } = require('./contractSecurityBlock');
const { formatLinksTradeBlock, getChainLinks } = require('./commentLinksTrade');
const { buildMarketFromToken } = require('./marketData');

function fmtUsd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '?';
  if (n < 1_000) return `$${Number(n).toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').trim();
}

function levelLabel(level, lang) {
  const L = normalizeLang(lang);
  const map = {
    green: { tr: 'Yeşil', en: 'Green', ru: 'Зелёный' },
    yellow: { tr: 'Sarı', en: 'Yellow', ru: 'Жёлтый' },
    critical: { tr: 'Kritik', en: 'Critical', ru: 'Критический' },
    red: { tr: 'Scam / Rug', en: 'Scam / Rug', ru: 'Scam' },
  };
  return map[level]?.[L] || map.green[L];
}

function buildReportPayload(token, audit, lang = 'tr', level = 'green') {
  const L = normalizeLang(lang);
  const chain = token?.chain || 'solana';
  const { items, deepLines, goodCount, warnCount, badCount } = collectAnalysisMetrics(token, audit, L, { chain });
  const safe = safetyPercent(audit.riskPercent);
  const redFlags = collectRedFlags(token, L);
  const highlights = collectReportBullets(items, redFlags, L, { maxBullets: 12, skipContractDupes: false });

  function iconLevel(icon) {
    if (icon === '❌') return 'bad';
    if (icon === '⚠️') return 'warn';
    if (icon === '✅') return 'good';
    return 'info';
  }

  const allChecks = items.map((i) => ({
    level: iconLevel(i.icon),
    text: stripHtml(i.text),
  }));

  const signals = allChecks.filter((i) => i.level === 'bad' || i.level === 'warn');

  const onchain = deepLines.map((line) => stripHtml(line).replace(/^[⚠️❌✅📊🔥🛡👥🔗🔒🔓🧪📝🌡🏷]+\s*/, ''));

  const contractHtml = formatContractSecurityBlock(token, L, chain, { skipTitle: false, showHolders: true });
  const contractLines = contractHtml
    ? contractHtml.split('\n').map((line) => stripHtml(line)).filter(Boolean)
    : [];

  const linksHtml = formatLinksTradeBlock(token, L);
  const linksLines = linksHtml
    ? linksHtml.split('\n').map((line) => stripHtml(line)).filter(Boolean)
    : [];

  return {
    id: null,
    lang: L,
    level,
    levelLabel: levelLabel(level, L),
    symbol: token.tokenSymbol || '?',
    address: token.tokenAddress || '',
    market: buildMarketFromToken(token),
    dex: token.dex || null,
    trust: {
      score: safe,
      scoreLabel: `${fmtPct(safe, L)} ${t('card.safetyWord', L)}`,
      tier: safetyTierLabel(safe, L),
      verdict: stripHtml(pickVerdictHtml(token, audit, L, { goodCount, warnCount, badCount })),
    },
    summary: {
      liquidityUsd: fmtUsd(token.liquidityUsd),
      liquidityWord: liqSummaryWord(audit.breakdown.liquidity, L),
      age: ageSummary(audit.breakdown.age, L),
      price: fmtUsd(token.priceUsd),
      change24h: typeof token.priceChange24h === 'number' ? `${token.priceChange24h.toFixed(1)}%` : null,
    },
    highlights: highlights.map((h) => ({ level: h.sev, text: h.text })),
    rugcheck: buildRugCheckCompactLine(token, L) || null,
    signals,
    onchain,
    contract: contractLines,
    links: linksLines,
    actions: getChainLinks(token),
    counts: { good: goodCount, warn: warnCount, bad: badCount, total: items.length },
    checks: {
      all: allChecks,
      passed: allChecks.filter((c) => c.level === 'good'),
      warnings: allChecks.filter((c) => c.level === 'warn'),
      critical: allChecks.filter((c) => c.level === 'bad'),
      info: allChecks.filter((c) => c.level === 'info'),
    },
    audit: {
      riskPercent: audit.riskPercent,
      riskCode: audit.risk?.code || null,
      breakdown: {
        liquidity: audit.breakdown?.liquidity?.code || null,
        age: audit.breakdown?.age?.code || null,
        holders: audit.breakdown?.holders?.code || null,
        contract: audit.breakdown?.contract?.code || null,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { buildReportPayload, fmtUsd };
