// Otomatik tarama — TON / BSC / Solana (kanal başına tek ağ).

const { recordMiniAppShare } = require('./recordMiniAppShare');
const { publishToDexFirst } = require('./publishPipeline');
const { isOfficialFeedChannel } = require('./channelFeedPolicy');
const { formatTokenCardForChain, bannerSourceForChain } = require('./chainRuntime');

function createScanRunner(deps) {
  const {
    chainsRegistry,
    channels,
    storage,
    sendCardToChannel,
    sendBotAnalysisFollowup,
    ensureShareEnrichment,
    applyTokenBadges,
    MAX_TOKENS_PER_SCAN,
    getScanPoolLimit,
    SCAN_TOKEN_GAP_MS,
  } = deps;

  const scanningByChain = { ton: false, bsc: false, solana: false };
  const lastScanResult = {};

  async function runScan(triggeredBy = 'cron', chainId = 'solana') {
    const cid = String(chainId || 'solana').toLowerCase();
    if (scanningByChain[cid]) return { skipped: true, reason: 'already_running', chain: cid };
    scanningByChain[cid] = true;
    const startedAt = Date.now();
    const chain = chainsRegistry.getChain(cid);
    const poolLimit = typeof getScanPoolLimit === 'function' ? getScanPoolLimit(cid) : 12;

    const result = {
      found: 0,
      sharedToChannels: 0,
      skipped: 0,
      errors: 0,
      tokensShared: 0,
      triggeredBy,
      chain: cid,
      activeChannels: channels.listEnabled().length,
    };

    try {
      const activeChannels = channels.listEnabled().filter((c) => {
        const chList = c.settings?.chains;
        if (!Array.isArray(chList) || chList.length === 0) return false;
        return chList.includes(cid);
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

      console.log(`🔍 [${cid}/${triggeredBy}] ${activeChannels.length} kanal`);

      const globalMinLiq = Math.min(...activeChannels.map((c) => c.settings?.minLiquidityUsd ?? 0));
      const tokens = await chain.scanNewTokens({
        minLiquidityUsd: Math.max(0, globalMinLiq),
        limit: poolLimit,
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

        token.chain = cid;
        token.initialLiquidity = token.liquidityUsd || 0;
        await ensureShareEnrichment(token, cid).catch(() => {});
        if (typeof applyTokenBadges === 'function') applyTokenBadges(token);
        let audit = chain.auditToken(token);
        let sentToAny = false;
        const channelMessages = [];

        const eligible = [];
        for (const ch of activeChannels) {
          const filterCheck = channels.tokenPassesChannelFilters(token, audit, ch, { chainId: cid });
          if (filterCheck.pass) eligible.push(ch);
          else {
            const cat = channels.categorizeFilterReason(filterCheck.reason);
            rejectionsByCategory[cat] = (rejectionsByCategory[cat] || 0) + 1;
          }
        }

        if (!eligible.length) continue;

        const isCritical = audit.isCritical === true;
        const isRisky = !isCritical && (audit.risk.code === 'HIGH' || audit.risk.code === 'MEDIUM');
        const cardLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
        const bannerLevel = isCritical ? 'critical' : (isRisky ? 'yellow' : 'green');
        const baseLang = channels.resolveCardLang(eligible[0]);
        const officialEligible = eligible.filter((ch) => isOfficialFeedChannel(ch.id));
        let dexListing = { reportId: null, dexAppUrl: null };
        if (cid === 'solana' && officialEligible.length) {
          dexListing = await publishToDexFirst(token, audit, baseLang, cardLevel);
        }
        const dexTag = officialEligible.length && cid === 'solana' ? 'DEX+app' : 'kanal-only';
        console.log(
          `[scan] filtre OK ${token.tokenSymbol || '?'} → ${dexTag} · ${eligible.length} kanal (${officialEligible.length} resmi)`,
        );

        for (const ch of eligible) {
          const chLang = channels.resolveCardLang(ch);
          const message = formatTokenCardForChain(cid, token, audit, chLang, cardLevel, { slim: true });
          const silent = ch.settings?.silentNotification === true;
          const official = cid === 'solana' && isOfficialFeedChannel(ch.id);

          if (official) {
            recordMiniAppShare(ch, token, audit, chLang, cardLevel, dexListing.reportId);
          }

          try {
            const r = await sendCardToChannel(ch, {
              text: message,
              ...bannerSourceForChain(cid, bannerLevel),
              silent,
              chain: cid,
            });
            if (!r.ok) throw new Error(r.error || 'send fail');

            const banner = bannerSourceForChain(cid, bannerLevel);
            const cmEntry = r.messageId ? {
              chatId: ch.id,
              messageId: r.messageId,
              hasPhoto: !!(banner.photoFileId || banner.photoLocalPath),
              originalText: message,
              lang: chLang,
              via: r.via,
            } : null;
            if (cmEntry) {
              channelMessages.push(cmEntry);
              await sendBotAnalysisFollowup(ch, cmEntry, token, audit, chLang, cardLevel, {
                reportId: official ? dexListing.reportId : null,
                dexAppUrl: official ? dexListing.dexAppUrl : null,
                includeMiniApp: official,
              });
            }
            channels.recordSuccess(ch.id);
            sentToAny = true;
            result.sharedToChannels++;
            await new Promise((res) => setTimeout(res, 350));
          } catch (err) {
            result.errors++;
            channels.recordError(ch.id, err.message);
            console.error(`   ✗ ${ch.title}:`, err.message);
          }
        }

        if (sentToAny) {
          storage.markSeen(token.poolId);
          storage.watch(token.poolId, {
            chain: cid,
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
        chain: cid,
      });
      lastScanResult[cid] = result;
      const rej = Object.keys(rejectionsByCategory).length
        ? ` · red: ${Object.entries(rejectionsByCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`
        : '';
      console.log(
        `✅ [${cid}] tarama: bulunan=${result.found} paylaşılan=${postedTokens} mesaj=${result.sharedToChannels} atlanan=${result.skipped}${rej} (${result.durationMs}ms)`,
      );
    } catch (err) {
      console.error(`❌ [${cid}] tarama:`, err.message);
      result.errors++;
      result.error = err.message;
    } finally {
      scanningByChain[cid] = false;
    }
    return result;
  }

  return {
    runScan,
    getLastScanResult: (chainId) => lastScanResult[String(chainId || 'solana').toLowerCase()] || null,
  };
}

module.exports = { createScanRunner };
