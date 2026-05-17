// /settings inline-button panel. Per-channel admin tweaks the channel's settings.
// All UI text is i18n-aware (uses the channel's saved language).

const channels = require('./channels');
const { t, normalizeLang, langName, SUPPORTED } = require('./i18n');

// Helper: get effective lang for chat
// Caption modunda fotoğraf zaten sabit genişlik veriyor, dolguya gerek yok
const WIDTH_PAD = '';

/** Telegram Markdown caption için görsel ayraç (ASCII, güvenli) */
const PANEL_RULE = '────────────────────';

function curP(lang) {
  return t('settings.panel.current', lang);
}
function recP(lang) {
  return t('settings.recommended', lang);
}
function defBtn(lang) {
  return `↩️ ${t('settings.defaults', lang)}`;
}

function L(chatId) {
  return normalizeLang(channels.getSettings(chatId).lang);
}

/** Bu projede yalnızca Solana. */
function primaryChainFor(_chatId) {
  return 'solana';
}

// BSC: DexScreener dexId tabanı — channels.tokenPassesChannelFilters ile aynı (küçük harf)
const SOLANA_DEX_CHOICES = [
  { id: 'raydium', tr: 'Raydium', en: 'Raydium', ru: 'Raydium' },
  { id: 'orca', tr: 'Orca', en: 'Orca', ru: 'Orca' },
  { id: 'meteora', tr: 'Meteora', en: 'Meteora', ru: 'Meteora' },
  { id: 'pumpswap', tr: 'PumpSwap', en: 'PumpSwap', ru: 'PumpSwap' },
  { id: 'pumpfun', tr: 'Pump.fun', en: 'Pump.fun', ru: 'Pump.fun' },
];

function solDexButtonLabel(choice, lang) {
  return choice[lang] || choice.en;
}

// ─────────────────────────────────────────────────────────────
// Main settings menu
// ─────────────────────────────────────────────────────────────
function buildMainMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);

  const statusLabel = s.enabled ? t('settings.enabled', lang) : t('settings.disabled', lang);
  const dexFilter = s.allowedDexes.length === 0
    ? (lang === 'tr' ? 'tümü' : lang === 'ru' ? 'все' : 'all')
    : s.allowedDexes.join(', ');
  const silentLabel = s.silentNotification ? t('common.on', lang) : t('common.off', lang);
  const bannerLabel = s.bannerFileId
    ? (lang === 'tr' ? 'ayarlı' : lang === 'ru' ? 'установлен' : 'set')
    : (lang === 'tr' ? 'yok' : lang === 'ru' ? 'нет' : 'none');

  // ─ Chain (ağ) etiketi — seçilen tek ağ ya da 'seçilmedi' ─
  const chList = Array.isArray(s.chains) ? s.chains : [];
  const chainLabel = '◎ Solana';
  const chainSet = chList.includes('solana') || chList.length === 0;

  const riskCodeMap = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  const riskLabel = t(riskCodeMap[channels.normalizeRisk(s.maxRiskLevel)] || 'risk.high', lang);

  const watchDelayLabel = s.watchDelayMinutes > 0
    ? `${s.watchDelayMinutes}m`
    : (lang === 'tr' ? 'kapalı' : lang === 'ru' ? 'выкл' : 'off');
  const holdersLabel = s.minHolders > 0 ? `${s.minHolders}+` : '—';
  const auditLabel = s.minAuditScore > 0 ? `${s.minAuditScore}/100` : '—';

  // Özet satırlar (monospace blokta hizalı görünüm)
  const filterSummary = `💧 $${s.minLiquidityUsd} · 📊 ${s.minVolume24hUsd > 0 ? '$' + s.minVolume24hUsd : '—'} · ⏱ ${formatAgeRange(s.minAgeMinutes, s.maxAgeMinutes, lang)}`;
  const qualitySummary = `⚠️ ${riskLabel} · 🛡 ${auditLabel} · 👥 ${holdersLabel} · ⏳ ${watchDelayLabel}`;
  const channelSummary = `🏛 ${dexFilter} · 🔕 ${silentLabel}`;
  const displaySummary = `🖼 ${bannerLabel} · 🌐 ${langName(lang)}`;

  // Ağ seçimi yapılmadıysa en üstte uyarı
  const chainWarning = chainSet ? '' : `⚠️ ${t('settings.chain.required', lang)}\n\n`;

  const text =
    `${t('settings.title', lang)}
${t('settings.dashboard.subtitle', lang)}

${chainWarning}${PANEL_RULE}
${t('settings.main.networkRow', lang)}
🌐 *${langName(lang)}* · ${chainLabel}

${PANEL_RULE}
${t('settings.main.overview', lang)}
${s.enabled ? '🟢' : '🔴'} *${statusLabel}*

${PANEL_RULE}
*${t('settings.groupFilters', lang)}*
\`${filterSummary}\`

*${t('settings.groupQuality', lang)}*
\`${qualitySummary}\`

*${t('settings.groupChannel', lang)}*
\`${channelSummary}\`

*${t('settings.groupDisplay', lang)}*
\`${displaySummary}\``;

  const resetLbl = t('settings.main.reset', lang);
  const manualLbl = t('settings.main.manualPost', lang);
  const profileLbl = t('settings.profile.title', lang);
  const showFiltersLbl = t('settings.view.activeTitle', lang);

  // Ağ butonu etiketi: seçilmediyse uyarı ikonu, seçildiyse ağ rozeti
  const chainBtnLbl = chainSet
    ? `${t('settings.chain', lang)}: ${chainLabel}`
    : `⚠️ ${t('settings.chain', lang)}: ${chainLabel}`;
  const langBtnLbl = `${t('settings.language', lang)}: ${langName(lang)}`;

  const keyboard = [
    // EN ÜSTTE: Dil | Ağ yan yana — bot setup başlangıcı
    [
      { text: langBtnLbl, callback_data: 'menu:lang' },
      { text: chainBtnLbl, callback_data: 'menu:chain' },
    ],
    [
      { text: s.enabled ? `⏸ ${statusLabel}` : `▶️ ${statusLabel}`, callback_data: 'tgl:enabled' },
    ],
    [
      { text: profileLbl, callback_data: 'menu:profile' },
      { text: showFiltersLbl, callback_data: 'menu:showFilters' },
    ],
    [
      { text: t('settings.groupFilters', lang), callback_data: 'menu:catFilters' },
      { text: t('settings.groupQuality', lang), callback_data: 'menu:catQuality' },
    ],
    [
      { text: t('settings.groupChannel', lang), callback_data: 'menu:catChannel' },
      { text: t('settings.groupDisplay', lang), callback_data: 'menu:catDisplay' },
    ],
    [
      { text: t('settings.intelButton', lang), callback_data: 'menu:intel' },
    ],
    [
      { text: manualLbl, callback_data: 'manual:start' },
    ],
    [
      { text: `🔄 ${resetLbl}`, callback_data: 'reset' },
      { text: `✖ ${t('settings.close', lang)}`, callback_data: 'close' },
    ],
  ];

  return { text, keyboard };
}

