// Bot Analizi — Token kartına eklenen kural-bazlı yorum bloğu.
// auditor.js'ten gelen veriyi okur, ✅/⚠️/❌ ile maddeler + verdict üretir.
// 3 dil destekli (en/tr/ru), kanal/kullanıcı diline göre.

const { t } = require('./i18n');

// ─────────────────────────────────────────────────────────────
// Mesaj havuzu (3 dilli, sade & doğal)
// ─────────────────────────────────────────────────────────────
const M = {
  // Liquidity
  liqStrong: {
    en: 'Liquidity ${usd}+ — pool depth strong',
    tr: 'Likidite ${usd}+ — havuz derinliği güçlü',
    ru: 'Ликвидность ${usd}+ — пул глубокий',
  },
  liqGood: {
    en: 'Liquidity ${usd}+ — healthy',
    tr: 'Likidite ${usd}+ — sağlıklı',
    ru: 'Ликвидность ${usd}+ — здоровая',
  },
  liqOk: {
    en: 'Liquidity ${usd} — moderate',
    tr: 'Likidite ${usd} — orta seviye',
    ru: 'Ликвидность ${usd} — средняя',
  },
  liqWeak: {
    en: 'Liquidity only ${usd} — thin pool',
    tr: 'Likidite sadece ${usd} — ince havuz',
    ru: 'Ликвидность только ${usd} — тонкий пул',
  },
  liqPoor: {
    en: 'Liquidity below $1k — rug risk high',
    tr: 'Likidite $1k altı — rug riski yüksek',
    ru: 'Ликвидность ниже $1k — высокий риск rug',
  },
  // Age
  ageMature: {
    en: 'Token age ${d}d — survived early stage',
    tr: 'Token ${d} günlük — erken dönemi atlatmış',
    ru: 'Возраст токена ${d}д — ранняя стадия пройдена',
  },
  ageHours: {
    en: 'Token age ${h}h — still early',
    tr: 'Token ${h} saatlik — hâlâ erken',
    ru: 'Возраст ${h}ч — ещё рано',
  },
  ageMinutes: {
    en: 'Token age ${m}m — fresh, observe more',
    tr: 'Token ${m} dakikalık — çok taze, dikkat',
    ru: 'Возраст ${m}м — очень свежий, наблюдайте',
  },
  ageVeryNew: {
    en: 'Token under 30m old — too early to trust',
    tr: 'Token 30 dakikadan genç — güvenmek için erken',
    ru: 'Токен младше 30м — слишком рано доверять',
  },
  // Volume / Liquidity ratio
  volNormal: {
    en: 'Volume/Liquidity ${r}x — healthy trading',
    tr: 'Hacim/Likidite ${r}x — sağlam alım-satım',
    ru: 'Объём/Ликвидность ${r}x — здоровая торговля',
  },
  volHigh: {
    en: 'Volume/Liquidity ${r}x — strong activity',
    tr: 'Hacim/Likidite ${r}x — yoğun aktivite',
    ru: 'Объём/Ликвидность ${r}x — сильная активность',
  },
  volExtreme: {
    en: 'Volume/Liquidity ${r}x — pump/dump risk',
    tr: 'Hacim/Likidite ${r}x — pump/dump riski',
    ru: 'Объём/Ликвидность ${r}x — риск pump/dump',
  },
  volLow: {
    en: 'Volume/Liquidity ${r}x — low trading activity',
    tr: 'Hacim/Likidite ${r}x — düşük işlem',
    ru: 'Объём/Ликвидность ${r}x — слабая торговля',
  },
  // Buyer/Seller balance
  balBalanced: {
    en: 'Buyer/seller activity balanced — organic',
    tr: 'Alıcı/satıcı dengesi sağlıklı — organik',
    ru: 'Баланс покупок/продаж — органичный',
  },
  balBuyPressure: {
    en: 'Buy pressure dominant — positive momentum',
    tr: 'Alım baskısı baskın — pozitif momentum',
    ru: 'Доминирует давление покупок — позитивный момент',
  },
  balSellPressure: {
    en: 'Sell pressure dominant — distribution phase',
    tr: 'Satış baskısı baskın — dağıtım fazı',
    ru: 'Доминирует давление продаж — фаза распределения',
  },
  balNone: {
    en: 'No recent trades — dead pool risk',
    tr: 'Son zamanlarda işlem yok — ölü havuz riski',
    ru: 'Нет недавних сделок — риск мёртвого пула',
  },
  // Holder concentration
  topHolderLow: {
    en: 'Top holder ${p}% — well distributed',
    tr: 'En büyük holder %${p} — iyi dağılmış',
    ru: 'Топ-холдер ${p}% — хорошее распределение',
  },
  topHolderMid: {
    en: 'Top holder ${p}% — watch concentration',
    tr: 'En büyük holder %${p} — konsantrasyon takip et',
    ru: 'Топ-холдер ${p}% — следите за концентрацией',
  },
  topHolderHigh: {
    en: 'Top holder ${p}% — single-wallet risk',
    tr: 'En büyük holder %${p} — tek cüzdan riski',
    ru: 'Топ-холдер ${p}% — риск одного кошелька',
  },
  // Top 10
  top10Good: {
    en: 'Top 10 wallets ${p}% — healthy spread',
    tr: 'Top 10 cüzdan %${p} — dengeli dağılım',
    ru: 'Топ-10 кошельков ${p}% — здоровое распределение',
  },
  top10Mid: {
    en: 'Top 10 wallets ${p}% — concentrated',
    tr: 'Top 10 cüzdan %${p} — konsantre',
    ru: 'Топ-10 кошельков ${p}% — концентрировано',
  },
  top10Bad: {
    en: 'Top 10 wallets ${p}% — heavy concentration',
    tr: 'Top 10 cüzdan %${p} — ağır konsantrasyon',
    ru: 'Топ-10 кошельков ${p}% — тяжёлая концентрация',
  },
  // Mintable
  mintClosed: {
    en: 'Mint disabled — fixed supply',
    tr: 'Mint kapalı — sabit arz',
    ru: 'Эмиссия закрыта — фиксированная поставка',
  },
  mintOpen: {
    en: 'Mint still open — inflation risk',
    tr: 'Mint hâlâ açık — enflasyon riski',
    ru: 'Эмиссия открыта — риск инфляции',
  },
  // Admin
  adminNone: {
    en: 'No admin wallet — decentralized',
    tr: 'Admin cüzdanı yok — merkeziyetsiz',
    ru: 'Нет админ-кошелька — децентрализован',
  },
  adminSet: {
    en: 'Admin wallet active — owner controls',
    tr: 'Admin cüzdanı aktif — sahip kontrolünde',
    ru: 'Активен админ-кошелёк — контроль владельца',
  },
  // Verification
  verifBlacklist: {
    en: 'Token blacklisted — confirmed scam signal',
    tr: 'Token kara listede — onaylanmış scam sinyali',
    ru: 'Токен в чёрном списке — подтверждённый scam',
  },
  // Price action
  pricePump: {
    en: 'Price +${p}% in 1h — parabolic spike',
    tr: 'Fiyat 1 saatte +%${p} — parabolik sıçrama',
    ru: 'Цена +${p}% за 1ч — параболический рост',
  },
  priceDump: {
    en: 'Price ${p}% in 24h — sharp decline',
    tr: 'Fiyat 24 saatte %${p} — sert düşüş',
    ru: 'Цена ${p}% за 24ч — резкое падение',
  },
  // On-chain deep dive (LP / sybil / honeypot)
  deepOnchainTitle: {
    en: '🔬 <b>On-chain &amp; liquidity spine</b>',
    tr: '🔬 <b>On-chain &amp; likidite omurgası</b>',
    ru: '🔬 <b>Ончейн и ликвидность</b>',
  },
  lpLockedStrong: {
    en: 'LP locked — ${total}% of LP burned/locked (rug buffer stronger)',
    tr: 'LP kilitli — LP&apos;nin %${total}&apos;i yakılmış/kilitli (rug tamponu daha güçlü)',
    ru: 'LP заблокирован — ${total}% LP сожжено/заблокировано',
  },
  lpUnlockedButBacked: {
    en: 'LP not locked — but ${total}% burned/locked in pool (check timelock)',
    tr: 'LP kilitli değil — havuzda %${total} yakım/kilit var (timelock kontrol et)',
    ru: 'LP не заблокирован — ${total}% сожжено/в пуле',
  },
  lpThin: {
    en: 'LP mostly unlocked — low burn/lock (${total}%) — easy rug vector',
    tr: 'LP çoğunlukla açık — düşük yakım/kilit (%${total}) — rug vektörü kolay',
    ru: 'LP в основном открыт — мало сожжено (${total}%)',
  },
  sybilBad: {
    en: 'Wallet graph: ${n}/${m} recent buyers cluster / same funder (${pct}%) — wash-trading risk',
    tr: 'Cüzdan grafiği: ${n}/${m} alıcı küme / aynı kaynak (${pct}%) — wash riski',
    ru: 'Граф кошельков: ${n}/${m} покупателей кластер (${pct}%)',
  },
  sybilWarn: {
    en: 'Wallet graph: linked cluster ${n}/${m} buyers (${pct}%) — watch distribution',
    tr: 'Cüzdan grafiği: bağlı küme ${n}/${m} alıcı (${pct}%) — dağılımı izle',
    ru: 'Кластер ${n}/${m} покупателей (${pct}%)',
  },
  sybilFunder: {
    en: 'Shared funder pattern: <code>${addr}</code> (Bubblemaps / explorer to verify)',
    tr: 'Ortak besleyen: <code>${addr}</code> (Bubblemaps / explorer ile doğrula)',
    ru: 'Общий фандер: <code>${addr}</code>',
  },
  hpYes: {
    en: 'Honeypot.is simulation: <b>honeypot / sells may revert</b> — do not buy',
    tr: 'Honeypot.is: <b>honeypot / satış revert</b> — alım önerilmez',
    ru: 'Honeypot.is: <b>хайпот</b> — не покупать',
  },
  hpTaxes: {
    en: 'Simulated taxes: buy ${buy}% / sell ${sell}%${transfer}',
    tr: 'Simülasyon vergisi: alış %${buy} / satış %${sell}${transfer}',
    ru: 'Налоги симуляции: buy ${buy}% / sell ${sell}%${transfer}',
  },
  hpReason: {
    en: 'Engine note: ${reason}',
    tr: 'Motor notu: ${reason}',
    ru: 'Примечание: ${reason}',
  },
  hpRiskLevel: {
    en: 'Honeypot.is risk score: ${lvl}/100 (${risk})',
    tr: 'Honeypot.is risk skoru: ${lvl}/100 (${risk})',
    ru: 'Риск Honeypot.is: ${lvl}/100 (${risk})',
  },
  hpFlags: {
    en: 'Contract flags: ${flags}',
    tr: 'Kontrat bayrakları: ${flags}',
    ru: 'Флаги: ${flags}',
  },
  bscVerified: {
    en: 'BscScan: contract source verified',
    tr: 'BscScan: kontrat kaynağı doğrulanmış',
    ru: 'BscScan: исходники верифицированы',
  },
  goplusHead: {
    en: '📡 <b>GoPlus</b> (Token Security API — live)',
    tr: '📡 <b>GoPlus</b> (Token Security API — canlı)',
    ru: '📡 <b>GoPlus</b> (Token Security API)',
  },
  goplusHpAgree: {
    en: 'GoPlus: honeypot flag = 1 (matches honeypot.is)',
    tr: 'GoPlus: honeypot bayrağı = 1 (honeypot.is ile uyumlu)',
    ru: 'GoPlus: honeypot = 1 (совпадает с honeypot.is)',
  },
  goplusHpWarn: {
    en: 'GoPlus: honeypot flag = 1 — static scan says sells may be blocked (cross-check)',
    tr: 'GoPlus: honeypot = 1 — statik tarama satışın kilitli olabileceğini söylüyor (çapraz kontrol)',
    ru: 'GoPlus: honeypot = 1 — статический скан (перепроверьте)',
  },
  goplusMint: {
    en: 'GoPlus: mint function detected (is_mintable = 1)',
    tr: 'GoPlus: mint fonksiyonu tespit (is_mintable = 1)',
    ru: 'GoPlus: обнаружен mint (is_mintable = 1)',
  },
  goplusHidden: {
    en: 'GoPlus: hidden owner risk (hidden_owner = 1)',
    tr: 'GoPlus: gizli owner riski (hidden_owner = 1)',
    ru: 'GoPlus: скрытый владелец (hidden_owner = 1)',
  },
  goplusTakeBack: {
    en: 'GoPlus: ownership can be taken back (can_take_back_ownership = 1)',
    tr: 'GoPlus: sahiplik geri alınabilir (can_take_back_ownership = 1)',
    ru: 'GoPlus: ownership можно вернуть (can_take_back_ownership = 1)',
  },
  goplusBlacklistAbi: {
    en: 'GoPlus: blacklist capability in contract (is_blacklisted ABI = 1)',
    tr: 'GoPlus: kontratta blacklist yeteneği (is_blacklisted = 1)',
    ru: 'GoPlus: в контракте blacklist (is_blacklisted = 1)',
  },
  goplusCannotSellAll: {
    en: 'GoPlus: cannot sell entire balance in one tx (cannot_sell_all = 1)',
    tr: 'GoPlus: tüm bakiyeyi tek tx satamama (cannot_sell_all = 1)',
    ru: 'GoPlus: нельзя продать всё сразу (cannot_sell_all = 1)',
  },
  goplusAirdropScam: {
    en: 'GoPlus: airdrop scam signal (is_airdrop_scam = 1)',
    tr: 'GoPlus: airdrop scam sinyali (is_airdrop_scam = 1)',
    ru: 'GoPlus: признак airdrop-scam (is_airdrop_scam = 1)',
  },
  goplusHolders: {
    en: 'GoPlus holder_count (API): ${n}',
    tr: 'GoPlus holder_count (API): ${n}',
    ru: 'GoPlus holder_count: ${n}',
  },
  goplusTaxes: {
    en: 'GoPlus taxes: buy ${buy}% / sell ${sell}%${transfer}',
    tr: 'GoPlus vergi: alış %${buy} / satış %${sell}${transfer}',
    ru: 'GoPlus налоги: buy ${buy}% / sell ${sell}%${transfer}',
  },
  goplusFetchErr: {
    en: 'GoPlus API unavailable: ${err}',
    tr: 'GoPlus API yanıt vermedi: ${err}',
    ru: 'GoPlus API: ${err}',
  },
  rugcheckHead: {
    en: '🛡️ <b>RugCheck</b> (Solana)',
    tr: '🛡️ <b>RugCheck</b> (Solana)',
    ru: '🛡️ <b>RugCheck</b> (Solana)',
  },
  rugcheckScore: {
    en: 'RugCheck score: ${score} · LP locked ${lp}%',
    tr: 'RugCheck skor: ${score} · LP kilit ${lp}%',
    ru: 'RugCheck score: ${score} · LP ${lp}%',
  },
  rugcheckRugged: {
    en: 'RugCheck: token marked <b>rugged</b>',
    tr: 'RugCheck: token <b>rugged</b> işaretli',
    ru: 'RugCheck: <b>rugged</b>',
  },
  rugcheckRisk: {
    en: 'RugCheck: ${name}',
    tr: 'RugCheck: ${name}',
    ru: 'RugCheck: ${name}',
  },
  solMintOpen: {
    en: 'GoPlus: mint authority active',
    tr: 'GoPlus: mint yetkisi aktif',
    ru: 'GoPlus: mint активен',
  },
  solFreeze: {
    en: 'GoPlus: freeze authority active',
    tr: 'GoPlus: freeze yetkisi aktif',
    ru: 'GoPlus: freeze активен',
  },
  solMetaMutable: {
    en: 'GoPlus: metadata mutable',
    tr: 'GoPlus: metadata değiştirilebilir',
    ru: 'GoPlus: metadata изменяема',
  },
  solNotTrusted: {
    en: 'GoPlus: not in trusted token list',
    tr: 'GoPlus: güvenilir token listesinde değil',
    ru: 'GoPlus: не в trusted list',
  },
  solHeliusHolders: {
    en: 'Helius RPC: top holder ${t1}% · top 10: ${t10}%',
    tr: 'Helius RPC: en büyük ${t1}% · top 10: ${t10}%',
    ru: 'Helius: top ${t1}% · top10 ${t10}%',
  },
  auditWarnSection: {
    en: '<b>Scanner warnings</b>',
    tr: '<b>Tarayıcı uyarıları</b>',
    ru: '<b>Предупреждения</b>',
  },
};

