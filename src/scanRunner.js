// Otomatik tarama — Solana (BSC/TON scanRunner deseni).

const { recordMiniAppShare } = require('./recordMiniAppShare');
const { publishToDexFirst } = require('./publishPipeline');
const CHAIN_ID = 'solana';

function createScanRunner(deps) {
  const {
    chainsRegistry,
    channels,
    storage,
    formatTokenCard,
    solanaBannerSource,
    sendCardToChannel,
    sendBotAnalysisFollowup,
    ensureShareEnrichment,
    applyTokenBadges,
    MAX_TOKENS_PER_SCAN,
    SCAN_POOL_FETCH_LIMIT,
    SCAN_TOKEN_GAP_MS,
  } = deps;

  let scanning = false;
  let lastScanResult = null;

  async function runScan(triggeredBy = 'cron') {
    if (scanning) return { skipped: true, reason: 'already_running', chain: CHAIN_ID };
    scanning = true;
    const startedAt = Date.now();
    const chain = chainsRegistry.getChain(CHAIN_ID);

    const result = {
      found: 0,
      sharedToChannels: 0,
      skipped: 0,
      errors: 0,
      tokensShared: 0,
      triggeredBy,
      chain: CHAIN_ID,
      activeChannels: channels.listEnabled().length,
    };

    try {
      const activeChannels = channels.listEnabled().filter((c) => {
        const chList = c.settings?.chains;
        return Array.isArray(chList) && chList.includes(CHAIN_ID);
      });

      if (activeChannels.length === 0) {
        if (triggeredBy !== 'cron') result.error = 'Aktif kanal yok';
        result.skipped = true;
        return result;
      }

      const ctrl = storage.getControl();
      if (ctrl.status !== 'running') {
        result.paused = true;
        result.skipped = true;
        return result;
      }

      console.log(`🔍 [solana/${triggeredBy}] ${activeChannels.length} kanal`);

      const globalMinLiq = Math.min(...activeChannels.map((c) => c.settings?.minLiquidityUsd ?? 0));
      const tokens = await chain.scanNewTokens({
        minLiquidityUsd: Math.max(0, globalMinLiq),
        limit: SCAN_POOL_FETCH_LIMIT,
      });
      result.found = tokens.length;

      let postedTokens = 0;
      const rejectionsByCategory = {};

      for (const token of tokens) {
        if (postedTokens >= MAX_TOKENS_PER_SCAN) break;
        if (storage.isSeen(token.poolId)) {
          result.skipped++;
          continue;
        }

        token.chain = CHAIN_ID;
        token.initialLiquidity = token.liquidityUsd || 0;
        await ensureShareEnrichment(token, CHAIN_ID).catch(() => {});
        applyTokenBadges(token);
        let audit = chain.auditToken(token);
        let sentToAny = false;
        const channelMessages = [];
        let dexListing = null;

        for (const ch of activeChannels) {
          const filterCheck = channels.tokenPassesChannelFilters(token, audit, ch);
          if (!filterCheck.pass) {
            const cat = channels.categorizeFilterReason(filterCheck.reason);
            rejectionsByCategory[cat] = (rejectionsByCategory[cat] || 0) + 1;
            continue;
          }

          const chLang = channels.resolveCardLang(ch);
          const isCritical = audit.isCritical === true;
          const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
          const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
          const message = formatTokenCard(token, audit, chLang, cardLevel, { slim: true });
          const silent = ch.settings?.silentNotification === true;
          const bannerLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');

          try {
            if (!dexListing) {
              dexListing = publishToDexFirst(token, audit, chLang, cardLevel);
            }

            recordMiniAppShare(ch, token, audit, chLang, cardLevel, dexListing.reportId);

            const r = await sendCardToChannel(ch, {
              text: message,
              ...solanaBannerSource(bannerLevel),
              silent,
              chain: CHAIN_ID,
            });
            if (!r.ok) throw new Error(r.error || 'send fail');

            const cmEntry = r.messageId ? {
              chatId: ch.id,
              messageId: r.messageId,
              hasPhoto: !!(solanaBannerSource(bannerLevel).photoFileId || solanaBannerSource(bannerLevel).photoLocalPath),
              originalText: message,
              lang: chLang,
              via: r.via,
            } : null;
            if (cmEntry) {
              channelMessages.push(cmEntry);
              await sendBotAnalysisFollowup(ch, cmEntry, token, audit, chLang, cardLevel, {
                reportId: dexListing.reportId,
                dexAppUrl: dexListing.dexAppUrl,
              });
            }
            channels.recordSuccess(ch.id);
            sentToAny = true;
            result.sharedToChannels++;
            await new Promise((r) => setTimeout(r, 350));
          } catch (err) {
            result.errors++;
            channels.recordError(ch.id, err.message);
            console.error(`   ✗ ${ch.title}:`, err.message);
          }
        }

        if (sentToAny) {
          storage.markSeen(token.poolId);
          storage.watch(token.poolId, {
            chain: CHAIN_ID,
            tokenSymbol: token.tokenSymbol,
            tokenName: token.tokenName,
            tokenAddress: token.tokenAddress,
            poolAddress: token.poolAddress,
            dex: token.dex,
            initialLiquidity: token.liquidityUsd || 0,
            channelMessages,
            lastWatchLevel: audit.isCritical || audit.risk.code === 'HIGH' ? 'yellow' : 'green',
          });
          postedTokens++;
          result.tokensShared++;
        }

        if (SCAN_TOKEN_GAP_MS > 0) await new Promise((r) => setTimeout(r, SCAN_TOKEN_GAP_MS));
      }

      result.durationMs = Date.now() - startedAt;
      storage.recordScanCycle({
        durationMs: result.durationMs,
        poolsFetched: tokens.length,
        tokensInspected: tokens.length,
        tokensShared: postedTokens,
        rejectionsByCategory,
        errors: result.errors,
      });
      lastScanResult = result;
      const rej = Object.keys(rejectionsByCategory).length
        ? ` · red: ${Object.entries(rejectionsByCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`
        : '';
      console.log(
        `✅ [solana] tarama: bulunan=${result.found} paylaşılan=${postedTokens} mesaj=${result.sharedToChannels} atlanan=${result.skipped}${rej} (${result.durationMs}ms)`,
      );
    } catch (err) {
      console.error('❌ [solana] tarama:', err.message);
      result.errors++;
      result.error = err.message;
    } finally {
      scanning = false;
    }
    return result;
  }

  return { runScan, getLastScanResult: () => lastScanResult };
}

module.exports = { createScanRunner };
