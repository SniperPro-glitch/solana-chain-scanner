// İzleme döngüsü — likidite düşüşü (sarı) / rug (kırmızı).

const CHAIN_ID = 'solana';
const RISK_DROP_THRESHOLD = 0.5;
const RISK_DROP_WITH_SILENCE = 0.35;
const RISK_MIN_LIQ_USD = 500;
const WATCH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const { isLiquidityDrained } = require('./liquidityDrain');

function createWatchRunner(deps) {
  const {
    bot,
    chainsRegistry,
    channels,
    storage,
    formatTokenCard,
    formatRiskBanner,
    solanaBannerSource,
    editCardMessage,
    wrapEmojis,
    DEFAULT_LANG,
    WATCH_BATCH_SIZE,
    WATCH_BATCH_DELAY_MS,
  } = deps;

  function channelAccepts(ch, tokenChain) {
    if (!ch || ch.settings?.enabled === false) return false;
    const chList = ch.settings?.chains;
    return Array.isArray(chList) && chList.includes(tokenChain);
  }

  function classifyRisk({ initial, current, buys5m }) {
    if (isLiquidityDrained(null, { initialLiquidity: initial, currentLiquidity: current })) return 'red';
    const dropRatio = initial > 0 ? (initial - current) / initial : 0;
    if (dropRatio >= RISK_DROP_THRESHOLD) return 'yellow';
    if (buys5m === 0 && dropRatio >= RISK_DROP_WITH_SILENCE) return 'yellow';
    if (buys5m === 0 && current < RISK_MIN_LIQ_USD) return 'yellow';
    return 'green';
  }

  async function checkWatchedTokens() {
    const watched = storage.listWatched();
    if (!watched.length) return;

    const active = watched.filter((w) => {
      if (Date.now() - w.sharedAt > WATCH_MAX_AGE_MS) {
        storage.removeWatched(w.poolId);
        return false;
      }
      if (w.alerted) return false;
      return (w.chain || CHAIN_ID) === CHAIN_ID;
    });
    if (!active.length) return;

    const chain = chainsRegistry.getChain(CHAIN_ID);
    const liveData = new Map();

    for (let i = 0; i < active.length; i += WATCH_BATCH_SIZE) {
      const batch = active.slice(i, i + WATCH_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((w) => chain.fetchPoolLiquidity(w.poolAddress).catch(() => null)),
      );
      batch.forEach((w, idx) => {
        if (results[idx]) liveData.set(w.poolId, results[idx]);
      });
      if (i + WATCH_BATCH_SIZE < active.length) {
        await new Promise((r) => setTimeout(r, WATCH_BATCH_DELAY_MS));
      }
    }

    for (const w of active) {
      const live = liveData.get(w.poolId);
      if (!live) continue;

      const initial = w.initialLiquidity || 0;
      const current = live.liquidityUsd || 0;
      const buys5m = live.buys5m || 0;
      const level = classifyRisk({ initial, current, buys5m });
      storage.updateWatched(w.poolId, { lastLiquidity: current });

      const cms = w.channelMessages || [];
      if (!cms.length) {
        storage.removeWatched(w.poolId);
        continue;
      }

      if (level === 'green') continue;
      if (level === 'yellow' && w.warnedAt && !w.recoveredAt) continue;
      if (level === 'red' && w.alerted) continue;

      let freshToken = null;
      let freshAudit = null;
      try {
        freshToken = await chain.resolveTokenFromInput(w.tokenAddress || w.poolAddress);
        if (freshToken) {
          freshToken.chain = CHAIN_ID;
          freshToken.initialLiquidity = w.initialLiquidity || freshToken.liquidityUsd || 0;
          freshAudit = chain.auditToken(freshToken);
        }
      } catch (e) {
        console.warn(`[watch] resolve $${w.tokenSymbol}:`, e.message);
      }

      const cardLevel = level === 'red' ? 'red' : 'yellow';

      for (const msg of cms) {
        const ch = channels.get(msg.chatId);
        if (!channelAccepts(ch, CHAIN_ID)) continue;
        const msgLang = msg.lang || DEFAULT_LANG;

        if (freshToken && freshAudit) {
          const card = formatTokenCard(freshToken, freshAudit, msgLang, cardLevel, { slim: true });
          const banner = solanaBannerSource(cardLevel === 'red' ? 'red' : 'yellow');
          const editRes = await editCardMessage(msg, {
            hasPhoto: msg.hasPhoto,
            photoFileId: banner.photoFileId || null,
            photoLocalPath: banner.photoLocalPath || null,
            caption: card,
            fullText: card,
            chain: CHAIN_ID,
          });
          if (editRes.ok) msg.originalText = card;
        } else {
          const bannerText = formatRiskBanner({
            tokenSymbol: w.tokenSymbol,
            tokenName: w.tokenName,
            initialLiquidity: initial,
            lastLiquidity: current,
            buys5m,
          }, msgLang);
          await bot.sendMessage(msg.chatId, wrapEmojis(bannerText, CHAIN_ID), {
            parse_mode: 'HTML',
            reply_to_message_id: msg.messageId,
            disable_notification: ch?.settings?.silentNotification === true,
          }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (level === 'yellow') {
        storage.updateWatched(w.poolId, { warnedAt: Date.now(), lastWatchLevel: 'yellow' });
        storage.incStat('risksFlagged');
        console.log(`   ⚠️ RISK: $${w.tokenSymbol} liq $${initial.toFixed(0)} → $${current.toFixed(0)}`);
      } else if (level === 'red') {
        storage.updateWatched(w.poolId, { alerted: true, alertedAt: Date.now(), lastWatchLevel: 'red' });
        storage.incStat('scamsCaught');
        console.log(`   🚨 SCAM/RUG: $${w.tokenSymbol}`);
      }
    }
  }

  return { checkWatchedTokens };
}

module.exports = { createWatchRunner };