// Verdict mesajları
const VERDICT = {
  great: {
    en: '🟢 *Solid profile — looks legit*',
    tr: '🟢 *Sağlam profil — verimli duruyor*',
    ru: '🟢 *Надёжный профиль — выглядит легит*',
  },
  good: {
    en: '🟢 *Healthy signals — promising*',
    tr: '🟢 *Sağlıklı sinyaller — umut verici*',
    ru: '🟢 *Здоровые сигналы — перспективно*',
  },
  mixed: {
    en: '🟡 *Mixed signals — DYOR carefully*',
    tr: '🟡 *Karışık sinyaller — dikkatli araştır*',
    ru: '🟡 *Смешанные сигналы — DYOR внимательно*',
  },
  risky: {
    en: '🔴 *Risky profile — proceed with caution*',
    tr: '🔴 *Riskli profil — temkinli yaklaş*',
    ru: '🔴 *Рискованный профиль — осторожно*',
  },
  dangerous: {
    en: '🔴 *Dangerous — multiple red flags*',
    tr: '🔴 *Tehlikeli — birden fazla kırmızı bayrak*',
    ru: '🔴 *Опасно — несколько красных флагов*',
  },
};

function pick(msg, lang) {
  return msg[lang] || msg.en;
}

function fmtUsd(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'k';
  return '$' + Math.round(n);
}

