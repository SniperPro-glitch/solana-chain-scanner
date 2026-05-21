// Admin panel — feed'e manuel token ekleme.

const solana = require('./chains/solana');
const reportStore = require('./reportStore');
const botFeedStore = require('./botFeedStore');
const { recordMiniAppShare } = require('./recordMiniAppShare');
const { tokenToFeedItem } = require('./miniAppFeed');

function duplicateFeedError(existing, token) {
  const sym = existing?.token?.tokenSymbol || token?.tokenSymbol || existing?.mint?.slice(0, 8) || '?';
  const err = new Error(`Bu token zaten feed listesinde (${sym}). Tekrar eklenemez.`);
  err.code = 'duplicate';
  err.symbol = sym;
  err.mint = existing?.mint || token?.tokenAddress;
  return err;
}

async function assertNotInFeed(mint, token) {
  const existing = await botFeedStore.findByMintAsync(mint);
  if (existing) throw duplicateFeedError(existing, token);
}

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

  await assertNotInFeed(token.tokenAddress, token);

  const { ensureShareEnrichment } = require('./shareEnrich');
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
  const existing = await botFeedStore.findByMintAsync(token.tokenAddress);
  const audit = solana.auditToken(token);
  const item = tokenToFeedItem(token, audit, 1, null);
  const sym = existing?.token?.tokenSymbol || token.tokenSymbol || token.tokenAddress?.slice(0, 8);
  return {
    ok: true,
    item,
    duplicate: !!existing,
    duplicateMessage: existing
      ? `Bu token zaten feed listesinde (${sym}).`
      : null,
  };
}

module.exports = { addTokenToFeed, previewTokenFromInput };
