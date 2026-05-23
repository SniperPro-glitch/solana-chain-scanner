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
const { fmtUsd, fmtPriceUsd } = require('./formatUsd');

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

function fmtTaxPct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  return Number(n).toFixed(2);
}

/** GoPlus Solana transfer_fee — fee_rate birimi: 200 = %2 */
function parseSolanaTransferFee(gp) {
  const tf = gp?.transfer_fee;
  if (!gp || tf == null || typeof tf !== 'object') return null;
  const rateToPct = (raw) => {
    if (raw == null || raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Number((n / 100).toFixed(2));
  };
  if (Object.keys(tf).length === 0) {
    return { buyPct: 0, sellDisplay: '0%' };
  }
  const curRaw = tf.current_fee_rate?.fee_rate ?? tf.fee_rate;
  const schedRaw = tf.scheduled_fee_rate?.fee_rate;
  const cur = rateToPct(curRaw);
  let sellDisplay = `${cur}%`;
  if (schedRaw != null && schedRaw !== '' && String(curRaw) !== String(schedRaw)) {
    const sched = rateToPct(schedRaw);
    const lo = Math.min(cur, sched);
    const hi = Math.max(cur, sched);
    sellDisplay = `${lo.toFixed(2)}% - ${hi.toFixed(2)}%`;
  }
  return { buyPct: cur, sellDisplay };
}

function taxStatusFromPct(pct) {
  return Number(pct) > 10 ? 'bad' : 'good';
}

function auditCardLabels(lang) {
  const L = normalizeLang(lang);
  const tr = {
    verified: 'Kontrat doğrulandı',
    buyTax: 'Alım vergisi',
    sellTax: 'Satım vergisi',
    proxy: 'Proxy kontrat',
    mint: 'Mint authority',
    freeze: 'Freeze authority',
    meta: 'Metadata mutable',
    trusted: 'Trusted token',
    yes: 'Evet',
    no: 'Hayır',
    open: 'Açık',
    closed: 'Kapalı',
    has: 'Var',
    none: 'Yok',
  };
  const en = {
    verified: 'Contract verified',
    buyTax: 'Buy tax',
    sellTax: 'Sell tax',
    proxy: 'Proxy contract',
    mint: 'Mint authority',
    freeze: 'Freeze authority',
    meta: 'Metadata mutable',
    trusted: 'Trusted token',
    yes: 'Yes',
    no: 'No',
    open: 'Active',
    closed: 'Revoked',
    has: 'Yes',
    none: 'No',
  };
  const ru = {
    verified: 'Контракт проверен',
    buyTax: 'Налог на покупку',
    sellTax: 'Налог на продажу',
    proxy: 'Proxy-контракт',
    mint: 'Mint authority',
    freeze: 'Freeze authority',
    meta: 'Metadata mutable',
    trusted: 'Доверенный токен',
    yes: 'Да',
    no: 'Нет',
    open: 'Активен',
    closed: 'Отозван',
    has: 'Да',
    none: 'Нет',
  };
  if (L === 'en') return en;
  if (L === 'ru') return ru;
  return tr;
}

/** Bilgi sekmesi denetim kartı — yalnızca ölçülmüş / API alanları. */
function buildAuditCard(token, counts, lang = 'tr') {
  const L = normalizeLang(lang);
  const labels = auditCardLabels(L);
  const chain = token?.chain || 'solana';
  const c = token?.contract;
  if (!c) return null;

  const rows = [];
  const seen = new Set();
  const push = (id, label, value, status) => {
    if (seen.has(id) || value == null || value === '') return;
    seen.add(id);
    rows.push({ id, label, value, status: status || 'neutral' });
  };

  if (chain === 'bsc' || chain === 'eth' || chain === 'polygon' || chain === 'base') {
    const ext = c.bsc_extra;
    const gp = ext?.goplus;
    if (c.verified === true) push('verified', labels.verified, labels.yes, 'good');
    else if (c.verified === false) push('verified', labels.verified, labels.no, 'warn');

    const buyT = fmtTaxPct(ext?.buyTax) ?? fmtTaxPct(gp?.buy_tax);
    const sellT = fmtTaxPct(ext?.sellTax) ?? fmtTaxPct(gp?.sell_tax);
    if (buyT != null) {
      push('buyTax', labels.buyTax, `${buyT}%`, Number(buyT) > 10 ? 'bad' : 'good');
    }
    if (sellT != null) {
      push('sellTax', labels.sellTax, `${sellT}%`, Number(sellT) > 10 ? 'bad' : 'good');
    }
    if (gp && gp.is_proxy != null && gp.is_proxy !== '') {
      const proxy = String(gp.is_proxy) === '1';
      push('proxy', labels.proxy, proxy ? labels.yes : labels.no, proxy ? 'bad' : 'good');
    }
  }

  if (chain === 'solana') {
    const sx = c.solana_extra;
    const rc = sx?.rugcheck && !sx.rugcheck.error ? sx.rugcheck : null;
    const gp = sx?.goplus;

    let mintOpen = null;
    if (c.mintable === false) mintOpen = false;
    else if (c.mintable === true) mintOpen = true;
    else if (rc?.mintAuthority) mintOpen = true;
    else if (rc && !rc.mintAuthority) mintOpen = false;
    if (mintOpen == null && gp?.mintable_status != null && gp.mintable_status !== '') {
      mintOpen = String(gp.mintable_status) === '1';
    }
    if (mintOpen != null) {
      push('proxy', labels.proxy, mintOpen ? labels.yes : labels.no, mintOpen ? 'bad' : 'good');
    }

    if (c.verification === 'whitelist') {
      push('verified', labels.verified, labels.yes, 'good');
    } else if (gp?.trusted_token != null && gp.trusted_token !== '') {
      const trusted = Number(gp.trusted_token) === 1;
      push('verified', labels.verified, trusted ? labels.yes : labels.no, trusted ? 'good' : 'warn');
    }

    const buyT = fmtTaxPct(gp?.buy_tax);
    const sellT = fmtTaxPct(gp?.sell_tax);
    if (buyT != null) {
      push('buyTax', labels.buyTax, `${buyT}%`, taxStatusFromPct(buyT));
    }
    if (sellT != null) {
      push('sellTax', labels.sellTax, `${sellT}%`, taxStatusFromPct(sellT));
    }

    if (gp && !seen.has('buyTax')) {
      const tax = parseSolanaTransferFee(gp);
      if (tax) {
        push('buyTax', labels.buyTax, `${tax.buyPct}%`, taxStatusFromPct(tax.buyPct));
        push('sellTax', labels.sellTax, tax.sellDisplay, taxStatusFromPct(tax.buyPct));
      }
    }
  }

  if (!rows.length) return null;

  return finalizeAuditCard(rows, counts);
}

const AUDIT_ROW_ORDER = ['verified', 'buyTax', 'sellTax', 'proxy', 'mint', 'freeze', 'meta', 'trusted'];

function sortAuditCardRows(rows) {
  return [...rows].sort((a, b) => {
    const ia = AUDIT_ROW_ORDER.indexOf(a.id);
    const ib = AUDIT_ROW_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function finalizeAuditCard(rows, counts) {
  const sorted = sortAuditCardRows(rows);
  const issueCount = sorted.filter((r) => r.status === 'warn' || r.status === 'bad').length;
  const reviewCount = (counts?.warn || 0) + (counts?.bad || 0);
  return {
    rows: sorted,
    issueCount,
    badgeCount: issueCount > 0 ? issueCount : reviewCount > 0 ? reviewCount : 1,
    totalChecks: counts?.total || sorted.length,
  };
}

function normAuditText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const LEGACY_AUDIT_ROW_IDS = new Set(['mint', 'trusted', 'freeze', 'meta']);

function auditCardNeedsRebuild(card) {
  if (!card?.rows?.length) return true;
  if (card.rows.some((r) => LEGACY_AUDIT_ROW_IDS.has(r.id))) return true;
  const ids = new Set(card.rows.map((r) => r.id));
  if (ids.has('verified') && ids.has('proxy') && !ids.has('buyTax')) return true;
  return false;
}

/** Eski API / proxy yanıtları — kontrat satırları ve kontrol listesinden kart. */
function buildAuditCardFromPayload(payload) {
  if (payload?.auditCard?.rows?.length && !auditCardNeedsRebuild(payload.auditCard)) {
    return payload.auditCard;
  }

  const lang = payload?.lang || 'tr';
  const labels = auditCardLabels(lang);
  const counts = payload?.counts || {};
  const rows = [];
  const seen = new Set();

  const push = (id, label, value, status) => {
    if (seen.has(id) || value == null || value === '') return;
    seen.add(id);
    rows.push({ id, label, value, status: status || 'neutral' });
  };

  const lines = [];
  for (const line of payload?.contract || []) lines.push(String(line));
  for (const c of payload?.checks?.all || []) {
    if (c?.text) lines.push(String(c.text));
  }
  for (const line of payload?.onchain || []) lines.push(String(line));
  for (const line of payload?.signals || []) {
    if (line?.text) lines.push(String(line.text));
  }

  for (const raw of lines) {
    const t = normAuditText(raw);
    if (!t || t.includes('kontrat güvenliği') || t.includes('contract security')) continue;

    if (
      (/mint.*(kilitli|kapalı|locked|revoked|sabit arz|disabled)/.test(t) || /mint kapalı/.test(t))
      && !/mint.*(açık|open)/.test(t)
    ) {
      push('proxy', labels.proxy, labels.no, 'good');
    } else if (/mint.*(açık|open)|sahibi basabilir|can issue/.test(t)) {
      push('proxy', labels.proxy, labels.yes, 'bad');
    }

    if (/doğrulanmış token|verified token|contract.*verified|bscscan.*verified/.test(t)) {
      push('verified', labels.verified, labels.yes, 'good');
    }

    const buyM = t.match(/(?:alım|buy)[\s-]*(?:vergisi|tax)?[^%]{0,24}?(\d+(?:[.,]\d+)?)\s*%/);
    if (buyM) {
      const v = buyM[1].replace(',', '.');
      push('buyTax', labels.buyTax, `${v}%`, Number(v) > 10 ? 'bad' : 'good');
    }
    const sellM = t.match(/(?:satım|sell)[\s-]*(?:vergisi|tax)?[^%]{0,24}?(\d+(?:[.,]\d+)?)\s*%/);
    if (sellM) {
      const v = sellM[1].replace(',', '.');
      push('sellTax', labels.sellTax, `${v}%`, Number(v) > 10 ? 'bad' : 'good');
    }

    if (/proxy\s*(kontrat|contract)/.test(t)) {
      const no = /(hayır|no\b|değil|not )/.test(t);
      push('proxy', labels.proxy, no ? labels.no : labels.yes, no ? 'good' : 'bad');
    }

    if (/güvenilir.*(değil|hayır|not)|not trusted|trusted_token.*0|güvenilir token listesinde değil/.test(t)) {
      push('verified', labels.verified, labels.no, 'warn');
    } else if (/güvenilir liste|trusted token|güvenilir token/.test(t) && !/değil|hayır|not/.test(t)) {
      push('verified', labels.verified, labels.yes, 'good');
    }
  }

  const hasGoPlus = lines.some((raw) => /goplus/i.test(normAuditText(raw)));
  if (hasGoPlus && !seen.has('buyTax')) {
    push('buyTax', labels.buyTax, '0%', 'good');
    push('sellTax', labels.sellTax, '0%', 'good');
  }

  if (!rows.length) return null;

  return finalizeAuditCard(rows, counts);
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

  const counts = { good: goodCount, warn: warnCount, bad: badCount, total: items.length };

  const payload = {
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
      price: fmtPriceUsd(token.priceUsd),
      change24h: typeof token.priceChange24h === 'number' ? `${token.priceChange24h.toFixed(1)}%` : null,
    },
    highlights: highlights.map((h) => ({ level: h.sev, text: h.text })),
    rugcheck: buildRugCheckCompactLine(token, L) || null,
    signals,
    onchain,
    contract: contractLines,
    links: linksLines,
    actions: getChainLinks(token),
    counts,
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

  const fromToken = buildAuditCard(token, counts, L);
  payload.auditCard = fromToken && !auditCardNeedsRebuild(fromToken)
    ? fromToken
    : buildAuditCardFromPayload({ ...payload, auditCard: fromToken }) || fromToken;
  return payload;
}

module.exports = { buildReportPayload, buildAuditCard, buildAuditCardFromPayload, fmtUsd };
