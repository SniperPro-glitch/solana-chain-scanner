// Admin panel — feed'e manuel token ekleme.

const solana = require('./chains/solana');
const reportStore = require('./reportStore');
const { recordMiniAppShare } = require('./recordMiniAppShare');
const { tokenToFeedItem } = require('./miniAppFeed');

function cardLevelFromAudit(audit) {
  if (audit?.isCritical) return 'critical';
  if (audit?.risk?.code === 'HIGH') return 'red';
  if (audit?.risk?.code === 'MEDIUM') return 'yellow';
  return 'green';
}

async function addTokenToFeed(input, lang = 'tr') {
  const raw = String(input || '').trim();
  if (!raw) {
    const err = new Error('Mint adresi veya link girin');
    err.code = 'bad_input';
    throw err;
  }

  let token;
  try {
    token = await solana.resolveTokenFromInput(raw);
  } catch (e) {
    if (e.code === 'WRONG_CHAIN') {
      const err = new Error(`Bu token ${e.foreignChain || '?'} zincirinde — şimdilik sadece Solana.`);
      err.code = 'wrong_chain';
      throw err;
    }
    throw e;
  }

  if (!token?.tokenAddress) {
    const err = new Error('Token bulunamadı — mint veya DexScreener linkini kontrol edin.');
    err.code = 'not_found';
    throw err;
  }

  token.chain = 'solana';
  token.initialLiquidity = token.liquidityUsd || 0;

  const { ensureShareEnrichment } = require('./shareEnrichment');
  await ensureShareEnrichment(token, 'solana').catch(() => {});

  const audit = solana.auditToken(token);
  const level = cardLevelFromAudit(audit);
  const reportId = await reportStore.saveReportAsync({ token, audit, lang, level });

  recordMiniAppShare(
    { id: 'admin-panel', title: 'Admin Panel' },
    token,
    audit,
    lang,
    level,
    reportId,
  );

  const item = tokenToFeedItem(token, audit, 1, reportId);
  return {
    ok: true,
    reportId,
    level,
    symbol: item.symbol,
    mint: item.mint,
    item,
  };
}

async function previewTokenFromInput(input, lang = 'tr') {
  const raw = String(input || '').trim();
  if (!raw) {
    const err = new Error('Mint adresi veya link girin');
    err.code = 'bad_input';
    throw err;
  }

  let token;
  try {
    token = await solana.resolveTokenFromInput(raw);
  } catch (e) {
    if (e.code === 'WRONG_CHAIN') {
      const err = new Error(`Bu token ${e.foreignChain || '?'} zincirinde — şimdilik sadece Solana.`);
      err.code = 'wrong_chain';
      throw err;
    }
    throw e;
  }

  if (!token?.tokenAddress) {
    const err = new Error('Token bulunamadı — mint veya DexScreener linkini kontrol edin.');
    err.code = 'not_found';
    throw err;
  }

  token.chain = 'solana';
  const audit = solana.auditToken(token);
  const item = tokenToFeedItem(token, audit, 1, null);
  return { ok: true, item };
}

module.exports = { addTokenToFeed, previewTokenFromInput };