// ─── Kategori alt-panelleri (her birinde kısa açıklama + mevcut değerler) ───
function buildIntelMenu(chatId) {
  const lang = L(chatId);
  return {
    text: `${PANEL_RULE}\n${t('settings.intel.title', lang)}\n\n${t('settings.intel.body', lang)}`,
    keyboard: [
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

function buildCatFilters(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const desc = lang === 'tr'
    ? '_Kanalında paylaşılacak token’lar için minimum gereksinimleri ayarla._'
    : lang === 'ru'
      ? '_Минимальные требования, которым должен соответствовать токен для публикации._'
      : '_Set minimum requirements every token must meet to be shared._';
  const hints = lang === 'tr'
    ? [
        '💧 *Min Likidite* — ince havuzları (rug riski) ele',
        '📊 *Min Hacim 24s* — ölü tokenleri ele',
        '⏱ *Min/Max Yaş* — token yaş aralığı',
      ]
    : lang === 'ru'
      ? [
          '💧 *Мин. ликвидность* — отфильтровать тонкие пулы',
          '📊 *Мин. объём 24ч* — отфильтровать мёртвые токены',
          '⏱ *Мин/Макс возраст* — диапазон возраста токена',
        ]
      : [
          '💧 *Min Liquidity* — skip thin pools (rug risk)',
          '📊 *Min Volume 24h* — skip dead tokens',
          '⏱ *Min/Max Age* — token age range',
        ];
  const text =
    `${PANEL_RULE}\n` +
    `*${t('settings.groupFilters', lang)}*\n\n` +
    `${desc}\n\n` +
    hints.join('\n') + '\n\n' +
    `${PANEL_RULE}\n` +
    `*${curP(lang)}*\n` +
    `💧 ${t('settings.minLiquidity', lang)}: *$${s.minLiquidityUsd}*\n` +
    `📊 ${t('settings.minVolume', lang)}: *${s.minVolume24hUsd > 0 ? '$' + s.minVolume24hUsd : '—'}*\n` +
    `⏱ ${t('settings.minAge', lang)}: *${formatAgeRange(s.minAgeMinutes, s.maxAgeMinutes, lang)}*`;
  return {
    text,
    keyboard: [
      [{ text: `💧 ${t('settings.minLiquidity', lang)}`, callback_data: 'menu:liq' }],
      [{ text: `📊 ${t('settings.minVolume', lang)}`, callback_data: 'menu:vol' }],
      [{ text: `⏱ ${t('settings.minAge', lang)}`, callback_data: 'menu:age' }],
      [{ text: `💰 ${lang === 'tr' ? 'Market Cap' : lang === 'ru' ? 'Капитализация' : 'Market Cap'}`, callback_data: 'menu:mcap' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

function buildCatQuality(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const riskCodeMap = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  const riskLabel = t(riskCodeMap[channels.normalizeRisk(s.maxRiskLevel)] || 'risk.high', lang);
  const watchDelayLabel = s.watchDelayMinutes > 0
    ? `${s.watchDelayMinutes}m`
    : (lang === 'tr' ? 'kapalı' : lang === 'ru' ? 'выкл' : 'off');
  const holdersLabel = s.minHolders > 0 ? `${s.minHolders}+` : '—';
  const auditLabel = s.minAuditScore > 0 ? `${s.minAuditScore}/100` : '—';
  const desc = lang === 'tr'
    ? '_Yüksek = daha sıkı filtre. Düşük = daha çok token ama daha çok gürültü._'
    : lang === 'ru'
      ? '_Выше = строже фильтр. Ниже = больше токенов, но больше шума._'
      : '_Higher = stricter filter. Lower = more tokens but more noise._';
  const hints = lang === 'tr'
    ? [
        '⚠️ *Max Risk* — bu seviyenin üzeri paylaşılmaz',
        '🛡 *Min Audit Skoru* — on-chain güvenlik puanı (0–100)',
        '👥 *Min Holders* — az holderlı token’ı atla',
        '⏳ *İzleme Gecikmesi* — paylaşmadan önce sessiz izleme',
      ]
    : lang === 'ru'
      ? [
          '⚠️ *Макс. риск* — токены выше не публикуются',
          '🛡 *Мин. аудит* — оценка безопасности (0–100)',
          '👥 *Мин. холдеры* — пропустить с малым числом холдеров',
          '⏳ *Задержка наблюдения* — тихое наблюдение перед постом',
        ]
      : [
          '⚠️ *Max Risk* — skip tokens above this tier',
          '🛡 *Min Audit Score* — on-chain safety score (0–100)',
          '👥 *Min Holders* — skip tokens with too few holders',
          '⏳ *Watch Delay* — silent observation before posting',
        ];
  const text =
    `${PANEL_RULE}\n` +
    `*${t('settings.groupQuality', lang)}*\n\n` +
    `${desc}\n\n` +
    hints.join('\n') + '\n\n' +
    `${PANEL_RULE}\n` +
    `*${curP(lang)}*\n` +
    `⚠️ ${t('settings.maxRisk', lang)}: *${riskLabel}*\n` +
    `🛡 ${t('settings.minAuditScore', lang)}: *${auditLabel}*\n` +
    `👥 ${t('settings.minHolders', lang)}: *${holdersLabel}*\n` +
    `⏳ ${t('settings.watchDelay', lang)}: *${watchDelayLabel}*`;
  const lpLbl = lang === 'tr' ? 'LP Kilitli Zorunlu' : lang === 'ru' ? 'LP заблокирован' : 'Require LP Locked';
  const lpStatus = s.requireLpLocked ? t('common.on', lang) : t('common.off', lang);
  return {
    text,
    keyboard: [
      [{ text: `⚠️ ${t('settings.maxRisk', lang)}`, callback_data: 'menu:risk' }],
      [{ text: `🛡 ${t('settings.minAuditScore', lang)}`, callback_data: 'menu:audit' }],
      [{ text: `👥 ${t('settings.minHolders', lang)}`, callback_data: 'menu:holders' }],
      [{ text: `⏳ ${t('settings.watchDelay', lang)}`, callback_data: 'menu:watch' }],
      [{ text: `🔒 ${lpLbl}: ${lpStatus}`, callback_data: 'tgl:lpLocked' }],
      [{ text: `🕵️ ${lang === 'tr' ? 'Sybil Filtresi' : lang === 'ru' ? 'Sybil-фильтр' : 'Sybil Filter'}`, callback_data: 'menu:sybil' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

function buildCatChannel(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const chain = primaryChainFor(chatId);
  const dexFilter = s.allowedDexes.length === 0
    ? (lang === 'tr' ? 'tümü' : lang === 'ru' ? 'все' : 'all')
    : s.allowedDexes.join(', ');
  const silentLabel = s.silentNotification ? t('common.on', lang) : t('common.off', lang);
  const desc = lang === 'tr'
    ? '_Token’ların nereden ve nasıl paylaşılacağını ayarla._'
    : lang === 'ru'
      ? '_Откуда и как публикуются токены._'
      : '_Where & how tokens are shared._';
  const dexHintTon = lang === 'tr'
    ? '🏛 *İzinli DEX’ler* — TON: DeDust, STON.fi'
    : lang === 'ru'
      ? '🏛 *Разрешённые DEX* — TON: DeDust, STON.fi'
      : '🏛 *Allowed DEXes* — TON: DeDust, STON.fi';
  const dexHintBsc = lang === 'tr'
    ? '🏛 *İzinli DEX’ler* — BSC: PancakeSwap, BiSwap, … (DexScreener)'
    : lang === 'ru'
      ? '🏛 *Разрешённые DEX* — BSC: PancakeSwap, BiSwap, … (DexScreener)'
      : '🏛 *Allowed DEXes* — BSC: PancakeSwap, BiSwap, … (DexScreener)';
  const hints = lang === 'tr'
    ? [
        dexHintBsc,
        '🔕 *Sessiz Bildirim* — sessiz post (titreşim/ses yok)',
      ]
    : lang === 'ru'
      ? [
          dexHintBsc,
          '🔕 *Тихое уведомление* — без звука/вибрации',
        ]
      : [
          dexHintBsc,
          '🔕 *Silent Notification* — post without sound',
        ];
  const text =
    `${PANEL_RULE}\n` +
    `*${t('settings.groupChannel', lang)}*\n\n` +
    `${desc}\n\n` +
    hints.join('\n') + '\n\n' +
    `${PANEL_RULE}\n` +
    `*${curP(lang)}*\n` +
    `🏛 DEX: *${dexFilter}*\n` +
    `🔕 ${t('settings.silent', lang)}: *${silentLabel}*`;
  const userbotStatus2 = s.userbotEnabled ? t('common.on', lang) : t('common.off', lang);
  const userbotLbl = lang === 'tr' ? 'Premium Userbot' : lang === 'ru' ? 'Premium юзербот' : 'Premium Userbot';
  const hoursLbl = lang === 'tr' ? 'Aktif Saatler' : lang === 'ru' ? 'Активные часы' : 'Active Hours';
  const hoursStatus = s.activeHoursEnabled
    ? `${s.activeHoursStart}:00–${s.activeHoursEnd}:00`
    : (lang === 'tr' ? '7/24' : lang === 'ru' ? '24/7' : '24/7');
  return {
    text,
    keyboard: [
      [{ text: '🏛 DEX', callback_data: 'menu:dex' }],
      [{ text: `🔕 ${t('settings.silent', lang)}: ${silentLabel}`, callback_data: 'tgl:silent' }],
      [{ text: `🤖 ${userbotLbl}: ${userbotStatus2}`, callback_data: 'tgl:userbot' }],
      [{ text: `⏰ ${hoursLbl}: ${hoursStatus}`, callback_data: 'menu:hours' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

function buildCatDisplay(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const bannerLabel = s.bannerFileId
    ? (lang === 'tr' ? 'ayarlı' : lang === 'ru' ? 'установлен' : 'set')
    : (lang === 'tr' ? 'yok' : lang === 'ru' ? 'нет' : 'none');
  const desc = lang === 'tr'
    ? '_Kanal post’ları için görsel ve dil tercihleri._'
    : lang === 'ru'
      ? '_Визуальные и языковые предпочтения для постов._'
      : '_Visual & language preferences for posts._';
  const hints = lang === 'tr'
    ? [
        '🖼 *Özel Banner* — kendi başlık görselini yükle',
        '🌐 *Dil* — kanal post’larının dili',
      ]
    : lang === 'ru'
      ? [
          '🖼 *Свой баннер* — загрузи свою картинку',
          '🌐 *Язык* — язык постов в канале',
        ]
      : [
          '🖼 *Custom Banner* — upload your own header image',
          '🌐 *Language* — channel post language',
        ];
  const text =
    `${PANEL_RULE}\n` +
    `*${t('settings.groupDisplay', lang)}*\n\n` +
    `${desc}\n\n` +
    hints.join('\n') + '\n\n' +
    `${PANEL_RULE}\n` +
    `*${curP(lang)}*\n` +
    `🖼 Banner: *${bannerLabel}*\n` +
    `🌐 ${t('settings.language', lang)}: *${langName(lang)}*`;
  return {
    text,
    keyboard: [
      [{ text: t('settings.banner.title', lang), callback_data: 'menu:banner' }],
      [{ text: `🌐 ${t('settings.language', lang)}`, callback_data: 'menu:lang' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Liquidity submenu
// ─────────────────────────────────────────────────────────────
function buildLiqMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const mark = (n) => s.minLiquidityUsd === n ? '✅ ' : '';
  return {
    text:
      `${PANEL_RULE}\n` +
      `💧 *${t('settings.minLiquidity', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`$${s.minLiquidityUsd}\`\n\n` +
      `${t('settings.submenu.liqHint', lang)}`,
    keyboard: [
      [{ text: `${mark(1500)}$1,500 ⭐ ${recP(lang)}`, callback_data: 'set:minLiquidityUsd:1500' }],
      [{ text: `${mark(2000)}$2,000`, callback_data: 'set:minLiquidityUsd:2000' }, { text: `${mark(2500)}$2,500`, callback_data: 'set:minLiquidityUsd:2500' }],
      [{ text: `${mark(3000)}$3,000`, callback_data: 'set:minLiquidityUsd:3000' }, { text: `${mark(4500)}$4,500`, callback_data: 'set:minLiquidityUsd:4500' }],
      [{ text: `${mark(5000)}$5,000`, callback_data: 'set:minLiquidityUsd:5000' }],
      [{ text: defBtn(lang), callback_data: 'rst:liq' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catFilters' }],
    ],
  };
}

function buildVolMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const mark = (n) => s.minVolume24hUsd === n ? '✅ ' : '';
  const curVol = s.minVolume24hUsd > 0 ? '$' + s.minVolume24hUsd : '—';
  return {
    text:
      `${PANEL_RULE}\n` +
      `📊 *${t('settings.minVolume', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${curVol}\`\n\n` +
      `${t('settings.submenu.volHint', lang)}`,
    keyboard: [
      [{ text: `${mark(0)}—`, callback_data: 'set:minVolume24hUsd:0' }, { text: `${mark(100)}$100`, callback_data: 'set:minVolume24hUsd:100' }, { text: `${mark(250)}$250`, callback_data: 'set:minVolume24hUsd:250' }],
      [{ text: `${mark(500)}$500 ⭐ ${recP(lang)}`, callback_data: 'set:minVolume24hUsd:500' }],
      [{ text: `${mark(1000)}$1,000`, callback_data: 'set:minVolume24hUsd:1000' }, { text: `${mark(2000)}$2,000`, callback_data: 'set:minVolume24hUsd:2000' }],
      [{ text: `${mark(5000)}$5,000`, callback_data: 'set:minVolume24hUsd:5000' }, { text: `${mark(10000)}$10,000`, callback_data: 'set:minVolume24hUsd:10000' }, { text: `${mark(25000)}$25,000`, callback_data: 'set:minVolume24hUsd:25000' }],
      [{ text: defBtn(lang), callback_data: 'rst:vol' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catFilters' }],
    ],
  };
}

function buildAgeMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const minLbl = t('settings.age.minSection', lang);
  const maxLbl = t('settings.age.maxSection', lang);
  const markMin = (n) => s.minAgeMinutes === n ? '✅ ' : '';
  const markMax = (n) => s.maxAgeMinutes === n ? '✅ ' : '';
  return {
    text:
      `${PANEL_RULE}\n` +
      `⏱ *${t('settings.minAge', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${formatAgeRange(s.minAgeMinutes, s.maxAgeMinutes, lang)}\`\n\n` +
      `${t('settings.submenu.ageHint', lang)}`,
    keyboard: [
      [{ text: `— ${minLbl} —`, callback_data: 'noop' }],
      [{ text: `${markMin(0)}—`, callback_data: 'set:minAgeMinutes:0' }, { text: `${markMin(1)}1m`, callback_data: 'set:minAgeMinutes:1' }, { text: `${markMin(2)}2m`, callback_data: 'set:minAgeMinutes:2' }],
      [{ text: `${markMin(3)}3m ⭐ ${recP(lang)}`, callback_data: 'set:minAgeMinutes:3' }],
      [{ text: `${markMin(5)}5m`, callback_data: 'set:minAgeMinutes:5' }, { text: `${markMin(10)}10m`, callback_data: 'set:minAgeMinutes:10' }, { text: `${markMin(15)}15m`, callback_data: 'set:minAgeMinutes:15' }],
      [{ text: `${markMin(30)}30m`, callback_data: 'set:minAgeMinutes:30' }, { text: `${markMin(60)}1h`, callback_data: 'set:minAgeMinutes:60' }],
      [{ text: `— ${maxLbl} —`, callback_data: 'noop' }],
      [{ text: `${markMax(0)}—`, callback_data: 'set:maxAgeMinutes:0' }, { text: `${markMax(30)}30m`, callback_data: 'set:maxAgeMinutes:30' }, { text: `${markMax(60)}1h`, callback_data: 'set:maxAgeMinutes:60' }],
      [{ text: `${markMax(180)}3h ⭐ ${recP(lang)}`, callback_data: 'set:maxAgeMinutes:180' }],
      [{ text: `${markMax(360)}6h`, callback_data: 'set:maxAgeMinutes:360' }, { text: `${markMax(720)}12h`, callback_data: 'set:maxAgeMinutes:720' }],
      [{ text: `${markMax(1440)}24h`, callback_data: 'set:maxAgeMinutes:1440' }, { text: `${markMax(10080)}7d`, callback_data: 'set:maxAgeMinutes:10080' }],
      [{ text: defBtn(lang), callback_data: 'rst:age' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catFilters' }],
    ],
  };
}

function buildRiskMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = channels.normalizeRisk(s.maxRiskLevel);
  const mark = (code) => cur === code ? '✅ ' : '';
  const riskCodeMap = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  const curLabel = t(riskCodeMap[cur] || 'risk.high', lang);
  return {
    text:
      `${PANEL_RULE}\n` +
      `⚠️ *${t('settings.maxRisk', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${curLabel}\`\n\n` +
      `${t('settings.submenu.riskHint', lang)}\n\n` +
      `🟢 ${t('risk.veryLow', lang)}\n` +
      `🟢 ${t('risk.low', lang)}\n` +
      `🟡 ${t('risk.medium', lang)}\n` +
      `🔴 ${t('risk.high', lang)}`,
    keyboard: [
      [{ text: `${mark('VERY_LOW')}🟢 ${t('risk.veryLow', lang)}`, callback_data: 'set:maxRiskLevel:VERY_LOW' }],
      [{ text: `${mark('LOW')}🟢 ${t('risk.low', lang)}`, callback_data: 'set:maxRiskLevel:LOW' }],
      [{ text: `${mark('MEDIUM')}🟡 ${t('risk.medium', lang)} ⭐ ${recP(lang)}`, callback_data: 'set:maxRiskLevel:MEDIUM' }],
      [{ text: `${mark('HIGH')}🔴 ${t('risk.high', lang)}`, callback_data: 'set:maxRiskLevel:HIGH' }],
      [{ text: defBtn(lang), callback_data: 'rst:risk' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catQuality' }],
    ],
  };
}

function buildHoldersMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = s.minHolders > 0 ? `${s.minHolders}+` : '—';
  const mark = (n) => s.minHolders === n ? '✅ ' : '';
  return {
    text:
      `${PANEL_RULE}\n` +
      `👥 *${t('settings.minHolders', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${cur}\`\n\n` +
      `${t('settings.submenu.holdersHint', lang)}`,
    keyboard: [
      [{ text: `${mark(0)}—`, callback_data: 'set:minHolders:0' }],
      [{ text: `${mark(5)}5+ ⭐ ${recP(lang)}`, callback_data: 'set:minHolders:5' }],
      [{ text: `${mark(10)}10+`, callback_data: 'set:minHolders:10' }, { text: `${mark(15)}15+`, callback_data: 'set:minHolders:15' }, { text: `${mark(25)}25+`, callback_data: 'set:minHolders:25' }],
      [{ text: `${mark(50)}50+`, callback_data: 'set:minHolders:50' }, { text: `${mark(100)}100+`, callback_data: 'set:minHolders:100' }, { text: `${mark(250)}250+`, callback_data: 'set:minHolders:250' }],
      [{ text: `${mark(500)}500+`, callback_data: 'set:minHolders:500' }, { text: `${mark(1000)}1000+`, callback_data: 'set:minHolders:1000' }],
      [{ text: defBtn(lang), callback_data: 'rst:holders' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catQuality' }],
    ],
  };
}

function buildAuditMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = s.minAuditScore > 0 ? `${s.minAuditScore}/100` : '—';
  const mark = (n) => s.minAuditScore === n ? '✅ ' : '';
  return {
    text:
      `${PANEL_RULE}\n` +
      `🛡 *${t('settings.minAuditScore', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${cur}\`\n\n` +
      `${t('settings.submenu.auditHint', lang)}`,
    keyboard: [
      [{ text: `${mark(0)}—`, callback_data: 'set:minAuditScore:0' }, { text: `${mark(20)}20`, callback_data: 'set:minAuditScore:20' }, { text: `${mark(30)}30`, callback_data: 'set:minAuditScore:30' }],
      [{ text: `${mark(40)}40 ⭐ ${recP(lang)}`, callback_data: 'set:minAuditScore:40' }],
      [{ text: `${mark(50)}50`, callback_data: 'set:minAuditScore:50' }, { text: `${mark(60)}60`, callback_data: 'set:minAuditScore:60' }],
      [{ text: `${mark(70)}70`, callback_data: 'set:minAuditScore:70' }, { text: `${mark(80)}80`, callback_data: 'set:minAuditScore:80' }, { text: `${mark(90)}90`, callback_data: 'set:minAuditScore:90' }],
      [{ text: defBtn(lang), callback_data: 'rst:audit' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catQuality' }],
    ],
  };
}

function buildWatchMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = s.watchDelayMinutes > 0
    ? `${s.watchDelayMinutes}m`
    : t('settings.state.off', lang);
  const offLbl = t('settings.state.off', lang);
  const mark = (n) => s.watchDelayMinutes === n ? '✅ ' : '';
  return {
    text:
      `${PANEL_RULE}\n` +
      `⏳ *${t('settings.watchDelay', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${cur}\`\n\n` +
      `${t('settings.watchDelayHint', lang)}`,
    keyboard: [
      [{ text: `${mark(0)}${offLbl}`, callback_data: 'set:watchDelayMinutes:0' }],
      [
        { text: `${mark(2)}2m ⭐ ${recP(lang)}`, callback_data: 'set:watchDelayMinutes:2' },
      ],
      [
        { text: `${mark(5)}5m`, callback_data: 'set:watchDelayMinutes:5' },
        { text: `${mark(10)}10m`, callback_data: 'set:watchDelayMinutes:10' },
      ],
      [
        { text: `${mark(15)}15m`, callback_data: 'set:watchDelayMinutes:15' },
        { text: `${mark(30)}30m`, callback_data: 'set:watchDelayMinutes:30' },
        { text: `${mark(45)}45m`, callback_data: 'set:watchDelayMinutes:45' },
      ],
      [
        { text: `${mark(60)}60m`, callback_data: 'set:watchDelayMinutes:60' },
        { text: `${mark(90)}90m`, callback_data: 'set:watchDelayMinutes:90' },
      ],
      [{ text: defBtn(lang), callback_data: 'rst:watch' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catQuality' }],
    ],
  };
}

function buildBannerMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const has = Boolean(s.bannerFileId);
  return {
    text:
      `${PANEL_RULE}\n` +
      `${t('settings.banner.title', lang)}\n\n` +
      `${t('settings.banner.specs', lang)}`,
    keyboard: [
      [{ text: t('settings.banner.uploadBtn', lang), callback_data: 'banner:upload' }],
      ...(has ? [
        [{ text: t('settings.banner.previewBtn', lang), callback_data: 'banner:preview' }],
        [{ text: t('settings.banner.removeBtn', lang), callback_data: 'banner:remove' }],
      ] : []),
      [{ text: t('settings.back', lang), callback_data: 'menu:catDisplay' }],
    ],
  };
}

function buildDexMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const allowed = s.allowedDexes || [];
  const isAll = allowed.length === 0;
  const has = (d) => allowed.includes(d);
  const chain = primaryChainFor(chatId);

  const keyboard = [
    [{ text: `${isAll ? '✅' : ''} ${t('settings.dex.all', lang)}`, callback_data: 'dex:all' }],
  ];

  let sub = '';
  sub = lang === 'tr' ? 'Raydium, Orca, Meteora, Pump…' : 'Raydium, Orca, Meteora, Pump…';
  for (let i = 0; i < SOLANA_DEX_CHOICES.length; i += 2) {
    const left = SOLANA_DEX_CHOICES[i];
    const right = SOLANA_DEX_CHOICES[i + 1];
    const row = [
      { text: `${has(left.id) ? '✅' : '⬜'} ${solDexButtonLabel(left, lang)}`, callback_data: `dex:${left.id}` },
    ];
    if (right) {
      row.push({
        text: `${has(right.id) ? '✅' : '⬜'} ${solDexButtonLabel(right, lang)}`,
        callback_data: `dex:${right.id}`,
      });
    }
    keyboard.push(row);
  }

  keyboard.push([{ text: t('settings.back', lang), callback_data: 'menu:catChannel' }]);

  const tag = 'Solana';

  return {
    text:
      `${PANEL_RULE}\n` +
      `*${t('settings.dex.title', lang)}* (${tag})\n\n` +
      `${sub}`,
    keyboard,
  };
}

// ─── Market Cap menu ───
function buildMcapMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const minLbl = t('settings.mcap.minSection', lang);
  const maxLbl = t('settings.mcap.maxSection', lang);
  const markMin = (n) => s.minMarketCapUsd === n ? '✅ ' : '';
  const markMax = (n) => s.maxMarketCapUsd === n ? '✅ ' : '';
  const curMin = s.minMarketCapUsd > 0 ? `$${s.minMarketCapUsd}` : '—';
  const curMax = s.maxMarketCapUsd > 0 ? `$${s.maxMarketCapUsd}` : '—';
  return {
    text:
      `${PANEL_RULE}\n` +
      `💰 *${t('settings.marketCap', lang)}*\n\n` +
      `*${curP(lang)}*\n` +
      `\`${minLbl}: ${curMin} · ${maxLbl}: ${curMax}\``,
    keyboard: [
      [{ text: `— ${minLbl} —`, callback_data: 'noop' }],
      [{ text: `${markMin(0)}—`, callback_data: 'set:minMarketCapUsd:0' }, { text: `${markMin(5000)}$5K`, callback_data: 'set:minMarketCapUsd:5000' }, { text: `${markMin(10000)}$10K ⭐ ${recP(lang)}`, callback_data: 'set:minMarketCapUsd:10000' }],
      [{ text: `${markMin(25000)}$25K`, callback_data: 'set:minMarketCapUsd:25000' }, { text: `${markMin(50000)}$50K`, callback_data: 'set:minMarketCapUsd:50000' }, { text: `${markMin(100000)}$100K`, callback_data: 'set:minMarketCapUsd:100000' }],
      [{ text: `— ${maxLbl} —`, callback_data: 'noop' }],
      [{ text: `${markMax(0)}—`, callback_data: 'set:maxMarketCapUsd:0' }, { text: `${markMax(1000000)}$1M`, callback_data: 'set:maxMarketCapUsd:1000000' }, { text: `${markMax(5000000)}$5M ⭐ ${recP(lang)}`, callback_data: 'set:maxMarketCapUsd:5000000' }],
      [{ text: `${markMax(10000000)}$10M`, callback_data: 'set:maxMarketCapUsd:10000000' }, { text: `${markMax(50000000)}$50M`, callback_data: 'set:maxMarketCapUsd:50000000' }],
      [{ text: defBtn(lang), callback_data: 'rst:mcap' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catFilters' }],
    ],
  };
}

// ─── Aktif Saatler menu ───
function buildHoursMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const enabled = s.activeHoursEnabled;
  const onLbl = t('settings.state.on', lang);
  const offLbl = t('settings.state.off247', lang);
  const tzInfo = s.lang === 'tr' ? t('settings.hours.tzTr', lang) : t('settings.hours.tzUtc', lang);
  const startLbl = t('settings.hours.start', lang);
  const endLbl = t('settings.hours.end', lang);
  const markS = (n) => s.activeHoursStart === n ? '✅ ' : '';
  const markE = (n) => s.activeHoursEnd === n ? '✅ ' : '';
  const cur = enabled ? `${s.activeHoursStart}:00–${s.activeHoursEnd}:00 (${tzInfo})` : offLbl;
  return {
    text:
      `${PANEL_RULE}\n` +
      `${t('settings.hours.title', lang)}\n\n` +
      `*${curP(lang)}*\n` +
      `\`${cur}\`\n\n` +
      `${t('settings.hours.hint', lang)}`,
    keyboard: [
      [{ text: `${enabled ? '✅' : '⚪'} ${onLbl}`, callback_data: 'tgl:hours' }],
      [{ text: `— ${startLbl} —`, callback_data: 'noop' }],
      [{ text: `${markS(6)}06`, callback_data: 'set:activeHoursStart:6' }, { text: `${markS(8)}08`, callback_data: 'set:activeHoursStart:8' }, { text: `${markS(10)}10 ⭐`, callback_data: 'set:activeHoursStart:10' }, { text: `${markS(12)}12`, callback_data: 'set:activeHoursStart:12' }],
      [{ text: `— ${endLbl} —`, callback_data: 'noop' }],
      [{ text: `${markE(20)}20`, callback_data: 'set:activeHoursEnd:20' }, { text: `${markE(22)}22`, callback_data: 'set:activeHoursEnd:22' }, { text: `${markE(23)}23 ⭐`, callback_data: 'set:activeHoursEnd:23' }, { text: `${markE(2)}02`, callback_data: 'set:activeHoursEnd:2' }],
      [{ text: defBtn(lang), callback_data: 'rst:hours' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catChannel' }],
    ],
  };
}

// ─── Hızlı Profil menu ───
function buildProfileMenu(chatId) {
  const lang = L(chatId);
  return {
    text:
      `${PANEL_RULE}\n` +
      `*${t('settings.profile.title', lang)}*\n\n` +
      `${t('settings.profile.desc', lang)}\n\n` +
      `*${t('settings.profile.conservative', lang)}*\n` +
      `${t('settings.profile.detail.conservative', lang)}\n\n` +
      `*${t('settings.profile.balanced', lang)}*\n` +
      `${t('settings.profile.detail.balanced', lang)}\n\n` +
      `*${t('settings.profile.aggressive', lang)}*\n` +
      `${t('settings.profile.detail.aggressive', lang)}`,
    keyboard: [
      [{ text: t('settings.profile.conservative', lang), callback_data: 'profile:conservative' }],
      [{ text: t('settings.profile.balanced', lang), callback_data: 'profile:balanced' }],
      [{ text: t('settings.profile.aggressive', lang), callback_data: 'profile:aggressive' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

// ─── Aktif Filtreler görünümü ───
function buildShowFiltersMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const riskCodeMap = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  const riskLabel = t(riskCodeMap[channels.normalizeRisk(s.maxRiskLevel)] || 'risk.high', lang);
  const fmtOnOff = (v) => v ? t('common.on', lang) : t('common.off', lang);
  const fmtUsd = (n) => n > 0 ? `$${n}` : '—';
  const fmtH = (n) => n > 0 ? `${n}+` : '—';
  const fmtScore = (n) => n > 0 ? `${n}/100` : '—';
  const minAgeUnit = t('settings.view.ageUnitMinutes', lang);
  const fmtMin = (n) => n > 0 ? `${n}${minAgeUnit}` : '—';
  const hours = s.activeHoursEnabled ? `${s.activeHoursStart}:00–${s.activeHoursEnd}:00` : t('settings.view.h247', lang);
  const L_TITLE = t('settings.view.activeTitle', lang);
  const L_STATUS = t('settings.view.status', lang);
  const L_FILTERS = t('settings.view.group.filters', lang);
  const L_QUALITY = t('settings.view.group.quality', lang);
  const L_CHANNEL = t('settings.view.group.channel', lang);
  const L_LIQ = t('settings.minLiquidity', lang);
  const L_VOL = t('settings.minVolume', lang);
  const L_AGE = t('settings.minAge', lang);
  const L_MCAP = t('settings.marketCap', lang);
  const L_MAX_RISK = t('settings.maxRisk', lang);
  const L_AUDIT = t('settings.minAuditScore', lang);
  const L_HOLDERS = t('settings.minHolders', lang);
  const L_WATCH = t('settings.watchDelay', lang);
  const L_LP = t('settings.view.requireLpShort', lang);
  const L_SYBIL = t('settings.view.sybil', lang);
  const L_DEX = t('settings.view.dexLabel', lang);
  const L_SILENT = t('settings.view.silentShort', lang);
  const L_USERBOT = t('settings.view.userbot', lang);
  const L_HOURS = t('settings.view.hoursShort', lang);
  const dexLabel = s.allowedDexes.length === 0 ? t('settings.view.allDex', lang) : s.allowedDexes.join(', ');
  const sybilLabel = (Number(s.maxSybilRatio) || 0) > 0
    ? `${(s.maxSybilRatio * 100).toFixed(0)}%`
    : t('common.off', lang);
  return {
    text:
      `${PANEL_RULE}\n` +
      `*${L_TITLE}*\n\n` +
      `🟢 *${L_STATUS}:* ${fmtOnOff(s.enabled)}\n\n` +
      `🎯 *${L_FILTERS}*\n` +
      `  💧 ${L_LIQ}: *${fmtUsd(s.minLiquidityUsd)}*\n` +
      `  📊 ${L_VOL}: *${fmtUsd(s.minVolume24hUsd)}*\n` +
      `  ⏱ ${L_AGE}: *${formatAgeRange(s.minAgeMinutes, s.maxAgeMinutes, lang)}*\n` +
      `  💰 ${L_MCAP}: *${fmtUsd(s.minMarketCapUsd)} – ${fmtUsd(s.maxMarketCapUsd)}*\n\n` +
      `🛡 *${L_QUALITY}*\n` +
      `  ⚠️ ${L_MAX_RISK}: *${riskLabel}*\n` +
      `  🛡 ${L_AUDIT}: *${fmtScore(s.minAuditScore)}*\n` +
      `  👥 ${L_HOLDERS}: *${fmtH(s.minHolders)}*\n` +
      `  ⏳ ${L_WATCH}: *${fmtMin(s.watchDelayMinutes)}*\n` +
      `  🔒 ${L_LP}: *${fmtOnOff(s.requireLpLocked)}*\n` +
      `  🕵️ ${L_SYBIL}: *${sybilLabel}*\n\n` +
      `📡 *${L_CHANNEL}*\n` +
      `  🏛 ${L_DEX}: *${dexLabel}*\n` +
      `  🔕 ${L_SILENT}: *${fmtOnOff(s.silentNotification)}*\n` +
      `  🤖 ${L_USERBOT}: *${fmtOnOff(s.userbotEnabled)}*\n` +
      `  ⏰ ${L_HOURS}: *${hours}*`,
    keyboard: [
      // Filters grubu
      [
        { text: `💧 ${L_LIQ}`, callback_data: 'menu:liq' },
        { text: `📊 ${L_VOL}`, callback_data: 'menu:vol' },
      ],
      [
        { text: `⏱ ${L_AGE}`, callback_data: 'menu:age' },
        { text: `💰 ${L_MCAP}`, callback_data: 'menu:mcap' },
      ],
      // Quality grubu
      [
        { text: `⚠️ ${L_MAX_RISK}`, callback_data: 'menu:risk' },
        { text: `🛡 ${L_AUDIT}`, callback_data: 'menu:audit' },
      ],
      [
        { text: `👥 ${L_HOLDERS}`, callback_data: 'menu:holders' },
        { text: `⏳ ${L_WATCH}`, callback_data: 'menu:watch' },
      ],
      [
        { text: `🔒 ${L_LP}: ${fmtOnOff(s.requireLpLocked)}`, callback_data: 'tgf:lpLocked' },
      ],
      [
        { text: `🕵️ ${L_SYBIL}: ${sybilLabel}`, callback_data: 'menu:sybil' },
      ],
      // Channel grubu
      [
        { text: `🏛 ${L_DEX}`, callback_data: 'menu:dex' },
        { text: `⏰ ${L_HOURS}`, callback_data: 'menu:hours' },
      ],
      [
        { text: `🔕 ${L_SILENT}: ${fmtOnOff(s.silentNotification)}`, callback_data: 'tgf:silent' },
        { text: `🤖 ${L_USERBOT}: ${fmtOnOff(s.userbotEnabled)}`, callback_data: 'tgf:userbot' },
      ],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

// ─── Sybil filter menu ───
function buildSybilMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = Number(s.maxSybilRatio) || 0;
  const mark = (v) => Math.abs(cur - v) < 0.001 ? '✅ ' : '';
  const offLbl = t('settings.state.off', lang);
  const curStr = cur > 0 ? `${(cur * 100).toFixed(0)}%` : offLbl;
  const text =
    `${PANEL_RULE}\n` +
    `🕵️ *${t('settings.sybil.menuTitle', lang)}*\n\n` +
    `${t('settings.sybil.desc', lang)}\n\n` +
    `${PANEL_RULE}\n` +
    `*${curP(lang)}*\n` +
    `\`${curStr}\``;
  return {
    text,
    keyboard: [
      [{ text: `${mark(0)}⚪ ${offLbl}`, callback_data: 'set:maxSybilRatio:0' }],
      [{ text: `${mark(0.5)}50% ⭐ ${recP(lang)}`, callback_data: 'set:maxSybilRatio:0.5' }],
      [{ text: `${mark(0.67)}67%`, callback_data: 'set:maxSybilRatio:0.67' }, { text: `${mark(0.75)}75%`, callback_data: 'set:maxSybilRatio:0.75' }, { text: `${mark(0.9)}90%`, callback_data: 'set:maxSybilRatio:0.9' }],
      [{ text: defBtn(lang), callback_data: 'rst:sybil' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:catQuality' }],
    ],
  };
}

// ─── Language menu ───
function buildLangMenu(chatId) {
  const s = channels.getSettings(chatId);
  const lang = L(chatId);
  const cur = lang;
  const mark = (code) => cur === code ? '✅ ' : '';
  return {
    text: `${PANEL_RULE}\n🌐 *${t('settings.language', lang)}*`,
    keyboard: [
      [{ text: `${mark('en')}🇬🇧 English`, callback_data: 'set:lang:en' }],
      [{ text: `${mark('tr')}🇹🇷 Türkçe`, callback_data: 'set:lang:tr' }],
      [{ text: `${mark('ru')}🇷🇺 Русский`, callback_data: 'set:lang:ru' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

// ─ Chain (ağ) seçim menüsü — tek seçim radio (TON ya da BSC)
function buildChainMenu(chatId) {
  const lang = L(chatId);
  channels.updateSetting(chatId, 'chains', ['solana']);
  return {
    text: `${PANEL_RULE}\n◎ *Solana*\n\n${lang === 'tr' ? 'Bu bot yalnızca Solana ağını destekler.' : 'This bot supports Solana only.'}`,
    keyboard: [
      [{ text: '✅ ◎ Solana', callback_data: 'set:chain:solana' }],
      [{ text: t('settings.back', lang), callback_data: 'menu:main' }],
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Callback handler
// ─────────────────────────────────────────────────────────────
function handleCallback(data, chatId) {
  const lang = L(chatId);

  if (data === 'tgl:enabled') {
    const cur = channels.getSettings(chatId).enabled;
    channels.updateSetting(chatId, 'enabled', !cur);
    return { menu: 'main', toast: !cur ? '✅' : '⏸' };
  }
  if (data === 'tgl:silent') {
    const cur = channels.getSettings(chatId).silentNotification;
    channels.updateSetting(chatId, 'silentNotification', !cur);
    return { menu: 'catChannel', toast: !cur ? '🔕' : '🔔' };
  }
  if (data === 'tgl:userbot') {
    const cur = channels.getSettings(chatId).userbotEnabled;
    channels.updateSetting(chatId, 'userbotEnabled', !cur);
    return { menu: 'catChannel', toast: !cur ? '🤖✅' : '🤖⏸' };
  }
  if (data === 'tgl:lpLocked') {
    const cur = channels.getSettings(chatId).requireLpLocked;
    channels.updateSetting(chatId, 'requireLpLocked', !cur);
    return { menu: 'catQuality', toast: !cur ? '🔒✅' : '🔓' };
  }
  // showFilters ekranından gelen toggle'lar — aynı ekrana dön
  if (data === 'tgf:lpLocked') {
    const cur = channels.getSettings(chatId).requireLpLocked;
    channels.updateSetting(chatId, 'requireLpLocked', !cur);
    return { menu: 'showFilters', toast: !cur ? '🔒✅' : '🔓' };
  }
  if (data === 'tgf:silent') {
    const cur = channels.getSettings(chatId).silentNotification;
    channels.updateSetting(chatId, 'silentNotification', !cur);
    return { menu: 'showFilters', toast: !cur ? '🔕' : '🔔' };
  }
  if (data === 'tgf:userbot') {
    const cur = channels.getSettings(chatId).userbotEnabled;
    channels.updateSetting(chatId, 'userbotEnabled', !cur);
    return { menu: 'showFilters', toast: !cur ? '🤖✅' : '🤖⏸' };
  }
  if (data === 'tgl:hours') {
    const cur = channels.getSettings(chatId).activeHoursEnabled;
    channels.updateSetting(chatId, 'activeHoursEnabled', !cur);
    return { menu: 'hours', toast: !cur ? '⏰✅' : '⏰⏸' };
  }

  // Hızlı profil paketleri
  if (data.startsWith('profile:')) {
    const p = data.split(':')[1];
    const presets = {
      conservative: {
        minLiquidityUsd: 5000, minVolume24hUsd: 2000, minAgeMinutes: 10, maxAgeMinutes: 1440,
        maxRiskLevel: 'LOW', minHolders: 50, minAuditScore: 70, watchDelayMinutes: 15,
        minMarketCapUsd: 50000, maxMarketCapUsd: 10000000, requireLpLocked: true,
      },
      balanced: {
        minLiquidityUsd: 1500, minVolume24hUsd: 500, minAgeMinutes: 3, maxAgeMinutes: 180,
        maxRiskLevel: 'MEDIUM', minHolders: 5, minAuditScore: 40, watchDelayMinutes: 2,
        minMarketCapUsd: 10000, maxMarketCapUsd: 5000000, requireLpLocked: false,
      },
      aggressive: {
        minLiquidityUsd: 500, minVolume24hUsd: 100, minAgeMinutes: 0, maxAgeMinutes: 720,
        maxRiskLevel: 'HIGH', minHolders: 0, minAuditScore: 20, watchDelayMinutes: 0,
        minMarketCapUsd: 0, maxMarketCapUsd: 0, requireLpLocked: false,
      },
    };
    const cfg = presets[p];
    if (!cfg) return { toast: '?' };
    for (const [k, v] of Object.entries(cfg)) {
      channels.updateSetting(chatId, k, v);
    }
    return { menu: 'main', toast: `🚀 ${p}` };
  }

  // Reset alt-menü default
  if (data.startsWith('rst:')) {
    const which = data.split(':')[1];
    const resets = {
      liq: { minLiquidityUsd: 0 },
      vol: { minVolume24hUsd: 0 },
      age: { minAgeMinutes: 0, maxAgeMinutes: 0 },
      risk: { maxRiskLevel: 'HIGH' },
      holders: { minHolders: 0 },
      audit: { minAuditScore: 0 },
      watch: { watchDelayMinutes: 0 },
      mcap: { minMarketCapUsd: 0, maxMarketCapUsd: 0 },
      hours: { activeHoursEnabled: false, activeHoursStart: 10, activeHoursEnd: 23 },
      sybil: { maxSybilRatio: 0 },
    };
    const cfg = resets[which];
    if (!cfg) return { toast: '?' };
    for (const [k, v] of Object.entries(cfg)) {
      channels.updateSetting(chatId, k, v);
    }
    return { menu: which, toast: '↩️' };
  }

  if (data.startsWith('menu:')) {
    return { menu: data.split(':')[1] };
  }

  if (data.startsWith('set:')) {
    const [, key, ...rest] = data.split(':');
    const rawVal = rest.join(':');
    let value = rawVal;
    if (!isNaN(parseFloat(rawVal)) && /^\d+$/.test(rawVal)) value = parseFloat(rawVal);
    // float değerler (sybil ratio gibi)
    else if (/^\d*\.\d+$/.test(rawVal)) value = parseFloat(rawVal);

    // lang change
    if (key === 'lang') {
      if (!SUPPORTED.includes(value)) return { toast: '?' };
      channels.updateSetting(chatId, 'lang', value);
      return { menu: 'main', toast: t('settings.langSaved', value) };
    }

    // chain (ağ) change — tek seçim, diğer ağları temizle
    if (key === 'chain') {
      channels.updateSetting(chatId, 'chains', ['solana']);
      return { menu: 'main', toast: '◎ Solana' };
    }

    channels.updateSetting(chatId, key, value);
    // Alt-menüde kal — kullanıcı hangi alt-menüdeyse orayı yenile (değer tazelensin)
    const back =
      key === 'minLiquidityUsd' ? 'liq' :
      key === 'minVolume24hUsd' ? 'vol' :
      key.includes('Age') ? 'age' :
      key === 'maxRiskLevel' ? 'risk' :
      key === 'minHolders' ? 'holders' :
      key === 'minAuditScore' ? 'audit' :
      key === 'watchDelayMinutes' ? 'watch' :
      key.includes('MarketCap') ? 'mcap' :
      key.includes('activeHours') ? 'hours' :
      key === 'maxSybilRatio' ? 'sybil' : 'main';
    return { menu: back, toast: '✅' };
  }

  if (data.startsWith('dex:')) {
    const d = data.split(':')[1];
    let allowed = [...(channels.getSettings(chatId).allowedDexes || [])];
    if (d === 'all') {
      allowed = [];
    } else {
      if (allowed.includes(d)) allowed = allowed.filter((x) => x !== d);
      else allowed.push(d);
    }
    channels.updateSetting(chatId, 'allowedDexes', allowed);
    return { menu: 'dex', toast: '✅' };
  }

  if (data === 'banner:upload') {
    return { menu: 'banner', toast: t('settings.banner.awaitToast', lang), awaitBannerUpload: true };
  }
  if (data === 'banner:remove') {
    channels.updateSetting(chatId, 'bannerFileId', null);
    return { menu: 'banner', toast: '🗑' };
  }
  if (data === 'banner:preview') {
    return { menu: 'banner', toast: '', previewBanner: true };
  }

  if (data === 'reset') {
    channels.resetSettings(chatId);
    return { menu: 'main', toast: '🔄' };
  }
  if (data === 'close') return { close: true };
  if (data === 'noop') return { toast: '' };

  return { toast: '?' };
}

// ─────────────────────────────────────────────────────────────
function renderMenu(menu, chatId) {
  const result = _renderMenuInner(menu, chatId);
  const notice = channels.consumeChainsSanitizeNotice(chatId);
  if (result && typeof result.text === 'string') {
    if (notice) {
      result.text = `${notice}\n\n${result.text}`;
    }
    result.text = result.text + WIDTH_PAD;
  }
  return result;
}

function _renderMenuInner(menu, chatId) {
  switch (menu) {
    case 'main':       return buildMainMenu(chatId);
    case 'catFilters': return buildCatFilters(chatId);
    case 'catQuality': return buildCatQuality(chatId);
    case 'catChannel': return buildCatChannel(chatId);
    case 'catDisplay': return buildCatDisplay(chatId);
    case 'liq':    return buildLiqMenu(chatId);
    case 'vol':    return buildVolMenu(chatId);
    case 'age':    return buildAgeMenu(chatId);
    case 'risk':   return buildRiskMenu(chatId);
    case 'holders': return buildHoldersMenu(chatId);
    case 'audit':  return buildAuditMenu(chatId);
    case 'watch':  return buildWatchMenu(chatId);
    case 'dex':    return buildDexMenu(chatId);
    case 'banner': return buildBannerMenu(chatId);
    case 'lang':   return buildLangMenu(chatId);
    case 'chain':  return buildChainMenu(chatId);
    case 'mcap':   return buildMcapMenu(chatId);
    case 'hours':  return buildHoursMenu(chatId);
    case 'sybil':  return buildSybilMenu(chatId);
    case 'profile': return buildProfileMenu(chatId);
    case 'showFilters': return buildShowFiltersMenu(chatId);
    case 'intel':    return buildIntelMenu(chatId);
    default:       return buildMainMenu(chatId);
  }
}

// ─────────────────────────────────────────────────────────────
function formatAgeRange(min, max, lang) {
  const mLbl = lang === 'tr' ? 'dk' : lang === 'ru' ? 'мин' : 'm';
  const hLbl = lang === 'tr' ? 's' : lang === 'ru' ? 'ч' : 'h';
  const dLbl = lang === 'tr' ? 'g' : lang === 'ru' ? 'дн' : 'd';
  const fmt = (n) => {
    if (!n || n === 0) return null;
    if (n < 60) return `${n}${mLbl}`;
    if (n < 1440) return `${Math.round(n / 60)}${hLbl}`;
    return `${Math.round(n / 1440)}${dLbl}`;
  };
  const a = fmt(min), b = fmt(max);
  if (!a && !b) return '—';
  if (a && !b) return `${a}+`;
  if (!a && b) return `≤ ${b}`;
  return `${a} - ${b}`;
}

module.exports = { renderMenu, handleCallback };