function fill(tmpl, vars) {
  return tmpl.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(s) {
  return String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarizeFlags(flags, max = 5) {
  if (!Array.isArray(flags) || !flags.length) return '';
  const parts = flags.slice(0, max).map((f) => {
    if (typeof f === 'string') return escapeHtml(f);
    if (f && typeof f === 'object') return escapeHtml(JSON.stringify(f).slice(0, 72));
    return '';
  }).filter(Boolean);
  const tail = flags.length > max ? '…' : '';
  return parts.join(', ') + tail;
}

function fmtTax(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  return Number(n).toFixed(2);
}

// ─────────────────────────────────────────────────────────────
// Ortak metrik toplama (tam blok + tek satır özet aynı sayaçlarla)
// ─────────────────────────────────────────────────────────────
function analysisOkIcon(chain = 'solana') {
  return chain === 'solana' ? '🤔' : '✅';
}

function formatAnalysisItemLine(item, ce, chain) {
  let icon = chain === 'solana' && item.icon === '✅' ? '🤔' : item.icon;
  if (chain === 'solana' && icon === '🗄') icon = '🗄️';
  if (ce && icon && !icon.includes('<')) {
    return `${ce(icon)} ${item.text}`;
  }
  return `${icon} ${item.text}`;
}

/** Derin analiz satırı — baştaki unicode ikonu premium emoji yapar. */
function wrapAnalysisLineEmojis(line, ce) {
  if (!line || !ce || line.includes('<tg-emoji')) return line;
  const icons = [
    '⚠️', '⚠', '❌', '🚨', '👥', '🔗', '🔒', '🔓', '🧪', '📝', '🌡️', '🌡', '🏷', '✅', '📊', '🗄️', '🗄',
  ];
  for (const icon of icons) {
    if (line.startsWith(`${icon} `)) {
      return `${ce(icon)} ${line.slice(icon.length).trimStart()}`;
    }
  }
  return line;
}

function collectAnalysisMetrics(token, audit, lang = 'en', _opts = {}) {
  const chain = token?.chain || _opts.chain || 'solana';
  const ok = analysisOkIcon(chain);
  const items = []; // { icon: 🤔|✅|⚠️|❌, text }
  let goodCount = 0;
  let warnCount = 0;
  let badCount = 0;

  // 1) Liquidity
  const liq = audit.breakdown.liquidity;
  const liqUsd = fmtUsd(token.liquidityUsd || 0);
  if (liq.code === 'STRONG') {
    items.push({ icon: '🗄', text: fill(pick(M.liqStrong, lang), { usd: liqUsd }) });
    goodCount++;
  } else if (liq.code === 'GOOD') {
    items.push({ icon: '🗄', text: fill(pick(M.liqGood, lang), { usd: liqUsd }) });
    goodCount++;
  } else if (liq.code === 'OK') {
    items.push({ icon: '🗄', text: fill(pick(M.liqOk, lang), { usd: liqUsd }) });
    goodCount++;
  } else if (liq.code === 'WEAK') {
    items.push({ icon: '🌡', text: fill(pick(M.liqWeak, lang), { usd: liqUsd }) });
    warnCount++;
  } else {
    items.push({ icon: '🌡', text: pick(M.liqPoor, lang) });
    badCount++;
  }

  // 2) Age
  const age = audit.breakdown.age;
  if (age.code === 'days') {
    items.push({ icon: ok, text: fill(pick(M.ageMature, lang), { d: age.value }) });
    goodCount++;
  } else if (age.code === 'hours') {
    items.push({ icon: '⚠️', text: fill(pick(M.ageHours, lang), { h: age.hours }) });
    warnCount++;
  } else if (age.code === 'minutes') {
    items.push({ icon: '🐻', text: fill(pick(M.ageMinutes, lang), { m: age.value }) });
    warnCount++;
  } else if (age.code === 'minutesNew') {
    items.push({ icon: '🐻', text: pick(M.ageVeryNew, lang) });
    badCount++;
  }

  // 3) Volume / Liquidity
  const vr = audit.breakdown.volumeLiquidityRatio;
  if (vr.code === 'normal') {
    items.push({ icon: '📈', text: fill(pick(M.volNormal, lang), { r: vr.ratio.toFixed(1) }) });
    goodCount++;
  } else if (vr.code === 'high') {
    items.push({ icon: '📈', text: fill(pick(M.volHigh, lang), { r: vr.ratio.toFixed(1) }) });
    goodCount++;
  } else if (vr.code === 'extreme') {
    items.push({ icon: '📈', text: fill(pick(M.volExtreme, lang), { r: vr.ratio.toFixed(1) }) });
    badCount++;
  } else if (vr.code === 'low') {
    items.push({ icon: '📈', text: fill(pick(M.volLow, lang), { r: vr.ratio.toFixed(2) }) });
    warnCount++;
  }

  // 4) Buyer/Seller balance
  const bal = audit.breakdown.buyerSellerBalance;
  if (bal.code === 'balanced') {
    items.push({ icon: '⚖️', text: pick(M.balBalanced, lang) });
    goodCount++;
  } else if (bal.code === 'buyPressure') {
    items.push({ icon: '⚖️', text: pick(M.balBuyPressure, lang) });
    goodCount++;
  } else if (bal.code === 'sellPressure') {
    items.push({ icon: '⚖️', text: pick(M.balSellPressure, lang) });
    warnCount++;
  } else if (bal.code === 'none') {
    items.push({ icon: '❌', text: pick(M.balNone, lang) });
    badCount++;
  }

  // 5) Contract data (if available)
  const c = token.contract;
  if (c) {
    // Top holder
    if (typeof c.topHolderPct === 'number') {
      const p = c.topHolderPct.toFixed(0);
      if (c.topHolderPct > 30) {
        items.push({ icon: '❌', text: fill(pick(M.topHolderHigh, lang), { p }) });
        badCount++;
      } else if (c.topHolderPct > 15) {
        items.push({ icon: '⚠️', text: fill(pick(M.topHolderMid, lang), { p }) });
        warnCount++;
      } else {
        items.push({ icon: ok, text: fill(pick(M.topHolderLow, lang), { p }) });
        goodCount++;
      }
    }

    // Top 10
    if (typeof c.top10Pct === 'number') {
      const p = c.top10Pct.toFixed(0);
      if (c.top10Pct > 90) {
        items.push({ icon: '❌', text: fill(pick(M.top10Bad, lang), { p }) });
        badCount++;
      } else if (c.top10Pct > 70) {
        items.push({ icon: '⚠️', text: fill(pick(M.top10Mid, lang), { p }) });
        warnCount++;
      } else {
        items.push({ icon: ok, text: fill(pick(M.top10Good, lang), { p }) });
        goodCount++;
      }
    }

    // Mintable
    if (c.mintable === true) {
      items.push({ icon: '❌', text: pick(M.mintOpen, lang) });
      badCount++;
    } else if (c.mintable === false) {
      items.push({ icon: ok, text: pick(M.mintClosed, lang) });
      goodCount++;
    }

    // Admin wallet
    if (c.adminAddress) {
      items.push({ icon: '⚠️', text: pick(M.adminSet, lang) });
      warnCount++;
    } else if (c.adminAddress === null || c.adminAddress === '') {
      items.push({ icon: ok, text: pick(M.adminNone, lang) });
      goodCount++;
    }

    // Blacklist
    if (c.verification === 'blacklist') {
      items.push({ icon: '❌', text: pick(M.verifBlacklist, lang) });
      badCount++;
    }
  }

  // 6) Price action
  if (typeof token.priceChange1h === 'number' && token.priceChange1h > 200) {
    items.push({ icon: '❌', text: fill(pick(M.pricePump, lang), { p: token.priceChange1h.toFixed(0) }) });
    badCount++;
  }
  if (typeof token.priceChange24h === 'number' && token.priceChange24h < -50) {
    items.push({ icon: '❌', text: fill(pick(M.priceDump, lang), { p: token.priceChange24h.toFixed(0) }) });
    badCount++;
  }

  // 7–9) On-chain spine: LP lock/burn, wallet graph (sybil), BSC honeypot.is + BscScan
  const deepLines = [];

  if (token.lpBurnAnalysis && token.lpBurnAnalysis.source !== 'unknown') {
    const lp = token.lpBurnAnalysis;
    const total = (Number(lp.burnedPct) || 0) + (Number(lp.lockedPct) || 0);
    const totalStr = total.toFixed(1);
    if (lp.lpLocked) {
      deepLines.push(`🔒 ${fill(pick(M.lpLockedStrong, lang), { total: totalStr })}`);
      goodCount++;
    } else if (total >= 50) {
      deepLines.push(`🔓 ${fill(pick(M.lpUnlockedButBacked, lang), { total: totalStr })}`);
      warnCount++;
    } else {
      deepLines.push(`⚠️ ${fill(pick(M.lpThin, lang), { total: totalStr })}`);
      badCount++;
    }
  }

  const sy = token.sybilAnalysis;
  if (sy && sy.source !== 'unknown' && sy.buyersAnalyzed >= 3) {
    const pctStr = (Number(sy.clusterRatio) * 100).toFixed(0);
    const vars = { n: sy.largestClusterSize, m: sy.buyersAnalyzed, pct: pctStr };
    if (sy.sybilDetected) {
      deepLines.push(`🚨 ${fill(pick(M.sybilBad, lang), vars)}`);
      badCount += 2;
    } else if (sy.clusterRatio >= 0.35) {
      deepLines.push(`⚠️ ${fill(pick(M.sybilWarn, lang), vars)}`);
      warnCount++;
    } else if (sy.clusterRatio > 0.08) {
      deepLines.push(`👥 ${fill(pick(M.sybilWarn, lang), vars)}`);
      warnCount++;
    } else if (sy.clusterRatio > 0) {
      deepLines.push(`👥 ${fill(pick(M.sybilWarn, lang), vars)}`);
    }
    if (sy.sharedFunder && /^0x[a-fA-F0-9]{40}$/.test(String(sy.sharedFunder))) {
      const sf = String(sy.sharedFunder);
      const short = `${sf.slice(0, 6)}…${sf.slice(-4)}`;
      deepLines.push(`🔗 ${fill(pick(M.sybilFunder, lang), { addr: short })}`);
    }
  }

  const c2 = token.contract;
  const ext = c2?.bsc_extra;
  if (token.chain === 'bsc' && c2) {
    if (c2.is_scam === true) {
      deepLines.push(`❌ ${pick(M.hpYes, lang)}`);
      badCount += 3;
    } else if (ext) {
      const buyT = fmtTax(ext.buyTax);
      const sellT = fmtTax(ext.sellTax);
      if (buyT !== null || sellT !== null) {
        let transfer = '';
        const tt = fmtTax(ext.transferTax);
        if (tt !== null && Number(tt) > 0) {
          transfer = lang === 'tr' ? ` / transfer %${tt}` : lang === 'ru' ? ` / transfer ${tt}%` : ` / transfer ${tt}%`;
        }
        deepLines.push(`🧪 ${fill(pick(M.hpTaxes, lang), { buy: buyT ?? '?', sell: sellT ?? '?', transfer })}`);
        const sN = sellT != null ? Number(sellT) : 0;
        const bN = buyT != null ? Number(buyT) : 0;
        if (sN > 40 || bN > 40) badCount++;
        else if (sN > 15 || bN > 15) warnCount++;
      }
      if (ext.honeypotReason && c2.is_scam !== true) {
        const reason = escapeHtml(stripTags(String(ext.honeypotReason))).slice(0, 220);
        if (reason) deepLines.push(`📝 ${fill(pick(M.hpReason, lang), { reason })}`);
      }
      const rl = ext.summaryRiskLevel;
      if (typeof rl === 'number' && c2.is_scam !== true) {
        const risk = escapeHtml(stripTags(String(ext.summaryRisk ?? 'n/a')).slice(0, 48));
        if (rl >= 85) {
          badCount++;
          deepLines.push(`🌡 ${fill(pick(M.hpRiskLevel, lang), { lvl: String(rl), risk })}`);
        } else if (rl >= 60) {
          warnCount++;
          deepLines.push(`🌡 ${fill(pick(M.hpRiskLevel, lang), { lvl: String(rl), risk })}`);
        }
      }
      const flagStr = summarizeFlags(ext.flags);
      if (flagStr) deepLines.push(`🏷 ${fill(pick(M.hpFlags, lang), { flags: flagStr })}`);
    }
    if (c2.verified === true && c2.is_scam !== true) {
      deepLines.push(`✅ ${pick(M.bscVerified, lang)}`);
      goodCount++;
    }

    const gp = ext?.goplus;
    if (gp) {
      deepLines.push(pick(M.goplusHead, lang));
      const gpHpOn = String(gp.is_honeypot) === '1';
      if (gpHpOn) {
        if (c2.is_scam === true) {
          deepLines.push(`🔗 ${pick(M.goplusHpAgree, lang)}`);
        } else {
          deepLines.push(`❌ ${pick(M.goplusHpWarn, lang)}`);
          badCount += 2;
        }
      }
      if (String(gp.is_mintable) === '1') {
        deepLines.push(`❌ ${pick(M.goplusMint, lang)}`);
        badCount++;
      }
      if (String(gp.hidden_owner) === '1') {
        deepLines.push(`⚠️ ${pick(M.goplusHidden, lang)}`);
        warnCount++;
      }
      if (String(gp.can_take_back_ownership) === '1') {
        deepLines.push(`⚠️ ${pick(M.goplusTakeBack, lang)}`);
        warnCount++;
      }
      if (String(gp.is_blacklisted) === '1') {
        deepLines.push(`⚠️ ${pick(M.goplusBlacklistAbi, lang)}`);
        warnCount++;
      }
      if (String(gp.cannot_sell_all) === '1') {
        deepLines.push(`❌ ${pick(M.goplusCannotSellAll, lang)}`);
        badCount++;
      }
      if (String(gp.is_airdrop_scam) === '1') {
        deepLines.push(`❌ ${pick(M.goplusAirdropScam, lang)}`);
        badCount++;
      }
      const gBuy = fmtTax(gp.buy_tax);
      const gSell = fmtTax(gp.sell_tax);
      const simShown = ext && (ext.buyTax != null || ext.sellTax != null);
      if (!simShown && (gBuy !== null || gSell !== null)) {
        let transfer = '';
        const gtt = fmtTax(gp.transfer_tax);
        if (gtt !== null && Number(gtt) > 0) {
          transfer = lang === 'tr' ? ` / transfer %${gtt}` : lang === 'ru' ? ` / transfer ${gtt}%` : ` / transfer ${gtt}%`;
        }
        deepLines.push(`🧪 ${fill(pick(M.goplusTaxes, lang), { buy: gBuy ?? '?', sell: gSell ?? '?', transfer })}`);
        const sN = gSell != null ? Number(gSell) : 0;
        const bN = gBuy != null ? Number(gBuy) : 0;
        if (sN > 40 || bN > 40) badCount++;
        else if (sN > 15 || bN > 15) warnCount++;
      }
    } else if (ext?.goplusError) {
      deepLines.push(`⚠️ ${fill(pick(M.goplusFetchErr, lang), { err: escapeHtml(String(ext.goplusError)).slice(0, 120) })}`);
    }
  }

  if (token.chain === 'solana' && c2?.solana_extra) {
    const sx = c2.solana_extra;
    const rc = sx.rugcheck;
    const gp = sx.goplus;

    if (rc && !rc.error) {
      deepLines.push(pick(M.rugcheckHead, lang));
      const sc = rc.score_normalised ?? rc.score;
      if (sc != null) {
        deepLines.push(`📊 ${fill(pick(M.rugcheckScore, lang), {
          score: String(sc),
          lp: rc.lpLockedPct != null ? String(Math.round(rc.lpLockedPct)) : '?',
        })}`);
        if (sc >= 5000) badCount += 2;
        else if (sc >= 1000) warnCount++;
      }
      if (rc.rugged) {
        deepLines.push(`❌ ${pick(M.rugcheckRugged, lang)}`);
        badCount += 3;
      }
      for (const risk of (rc.risks || []).slice(0, 4)) {
        const name = risk?.name || risk?.description || risk?.value || String(risk);
        deepLines.push(`⚠️ ${fill(pick(M.rugcheckRisk, lang), { name: escapeHtml(String(name).slice(0, 120)) })}`);
        warnCount++;
      }
      if (rc.mintAuthority) {
        deepLines.push(`⚠️ ${pick(M.solMintOpen, lang)} (RugCheck)`);
        warnCount++;
      }
      if (rc.freezeAuthority) {
        deepLines.push(`⚠️ ${pick(M.solFreeze, lang)} (RugCheck)`);
        warnCount++;
      }
    }

    if (gp) {
      if (String(gp.mintable_status) === '1') {
        deepLines.push(`❌ ${pick(M.solMintOpen, lang)}`);
        badCount++;
      }
      if (String(gp.freezable_status) === '1') {
        deepLines.push(`⚠️ ${pick(M.solFreeze, lang)}`);
        warnCount++;
      }
      if (String(gp.metadata_mutable_status) === '1') {
        deepLines.push(`⚠️ ${pick(M.solMetaMutable, lang)}`);
        warnCount++;
      }
      if (gp.trusted_token === 0) {
        deepLines.push(`⚠️ ${pick(M.solNotTrusted, lang)}`);
        warnCount++;
      }
    } else if (sx.goplus_error && sx.goplus_error !== 'disabled') {
      deepLines.push(`⚠️ ${fill(pick(M.goplusFetchErr, lang), { err: escapeHtml(String(sx.goplus_error)).slice(0, 80) })}`);
    }

    const hl = sx.helius_holders;
    if (hl?.topHolderPct != null) {
      deepLines.push(`👥 ${fill(pick(M.solHeliusHolders, lang), {
        t1: hl.topHolderPct.toFixed(1),
        t10: (hl.top10Pct ?? hl.topHolderPct).toFixed(1),
      })}`);
    }
  }

  return { items, deepLines, goodCount, warnCount, badCount };
}

function riskLabelText(code, lang) {
  const map = { VERY_LOW: 'risk.veryLow', LOW: 'risk.low', MEDIUM: 'risk.medium', HIGH: 'risk.high' };
  return t(map[code] || 'risk.medium', lang);
}

function ageSummary(age, lang) {
  if (!age || age.code === 'unknown') return '';
  if (age.code === 'minutesNew') return `${age.value} ${t('age.minutesNew', lang)}`;
  if (age.code === 'minutes') return `${age.value} ${t('age.minutes', lang)}`;
  if (age.code === 'hours') {
    const hm = age.minutes ? ` ${age.minutes}${t('age.minutes', lang)}` : '';
    return `${age.hours}${t('age.hours', lang)}${hm}`;
  }
  if (age.code === 'days') return `${age.value} ${t('age.days', lang)}`;
  return '';
}

function liqSummaryWord(liq, lang) {
  if (lang === 'tr') {
    if (liq.code === 'STRONG') return 'güçlü';
    if (liq.code === 'GOOD' || liq.code === 'OK') return 'sağlıklı';
    if (liq.code === 'WEAK') return 'zayıf';
    return 'kritik';
  }
  if (lang === 'ru') {
    if (liq.code === 'STRONG') return 'сильная';
    if (liq.code === 'GOOD' || liq.code === 'OK') return 'нормальная';
    if (liq.code === 'WEAK') return 'слабая';
    return 'критично';
  }
  if (liq.code === 'STRONG') return 'strong';
  if (liq.code === 'GOOD' || liq.code === 'OK') return 'healthy';
  if (liq.code === 'WEAK') return 'weak';
  return 'critical';
}

function pickVerdictHtml(token, audit, lang, counts) {
  const { goodCount, badCount } = counts;
  const c2 = token.contract;
  const riskCode = audit.risk.code;
  let verdict;
  if (badCount >= 3 || riskCode === 'HIGH' || c2?.is_scam === true) {
    verdict = pick(VERDICT.dangerous, lang);
  } else if (badCount >= 1 || riskCode === 'MEDIUM') {
    verdict = badCount >= 2 ? pick(VERDICT.risky, lang) : pick(VERDICT.mixed, lang);
  } else if (goodCount >= 5) {
    verdict = pick(VERDICT.great, lang);
  } else {
    verdict = pick(VERDICT.good, lang);
  }
  return verdict.replace(/\*([^*]+)\*/g, '<b>$1</b>');
}

function collectRedFlags(token, lang) {
  const flags = [];
  const c2 = token.contract;
  const gp = c2?.bsc_extra?.goplus;
  const sgp = c2?.solana_extra?.goplus;
  if (c2?.is_scam === true || c2?.solana_extra?.rugcheck?.rugged) {
    const lbl = token.chain === 'solana'
      ? (lang === 'tr' ? 'RugCheck: rugged / scam' : lang === 'ru' ? 'RugCheck: rugged' : 'RugCheck: rugged')
      : (lang === 'tr' ? 'Honeypot — satış engelli' : lang === 'ru' ? 'Honeypot' : 'Honeypot — sells blocked');
    flags.push({ sev: 'bad', text: lbl });
  } else if (token.chain === 'bsc' && gp && String(gp.is_honeypot) === '1') {
    flags.push({ sev: 'warn', text: lang === 'tr' ? 'GoPlus: honeypot şüphesi' : lang === 'ru' ? 'GoPlus: honeypot' : 'GoPlus: possible honeypot' });
  }
  if (c2?.mintable === true || (gp && String(gp.is_mintable) === '1')
    || (sgp && String(sgp.mintable_status) === '1')) {
    flags.push({ sev: 'warn', text: lang === 'tr' ? 'Mint açık' : lang === 'ru' ? 'Mint открыт' : 'Mint open' });
  }
  if (sgp && String(sgp.freezable_status) === '1') {
    flags.push({ sev: 'warn', text: lang === 'tr' ? 'Freeze yetkisi' : lang === 'ru' ? 'Freeze' : 'Freeze authority' });
  }
  if (gp && String(gp.cannot_sell_all) === '1') {
    flags.push({ sev: 'bad', text: lang === 'tr' ? 'Tam satış kısıtı' : lang === 'ru' ? 'Ограничение продажи' : 'Cannot sell all' });
  }
  if (c2?.verification === 'blacklist') {
    flags.push({ sev: 'bad', text: lang === 'tr' ? 'Kara liste' : lang === 'ru' ? 'Чёрный список' : 'Blacklisted' });
  }
  const sy = token.sybilAnalysis;
  if (sy && sy.sybilDetected) {
    flags.push({ sev: 'bad', text: lang === 'tr' ? 'Sybil / wash riski' : lang === 'ru' ? 'Sybil / wash' : 'Sybil / wash risk' });
  }
  const lp = token.lpBurnAnalysis;
  if (lp && lp.source !== 'unknown') {
    const total = (Number(lp.burnedPct) || 0) + (Number(lp.lockedPct) || 0);
    if (!lp.lpLocked && total < 50) {
      flags.push({ sev: 'warn', text: lang === 'tr' ? 'LP çoğunlukla açık' : lang === 'ru' ? 'LP открыт' : 'LP mostly unlocked' });
    }
  }
  return flags;
}

function prioritizeItems(items, max = 5) {
  const rank = (i) => {
    if (i.icon === '❌') return 0;
    if (i.icon === '⚠️' || i.icon === '🌡' || i.icon === '🐻') return 1;
    return 2;
  };
  return [...items].sort((a, b) => rank(a) - rank(b)).slice(0, max);
}

/** Kanal bot yorumu — düzenli çok satırlı analiz gövdesi (başlık ayrı eklenir). */
function buildAnalysisCommentBody(token, audit, lang = 'en', opts = {}) {
  const { items, deepLines, goodCount, warnCount, badCount } = collectAnalysisMetrics(token, audit, lang, opts);
  const chain = opts.chain || token.chain || 'ton';
  const { customEmojiHtml } = require('./emojiPack');
  const ce = (emoji) => customEmojiHtml(emoji, chain);

  const lines = [];
  const { formatRiskLine } = require('./riskDisplay');
  lines.push(formatRiskLine(audit, lang, ce, riskLabelText));

  const liqUsd = fmtUsd(token.liquidityUsd || 0);
  const liq = audit.breakdown.liquidity;
  lines.push(`${ce('🪙')} <b>${t('card.liquidity', lang)}:</b> <b>${escapeHtml(liqUsd)}</b> — ${escapeHtml(liqSummaryWord(liq, lang))}`);

  const ageTxt = ageSummary(audit.breakdown.age, lang);
  if (ageTxt) lines.push(`${ce('⏱️')} <b>${t('card.age', lang)}:</b> ${escapeHtml(ageTxt)}`);

  const redFlags = collectRedFlags(token, lang);
  if (redFlags.length) {
    for (const f of redFlags.slice(0, 4)) {
      const icon = f.sev === 'bad' ? ce('❌') : ce('❤️');
      lines.push(`${icon} ${escapeHtml(f.text)}`);
    }
  }

  const picked = prioritizeItems(items, 5);
  if (picked.length) {
    for (const i of picked) {
      lines.push(formatAnalysisItemLine(i, ce, chain));
    }
    if (items.length > picked.length) {
      const more = items.length - picked.length;
      const moreLbl = lang === 'tr'
        ? `+${more} sinyal daha`
        : lang === 'ru'
          ? `+${more} сигналов`
          : `+${more} more signals`;
      lines.push(`<i>${escapeHtml(moreLbl)}</i>`);
    }
  }

  const deepPick = deepLines.slice(0, 4);
  if (deepPick.length) {
    for (const d of deepPick) lines.push(wrapAnalysisLineEmojis(d, ce));
    if (deepLines.length > deepPick.length) {
      const n = deepLines.length - deepPick.length;
      const lbl = lang === 'tr' ? `+${n} on-chain not` : lang === 'ru' ? `+${n} ончейн` : `+${n} on-chain notes`;
      lines.push(`<i>${escapeHtml(lbl)}</i>`);
    }
  }

  if (opts.includeAuditWarnings && audit.warnings && audit.warnings.length) {
    lines.push(`⚠️ <b>${t('card.warnings', lang)}:</b>`);
    const maxW = 4;
    for (const w of audit.warnings.slice(0, maxW)) {
      const text = typeof w === 'string' ? w : t(w.key, lang, w.vars || {});
      lines.push(`  • ${escapeHtml(text)}`);
    }
    if (audit.warnings.length > maxW) {
      const more = audit.warnings.length - maxW;
      const lbl = lang === 'tr' ? `+${more} uyarı daha` : lang === 'ru' ? `+${more} предупр.` : `+${more} more warnings`;
      lines.push(`  <i>${escapeHtml(lbl)}</i>`);
    }
  }

  const verdictHtml = pickVerdictHtml(token, audit, lang, { goodCount, warnCount, badCount });
  const verdictLbl = lang === 'tr' ? 'Değerlendirme:' : lang === 'ru' ? 'Вердикт:' : 'Verdict:';
  lines.push(`${ce('💬')} <b>${verdictLbl}</b> ${verdictHtml}`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Main: build analysis block
// opts.includeAuditWarnings: true only for standalone follow-up (avoids duplicating card / details reply)
// ─────────────────────────────────────────────────────────────
function buildAnalysis(token, audit, lang = 'en', opts = {}) {
  const { items, deepLines, goodCount, warnCount, badCount } = collectAnalysisMetrics(token, audit, lang, opts);
  const c2 = token.contract;

  const warnLines = [];
  if (opts.includeAuditWarnings && audit.warnings && audit.warnings.length) {
    warnLines.push(pick(M.auditWarnSection, lang));
    warnLines.push('');
    for (const w of audit.warnings) {
      const text = typeof w === 'string' ? w : t(w.key, lang, w.vars || {});
      warnLines.push(`⚡ ${escapeHtml(text)}`);
    }
  }

  const verdictHtml = pickVerdictHtml(token, audit, lang, { goodCount, warnCount, badCount });

  // ─── Header + body ───
  const header = lang === 'tr'
    ? '🧠 <b>Bot Analizi</b>'
    : lang === 'ru'
      ? '🧠 <b>Анализ бота</b>'
      : '🧠 <b>Bot Analysis</b>';

  const verdictLabel = lang === 'tr' ? '💬 <b>Değerlendirme:</b>' : lang === 'ru' ? '💬 <b>Вердикт:</b>' : '💬 <b>Verdict:</b>';

  const lines = [
    '─────────────────────',
    header,
    '',
    ...items.map((i) => `${i.icon} ${i.text}`),
  ];
  if (deepLines.length) {
    lines.push('');
    lines.push(pick(M.deepOnchainTitle, lang));
    lines.push('');
    lines.push(...deepLines);
  }
  if (warnLines.length) {
    lines.push('');
    lines.push(...warnLines);
  }
  lines.push('');
  lines.push(`${verdictLabel} ${verdictHtml}`);
  return lines.join('\n');
}

/** Kanal / kart için: tek satır, link yok, özet + verdict. */
function buildAnalysisOneLine(token, audit, lang = 'en', opts = {}) {
  const { goodCount, warnCount, badCount } = collectAnalysisMetrics(token, audit, lang, opts);
  const c2 = token.contract;
  const riskCode = audit.risk.code;
  const { safetyPercent, fmtPct } = require('./riskDisplay');
  const safeStr = fmtPct(safetyPercent(audit.riskPercent), lang);
  const verdictHtml = pickVerdictHtml(token, audit, lang, { goodCount, warnCount, badCount });

  const sep = ' · ';
  const liqUsd = fmtUsd(token.liquidityUsd || 0);
  const liq = audit.breakdown.liquidity;
  const liqWord = (() => {
    if (lang === 'tr') {
      if (liq.code === 'STRONG' || liq.code === 'GOOD' || liq.code === 'OK') return 'derin';
      if (liq.code === 'WEAK') return 'zayıf';
      return 'kritik';
    }
    if (lang === 'ru') {
      if (liq.code === 'STRONG' || liq.code === 'GOOD' || liq.code === 'OK') return 'глубоко';
      if (liq.code === 'WEAK') return 'слабо';
      return 'риск';
    }
    if (liq.code === 'STRONG' || liq.code === 'GOOD' || liq.code === 'OK') return 'deep';
    if (liq.code === 'WEAK') return 'weak';
    return 'thin';
  })();

  const age = audit.breakdown.age;
  let ageBit = '';
  if (age.code === 'days') ageBit = `${age.value}d`;
  else if (age.code === 'hours') ageBit = `${age.hours}h`;
  else if (age.code === 'minutes' || age.code === 'minutesNew') ageBit = `${age.value}m`;

  const riskLbl = lang === 'tr' ? 'Risk' : lang === 'ru' ? 'Риск' : 'Risk';
  const liqLbl = lang === 'tr' ? 'Lik' : lang === 'ru' ? 'Ликв' : 'Liq';
  const ageLbl = lang === 'tr' ? 'Yaş' : lang === 'ru' ? 'Возр' : 'Age';
  const chain = opts.chain || token.chain || 'ton';
  let header = '';
  if (!opts.skipHeader) {
    try {
      const { botLogoHtml } = require('./emojiPack');
      const botLbl = lang === 'tr' ? 'Bot' : lang === 'ru' ? 'Бот' : 'Bot';
      header = `${botLogoHtml(chain)} <b>${botLbl}:</b> `;
    } catch (_) {
      header = lang === 'tr' ? '🧠 <b>Bot:</b> ' : '🧠 <b>Bot:</b> ';
    }
  }

  const chips = [];
  const gp = c2?.bsc_extra?.goplus;
  if (token.chain === 'bsc' && c2?.is_scam === true) {
    chips.push(lang === 'tr' ? 'honeypot' : lang === 'ru' ? 'хайпот' : 'honeypot');
  } else if (gp && String(gp.is_honeypot) === '1') {
    chips.push(lang === 'tr' ? 'GoPlus:HP?' : lang === 'ru' ? 'GoPlus:HP' : 'GoPlus:HP?');
  }
  if (c2?.mintable === true || (gp && String(gp.is_mintable) === '1')) {
    chips.push(lang === 'tr' ? 'mint' : 'mint');
  }
  if (gp && String(gp.cannot_sell_all) === '1') {
    chips.push(lang === 'tr' ? 'satış kısıtı' : lang === 'ru' ? 'продажа+' : 'sell lock?');
  }
  if (c2?.verification === 'blacklist') {
    chips.push(lang === 'tr' ? 'kara liste' : lang === 'ru' ? 'чёрный список' : 'blacklist');
  }
  const sy = token.sybilAnalysis;
  if (sy && sy.sybilDetected) {
    chips.push(lang === 'tr' ? 'sybil/wash' : lang === 'ru' ? 'sybil' : 'sybil/wash');
  }
  const lp = token.lpBurnAnalysis;
  if (lp && lp.source !== 'unknown') {
    const total = (Number(lp.burnedPct) || 0) + (Number(lp.lockedPct) || 0);
    if (!lp.lpLocked && total < 50) {
      chips.push(lang === 'tr' ? 'LP açık' : lang === 'ru' ? 'LP открыт' : 'LP unlocked');
    }
  }

  const { safetyTierLabel } = require('./riskDisplay');
  const safePct = safetyPercent(audit.riskPercent);
  const riskTxt = `${escapeHtml(safeStr)} ${escapeHtml(t('card.safetyWord', lang))} · ${escapeHtml(safetyTierLabel(safePct, lang))}`;
  let line = opts.skipHeader
    ? `${riskLbl} <b>${riskTxt}</b>${sep}${liqLbl} ${escapeHtml(liqUsd)} (${escapeHtml(liqWord)})`
    : `${header}${riskLbl} <b>${riskTxt}</b>${sep}${liqLbl} ${escapeHtml(liqUsd)} (${escapeHtml(liqWord)})`;
  if (ageBit) {
    try {
      const { customEmojiHtml } = require('./emojiPack');
      line += `${sep}${customEmojiHtml('⏱️', chain)} ${ageLbl} ${escapeHtml(ageBit)}`;
    } catch (_) {
      line += `${sep}${ageLbl} ${escapeHtml(ageBit)}`;
    }
  }
  if (chips.length) line += `${sep}${chips.slice(0, 4).map(escapeHtml).join(sep)}`;
  if (opts.includeAuditWarnings && audit.warnings && audit.warnings.length) {
    const n = audit.warnings.length;
    const wlab = lang === 'tr' ? 'uyarı' : lang === 'ru' ? 'предупр.' : 'warn';
    line += `${sep}⚠ ${n} ${wlab}`;
  }
  line += `${sep}${verdictHtml}`;
  if (line.length > 380) line = `${line.slice(0, 377)}…`;
  return line;
}

module.exports = { buildAnalysis, buildAnalysisOneLine, buildAnalysisCommentBody };
