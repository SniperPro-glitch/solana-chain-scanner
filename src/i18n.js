// 3 dil sözlüğü (EN / TR / RU)
// Anahtar bazlı çeviri sistemi.
// Default: 'en'

const STRINGS = {
  // ─── Token kartı ───
  'card.newToken': { en: 'New Token', tr: 'Yeni Token', ru: 'Новый Токен' },
  'card.trustedTokenTitle': {
    en: 'Popular · ${label}',
    tr: 'Popüler · ${label}',
    ru: 'Популярный · ${label}',
  },
  'card.popularLine': {
    en: 'POPULAR ·',
    tr: 'POPÜLER ·',
    ru: 'ПОПУЛЯРНЫЙ ·',
  },
  'card.popularTag': {
    en: 'POPULAR · ${label}',
    tr: 'POPÜLER · ${label}',
    ru: 'ПОПУЛЯРНЫЙ · ${label}',
  },
  'card.knownProjectBadge': {
    en: 'KNOWN PROJECT',
    tr: 'BİLİNEN PROJE',
    ru: 'ИЗВЕСТНЫЙ ПРОЕКТ',
  },
  'card.contract': { en: 'Contract', tr: 'Kontrat', ru: 'Контракт' },
  'card.trustedWhitelist': {
    en: 'Popular · ${label}',
    tr: 'Popüler · ${label}',
    ru: 'Популярный · ${label}',
  },
  'card.readCommentHint': {
    en: '↓ Bot comment: analysis & contract security',
    tr: '↓ Bot yorumu: analiz & kontrat güvenliği',
    ru: '↓ Комментарий: анализ и безопасность контракта',
  },
  'comment.botTitle': {
    en: 'Bot analysis',
    tr: 'Bot analizi',
    ru: 'Анализ бота',
  },
  'comment.riskReportTitle': {
    en: 'RISK REPORT',
    tr: 'RİSK RAPORU',
    ru: 'ОТЧЁТ О РИСКЕ',
  },
  'comment.riskReportHighlights': {
    en: 'Key findings',
    tr: 'Öne çıkanlar',
    ru: 'Главное',
  },
  'comment.riskReportMore': {
    en: '+{n} more signals in full audit',
    tr: '+{n} ek sinyal (tam denetim)',
    ru: '+{n} сигналов (полный аудит)',
  },
  'comment.riskReportVerdict': {
    en: 'Assessment',
    tr: 'Değerlendirme',
    ru: 'Вердикт',
  },
  'comment.trustCardTitle': {
    en: 'TRUST CARD',
    tr: 'GÜVEN KARTI',
    ru: 'КАРТА ДОВЕРИЯ',
  },
  'comment.openAppHint': {
    en: 'Tap the button below for the full audit report.',
    tr: 'Tüm testler ve detaylar için alttaki butona dokunun.',
    ru: 'Полный отчёт — кнопка ниже.',
  },
  'comment.openFullReport': {
    en: '📊 Open full risk report',
    tr: '📊 Tam risk raporunu aç',
    ru: '📊 Полный отчёт о риске',
  },
  'comment.tradeTitle': {
    en: 'Buy / Sell',
    tr: 'Al / Sat',
    ru: 'Купить / Продать',
  },
  'comment.linksTitle': {
    en: 'Links',
    tr: 'Linkler',
    ru: 'Ссылки',
  },
  'comment.momentumTitle': {
    en: 'Momentum',
    tr: 'Momentum',
    ru: 'Моментум',
  },
  'comment.momentumPrice1h': {
    en: '1h price: +${pct}%',
    tr: '1s fiyat: +${pct}%',
    ru: '1ч цена: +${pct}%',
  },
  'comment.momentumTxns': {
    en: 'Last ${window}: ${txns} trades',
    tr: 'Son ${window}: ${txns} işlem',
    ru: 'За ${window}: ${txns} сделок',
  },
  'comment.momentumBuyRatio': {
    en: 'Buy ratio: ${pct}% (window)',
    tr: 'Alım oranı: %${pct} (pencere)',
    ru: 'Покупки: ${pct}%',
  },
  'comment.momentumHot': {
    en: 'Very fast pump',
    tr: 'Çok hızlı pump',
    ru: 'Очень быстрый памп',
  },
  'comment.walletLinkTitle': {
    en: 'Wallet link ratio',
    tr: 'Cüzdan bağlantı oranı',
    ru: 'Связь кошельков',
  },
  'comment.walletLinkRatio': {
    en: '${pct}% linked (${n}/${total} early buyers same source)',
    tr: 'Bağlantı %${pct} (${n}/${total} erken alıcı aynı kaynak)',
    ru: 'Связь ${pct}% (${n}/${total} с одного источника)',
  },
  'comment.walletLinkWarn': {
    en: 'Coordinated / bot-wash suspicion',
    tr: 'Koordineli / bot-wash şüphesi',
    ru: 'Подозрение на координацию / wash',
  },
  'comment.walletLinkLow': {
    en: 'Some cluster overlap — check comment context',
    tr: 'Kısmi küme — bağlamı yorumda okuyun',
    ru: 'Частичное пересечение кластеров',
  },
  'comment.walletLinkBscVol': {
    en: 'Vol/liq ${ratio}x — high activity (on-chain cluster N/A)',
    tr: 'Hacim/likidite ${ratio}x — yoğun işlem (zincir kümesi yok)',
    ru: 'Объём/ликв ${ratio}x — высокая активность',
  },
  'comment.walletLinkVolLiq': {
    en: 'Vol/liq ${ratio}x — unusual turnover',
    tr: 'Hacim/likidite ${ratio}x — olağandışı devir',
    ru: 'Объём/ликв ${ratio}x — необычный оборот',
  },
  'comment.footnotePumpSybil': {
    en: 'Fast move + linked wallets — high bot/wash risk.',
    tr: 'Hızlı hareket + bağlı cüzdanlar — bot/wash riski yüksek.',
    ru: 'Быстрый рост + связанные кошельки — риск wash.',
  },
  'comment.footnotePump': {
    en: 'Fast momentum — not proof of organic demand.',
    tr: 'Hızlı momentum — organik talep kanıtı değildir.',
    ru: 'Быстрый рост — не доказательство органического спроса.',
  },
  'card.fastPump': {
    en: 'Fast momentum: +${pct}% (1h) · ${txns} tx/${window}',
    tr: 'Hızlı yükseliş: +${pct}% (1s) · ${txns} işlem/${window}',
    ru: 'Быстрый рост: +${pct}% (1ч) · ${txns} сд/${window}',
  },
  'card.fastPumpHot': {
    en: 'Hot pump: +${pct}% (1h) · ${txns} tx/${window}',
    tr: 'Çok hızlı pump: +${pct}% (1s) · ${txns} işlem/${window}',
    ru: 'Горячий памп: +${pct}% (1ч) · ${txns} сд/${window}',
  },
  'card.price': { en: 'Price', tr: 'Fiyat', ru: 'Цена' },
  'card.fdv': { en: 'FDV', tr: 'FDV', ru: 'FDV' },
  'card.mcap': { en: 'MCap', tr: 'MCap', ru: 'Кап.' },
  'card.liquidity': { en: 'Liquidity', tr: 'Likidite', ru: 'Ликвидность' },
  'card.volume24h': { en: '24h Volume', tr: '24s Hacim', ru: 'Объём 24ч' },
  'card.volLiqRatio': { en: 'Vol/Liq', tr: 'Hacim/Likidite', ru: 'Объём/Ликв.' },
  'card.price1h': { en: 'Price (1h)', tr: 'Fiyat (1s)', ru: 'Цена (1ч)' },
  'card.price24h': { en: 'Price (24h)', tr: 'Fiyat (24s)', ru: 'Цена (24ч)' },
  'card.txns24h': { en: 'Txns (24h)', tr: 'İşlemler (24s)', ru: 'Сделки (24ч)' },
  'card.age': { en: 'Age', tr: 'Yaş', ru: 'Возраст' },
  'card.dex': { en: 'DEX', tr: 'DEX', ru: 'DEX' },
  'card.contractSecurity': { en: 'Contract Security', tr: 'Kontrat Güvenliği', ru: 'Безопасность контракта' },
  'card.mintLocked': { en: 'Mint locked', tr: 'Mint kilitli', ru: 'Минт заблокирован' },
  'card.mintOpen': { en: 'Mint open (owner can issue more)', tr: 'Mint açık (sahibi basabilir)', ru: 'Минт открыт (владелец может выпустить ещё)' },
  'card.ownerRenounced': { en: 'Ownership renounced (no one can interfere)', tr: 'Sahiplik feragat edilmiş (kimse müdahale edemez)', ru: 'Владение отказано (никто не может вмешаться)' },
  'card.ownerActive': { en: 'Owner active (can interfere)', tr: 'Sahip aktif (müdahale edebilir)', ru: 'Владелец активен (может вмешаться)' },
  'card.topHolder': { en: 'Top holder', tr: 'En büyük cüzdan', ru: 'Крупнейший держатель' },
  'card.top10': { en: 'Top 10 holders', tr: 'Top 10 cüzdan', ru: 'Топ 10 держателей' },
  'card.holdersCount': { en: 'Holders', tr: 'Holder sayısı', ru: 'Держатели' },
  'card.verified': { en: 'Verified token', tr: 'Doğrulanmış token', ru: 'Проверенный токен' },
  'card.risk': { en: 'Risk', tr: 'Risk', ru: 'Риск' },
  'card.warnings': { en: 'Warnings', tr: 'Uyarılar', ru: 'Предупреждения' },
  'card.disclaimer': {
    en: 'Early-buy alert scanner bot — not financial advice, DYOR.',
    tr: 'Erken alım uyarısı için tasarlanmış tarama botu — yatırım tavsiyesi değildir, DYOR.',
    ru: 'Бот раннего обнаружения токенов — не является финансовым советом, DYOR.',
  },

  // ─── 3-renk kart sistemi (sarı/kırmızı varyantları) ───
  'card.title.yellow':   { en: 'RISK ALERT', tr: 'RİSK UYARISI', ru: 'ПРЕДУПРЕЖДЕНИЕ' },
  'card.title.critical': { en: 'CRITICAL RISK — DANGER', tr: 'KRİTİK RİSK — DİKKAT', ru: 'КРИТИЧЕСКИЙ РИСК' },
  'card.title.red':      { en: 'SCAM DETECTED', tr: 'SCAM TESPİT EDİLDİ', ru: 'ОБНАРУЖЕН SCAM' },
  'card.advice.yellow': {
    en: 'Low-level risk detected. Review recommended before investing.',
    tr: 'Düşük seviye risk tespit edildi. Yatırım öncesi inceleme önerilir.',
    ru: 'Обнаружен низкий уровень риска. Рекомендуется проверить перед инвестированием.',
  },
  // ─── BSC kart başı — risk derecelendirme açıklaması (her seviyede 1 blok) ───
  // NOT: Header'da emoji yok — formatter dışarıdan ce() ile premium emoji ekleyecek
  'bsc.rating.green.header': {
    tr: '<b>Bu Token YEŞİL kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a GREEN card.</b>',
    ru: '<b>Этот токен оценён как ЗЕЛЁНАЯ карта.</b>',
  },
  'bsc.rating.green.body': {
    tr: 'Yeşil kart sadece neredeyse tüm testlerden geçmiş, olumlu sonuçlar elde etmiş tokenlerde paylaşılır.',
    en: 'A green card is shared only for tokens that have passed nearly all checks with positive results.',
    ru: 'Зелёная карта выдаётся только токенам, прошедшим почти все проверки с положительным результатом.',
  },
  'bsc.rating.yellow.header': {
    tr: '<b>Bu Token SARI kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a YELLOW card.</b>',
    ru: '<b>Этот токен оценён как ЖЁЛТАЯ карта.</b>',
  },
  'bsc.rating.yellow.body': {
    tr: 'Sarı kart düşük-orta seviye risk işaretleri tespit edilen tokenlerde paylaşılır. Yatırım yapmadan önce inceleme önerilir.',
    en: 'A yellow card is shared for tokens with low-to-medium risk signals. Review recommended before investing.',
    ru: 'Жёлтая карта выдаётся токенам с низкими-средними признаками риска. Рекомендуется проверить перед инвестированием.',
  },
  'bsc.rating.critical.header': {
    tr: '<b>Bu Token KRİTİK kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a CRITICAL card.</b>',
    ru: '<b>Этот токен оценён как КРИТИЧЕСКАЯ карта.</b>',
  },
  'bsc.rating.critical.body': {
    tr: 'Kritik kart yüksek seviye risk testlerinde olumsuz sonuç vermiş tokenlerde paylaşılır. Yatırım yapmadan önce dikkat ediniz.',
    en: 'A critical card is shared for tokens that failed high-level risk checks. Exercise caution before investing.',
    ru: 'Критическая карта выдаётся токенам, не прошедшим высокоуровневые проверки. Будьте осторожны перед инвестированием.',
  },
  'bsc.rating.red.header': {
    tr: '<b>Bu Token KIRMIZI kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a RED card.</b>',
    ru: '<b>Этот токен оценён как КРАСНАЯ карта.</b>',
  },
  'bsc.rating.red.body': {
    tr: 'Kırmızı kart, testleri karşılayamamış scam/rug-pull belirtileri taşıyan tokenlerde paylaşılır. Yatırım yapmadan önce dikkat ediniz.',
    en: 'A red card is shared for tokens that failed checks and show scam/rug-pull signals. Exercise caution before investing.',
    ru: 'Красная карта выдаётся токенам, не прошедшим проверки и с признаками scam/rug-pull. Будьте осторожны перед инвестированием.',
  },
  'bsc.rating.signature': {
    tr: '<i>— BSC SCANNER BOT MESAJI</i>',
    en: '<i>— BSC SCANNER BOT MESSAGE</i>',
    ru: '<i>— BSC SCANNER BOT СООБЩЕНИЕ</i>',
  },
  'sol.rating.green.header': {
    tr: '<b>Bu Token YEŞİL kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a GREEN card.</b>',
    ru: '<b>Этот токен оценён как ЗЕЛЁНАЯ карта.</b>',
  },
  'sol.rating.green.body': {
    tr: 'Yeşil kart, Solana ağında neredeyse tüm testlerden geçmiş, olumlu sonuçlar elde etmiş tokenlerde paylaşılır.',
    en: 'A green card is shared on Solana only for tokens that passed nearly all checks with positive results.',
    ru: 'Зелёная карта на Solana — только для токенов, прошедших почти все проверки с положительным результатом.',
  },
  'sol.rating.yellow.header': {
    tr: '<b>Bu Token SARI kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a YELLOW card.</b>',
    ru: '<b>Этот токен оценён как ЖЁЛТАЯ карта.</b>',
  },
  'sol.rating.yellow.body': {
    tr: 'Sarı kart, Solana’da düşük-orta seviye risk işaretleri tespit edilen tokenlerde paylaşılır. Yatırım öncesi inceleme önerilir.',
    en: 'A yellow card is shared on Solana for tokens with low-to-medium risk signals. Review recommended before investing.',
    ru: 'Жёлтая карта на Solana — токены с низкими-средними признаками риска. Рекомендуется проверить перед инвестированием.',
  },
  'sol.rating.critical.header': {
    tr: '<b>Bu Token KRİTİK kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a CRITICAL card.</b>',
    ru: '<b>Этот токен оценён как КРИТИЧЕСКАЯ карта.</b>',
  },
  'sol.rating.critical.body': {
    tr: 'Kritik kart, Solana’da yüksek seviye risk testlerinde olumsuz sonuç vermiş tokenlerde paylaşılır. Yatırım öncesi dikkat ediniz.',
    en: 'A critical card is shared on Solana for tokens that failed high-level risk checks. Exercise caution before investing.',
    ru: 'Критическая карта на Solana — токены, не прошедшие высокоуровневые проверки. Будьте осторожны.',
  },
  'sol.rating.red.header': {
    tr: '<b>Bu Token KIRMIZI kart ile derecelendirildi.</b>',
    en: '<b>This token has been rated as a RED card.</b>',
    ru: '<b>Этот токен оценён как КРАСНАЯ карта.</b>',
  },
  'sol.rating.red.body': {
    tr: 'Kırmızı kart, Solana’da testleri karşılayamamış scam/rug-pull belirtileri taşıyan tokenlerde paylaşılır. Yatırım yapmayın.',
    en: 'A red card is shared on Solana for tokens that failed checks and show scam/rug-pull signals. Do not invest.',
    ru: 'Красная карта на Solana — токены с признаками scam/rug-pull. Не инвестируйте.',
  },
  'sol.rating.signature': {
    tr: '<i>— SOLANA SCANNER BOT MESAJI</i>',
    en: '<i>— SOLANA SCANNER BOT MESSAGE</i>',
    ru: '<i>— SOLANA SCANNER BOT СООБЩЕНИЕ</i>',
  },
  'card.advice.critical': {
    en: 'CRITICAL risk — buying this token is EXTREMELY dangerous. Single wallet dominates supply, rug-pull risk very high.',
    tr: 'KRİTİK risk — bu tokene girmek ÇOK tehlikeli. Tek cüzdan supply\'ı domine ediyor, rug riski çok yüksek.',
    ru: 'Критический риск — покупка крайне опасна. Один кошелек владеет большей частью supply.',
  },
  'card.advice.red': {
    en: 'SCAM detected. Liquidity drained — do not buy, you may be unable to sell.',
    tr: 'SCAM tespit edildi. Likidite çekildi — alım yapmayın, satış yapamayabilirsiniz.',
    ru: 'Обнаружен SCAM. Ликвидность выведена — не покупайте.',
  },
  'card.autoDeleteNote': {
    en: 'This post will be automatically removed in 2 minutes.',
    tr: 'Bu paylaşım 2 dakika sonra otomatik olarak silinecek.',
    ru: 'Это сообщение будет автоматически удалено через 2 минуты.',
  },
  'card.disclaimer.yellow': {
    en: 'Risk warning — not financial advice, DYOR.',
    tr: 'Risk uyarısı — yatırım tavsiyesi değildir, DYOR.',
    ru: 'Предупреждение о риске — не финансовый совет, DYOR.',
  },
  'card.yellow.banner': {
    en: 'CAUTION — This token shows medium-risk signals.',
    tr: 'DİKKAT — Bu tokende orta seviye risk işaretleri var.',
    ru: 'ВНИМАНИЕ — Токен показывает признаки среднего риска.',
  },
  'card.yellow.checklist.title': {
    en: 'Before buying — verify:',
    tr: 'Alımdan önce — kontrol edin:',
    ru: 'Перед покупкой — проверьте:',
  },
  'card.yellow.check.lp':     { en: 'LP lock & burn status',          tr: 'LP kilit ve burn durumu',        ru: 'Блокировка и сжигание LP' },
  'card.yellow.check.owner':  { en: 'Contract owner / mint authority', tr: 'Sözleşme sahibi / mint yetkisi', ru: 'Владелец контракта / mint' },
  'card.yellow.check.holder': { en: 'Top holder concentration',        tr: 'En büyük cüzdan oranı',          ru: 'Концентрация у топ-холдеров' },
  'card.yellow.check.volume': { en: 'Volume / liquidity ratio',        tr: 'Hacim / likidite oranı',         ru: 'Соотношение объёма к ликвидности' },
  'card.yellow.entryRule': {
    en: 'Rule: enter with small size, set stop-loss, never average down on red flags.',
    tr: 'Kural: küçük poz al, stop koy, kötü sinyalde maliyet düşürme.',
    ru: 'Правило: малая позиция, ставьте стоп, не усредняйте на плохих сигналах.',
  },
  'card.disclaimer.critical': {
    en: 'DYOR — this token has critical-level risk indicators, rug-pull is highly likely.',
    tr: 'DYOR — bu token kritik risk işaretleri taşıyor, rug çok muhtemel.',
    ru: 'DYOR — этот токен имеет критические признаки риска.',
  },
  'card.disclaimer.red': {
    en: 'SCAM alert — stay away from this token.',
    tr: 'SCAM uyarısı — bu tokendan uzak durun.',
    ru: 'Тревога: SCAM — держитесь подальше.',
  },

  // ─── Risk seviyeleri ───
  'risk.veryLow': { en: 'VERY LOW', tr: 'ÇOK DÜŞÜK', ru: 'ОЧЕНЬ НИЗКИЙ' },
  'risk.low': { en: 'LOW', tr: 'DÜŞÜK', ru: 'НИЗКИЙ' },
  'risk.medium': { en: 'MEDIUM', tr: 'ORTA', ru: 'СРЕДНИЙ' },
  'risk.high': { en: 'HIGH', tr: 'YÜKSEK', ru: 'ВЫСОКИЙ' },
  'card.safetyWord': { en: 'safe', tr: 'güvenli', ru: 'безоп.' },
  'safety.tier.high': {
    en: 'Solid confidence',
    tr: 'Güvenilir profil',
    ru: 'Высокая уверенность',
  },
  'safety.tier.mid': {
    en: 'Moderate confidence',
    tr: 'Orta güven',
    ru: 'Средняя уверенность',
  },
  'safety.tier.low': {
    en: '⚠️ Low confidence',
    tr: '⚠️ Düşük güven',
    ru: '⚠️ Низкая уверенность',
  },

  // ─── Likidite seviyeleri ───
  'liq.poor': { en: 'POOR', tr: 'ZAYIF', ru: 'НИЗКАЯ' },
  'liq.weak': { en: 'WEAK', tr: 'YETERSİZ', ru: 'СЛАБАЯ' },
  'liq.ok': { en: 'OK', tr: 'ORTA', ru: 'СРЕДНЯЯ' },
  'liq.good': { en: 'GOOD', tr: 'İYİ', ru: 'ХОРОШАЯ' },
  'liq.strong': { en: 'STRONG', tr: 'GÜÇLÜ', ru: 'СИЛЬНАЯ' },

  // ─── Hacim/likidite oranı etiketleri ───
  'volratio.extreme': { en: 'extreme — pump suspect', tr: 'aşırı yüksek - pump şüphesi', ru: 'экстремальный — подозрение на памп' },
  'volratio.high': { en: 'high activity', tr: 'yüksek aktivite', ru: 'высокая активность' },
  'volratio.normal': { en: 'normal', tr: 'normal', ru: 'нормальная' },
  'volratio.low': { en: 'low activity', tr: 'düşük aktivite', ru: 'низкая активность' },

  // ─── Yaş etiketleri ───
  'age.minutesNew': { en: 'min (very new)', tr: 'dk (çok yeni)', ru: 'мин (очень новый)' },
  'age.minutes': { en: 'min', tr: 'dk', ru: 'мин' },
  'age.hours': { en: 'h', tr: 'saat', ru: 'ч' },
  'age.days': { en: 'd', tr: 'gün', ru: 'дн' },

  // ─── İşlem dengesi ───
  'txn.none': { en: 'No transactions', tr: 'İşlem yok', ru: 'Нет сделок' },
  'txn.balance': { en: 'buys / sells', tr: 'alım / satış', ru: 'покупок / продаж' },

  // ─── Uyarılar ───
  'warn.lowLiq': { en: 'Liquidity very low — high rug-pull risk', tr: 'Likidite çok düşük - rugpull riski yüksek', ru: 'Очень низкая ликвидность — высокий риск рагпулла' },
  'warn.veryNew': { en: 'Token just launched — be careful', tr: 'Token henüz yeni doğdu - dikkatli olun', ru: 'Токен только что запущен — будьте осторожны' },
  'warn.pumpDump': { en: 'Vol/liq ratio extreme — pump-and-dump suspect', tr: 'Hacim/likidite oranı aşırı - pump-dump şüphesi', ru: 'Соотношение объём/ликвидность чрезмерно — подозрение на памп-дамп' },
  'warn.priceDrop': { en: 'Price dropped 50%+ in 24h', tr: 'Fiyat 24s\'te %50+ düştü', ru: 'Цена упала на 50%+ за 24ч' },
  'warn.priceSpike': { en: '200%+ pump in 1h — extremely volatile', tr: '1 saatte %200+ artış - aşırı volatil', ru: 'Рост 200%+ за 1ч — чрезвычайно волатильно' },
  'warn.mintOpen': { en: 'Mint open — owner can issue new tokens', tr: 'Mint açık - sahibi yeni token basabilir', ru: 'Минт открыт — владелец может выпустить новые токены' },
  'warn.singleHolder': { en: 'Single wallet holds {pct}% of supply — rug risk', tr: 'Tek cüzdan supply\'ın %{pct}\'ine sahip - rug riski', ru: 'Один кошелёк держит {pct}% — риск рагпулла' },
  'warn.singleHolderMid': { en: 'Single wallet holds {pct}% of supply', tr: 'Tek cüzdan supply\'ın %{pct}\'ine sahip', ru: 'Один кошелёк держит {pct}%' },
  'warn.top10Concentrated': { en: 'Top 10 wallets hold {pct}% of supply', tr: 'Top 10 cüzdan supply\'ın %{pct}\'ini tutuyor', ru: 'Топ 10 кошельков держат {pct}%' },

  // ─── SCAM ALERT ───
  'scam.title': { en: 'SCAM ALERT', tr: 'SCAM UYARISI', ru: 'ТРЕВОГА: SCAM' },
  'scam.signal': { en: 'danger signal detected!', tr: 'tehlike sinyali tespit edildi!', ru: 'обнаружен опасный сигнал!' },
  'scam.poolRemoved': { en: 'Pool removed (rug pull)', tr: 'Havuz silindi (rug pull)', ru: 'Пул удалён (рагпулл)' },
  'scam.liqDrained': { en: 'Liquidity drained', tr: 'Likidite çekildi', ru: 'Ликвидность выведена' },
  'scam.before': { en: 'Before', tr: 'Önce', ru: 'Было' },
  'scam.now': { en: 'Now', tr: 'Şimdi', ru: 'Сейчас' },
  'scam.stayAway': { en: 'Stay away — you may not be able to sell.', tr: 'Bu tokendan uzak dur, satış yapamayabilirsin.', ru: 'Держитесь подальше — возможно, не сможете продать.' },
  'scam.bannerTitle': { en: 'SCAM DETECTED', tr: 'SCAM TESPİT EDİLDİ', ru: 'ОБНАРУЖЕН SCAM' },

  // ─── RISK ALERT (sarı alan — reply mesajı) ───
  'risk.title': { en: 'RISK ALERT', tr: 'RİSK UYARISI', ru: 'ПРЕДУПРЕЖДЕНИЕ О РИСКЕ' },
  'risk.bannerTitle': { en: 'MEDIUM RISK — VOLATILE TOKEN', tr: 'ORTA RİSK — VOLATİL TOKEN', ru: 'СРЕДНИЙ РИСК — ВОЛАТИЛЬНЫЙ ТОКЕН' },
  'risk.headline': {
    en: '<b>{sym}</b> ({name}) has entered the risk zone.',
    tr: '<b>{sym}</b> ({name}) risk bölgesine girdi.',
    ru: '<b>{sym}</b> ({name}) вошел в зону риска.',
  },
  'risk.liqDrop': { en: 'Liquidity dropped {pct}', tr: 'Likidite {pct} düştü', ru: 'Ликвидность упала на {pct}' },
  'risk.lowLiq': { en: 'Liquidity now: {usd}', tr: 'Güncel likidite: {usd}', ru: 'Текущая ликвидность: {usd}' },
  'risk.noActivity': { en: 'No buys in the last 5 minutes', tr: 'Son 5 dakikada alım yok', ru: 'За последние 5 минут покупок нет' },
  'risk.advice': {
    en: 'The original post has been updated. Trade with caution.',
    tr: 'Orijinal post güncellendi. Dikkatli işlem yapın.',
    ru: 'Исходный пост обновлён. Будьте осторожны при торговле.',
  },

  // ─── RECOVERY (sarı → yeşil) ───
  'recovery.title': { en: 'BACK TO NORMAL', tr: 'TEKRAR NORMAL', ru: 'СТАТУС ВОССТАНОВЛЕН' },
  'recovery.headline': {
    en: '<b>{sym}</b> ({name}) has exited the risk zone.',
    tr: '<b>{sym}</b> ({name}) risk bölgesinden çıktı.',
    ru: '<b>{sym}</b> ({name}) вышел из зоны риска.',
  },
  'recovery.detail': {
    en: 'Trading activity has resumed and liquidity is stable (current: {usd}).',
    tr: 'Alım satım aktivitesi devam ediyor, likidite stabil (güncel: {usd}).',
    ru: 'Торговая активность возобновилась, ликвидность стабильна (текущая: {usd}).',
  },
  'recovery.tracking': {
    en: 'Token is now back on watch — still monitored.',
    tr: 'Token şu an tekrar izlemede — takip ediliyor.',
    ru: 'Токен вернулся под наблюдение — продолжаем отслеживать.',
  },

  // ─── SCAM REPLY (kırmızı — orijinal posta reply mesajı) ───
  'scam.replyHeadline': {
    en: '<b>${sym}</b> ({name}) was rugged.',
    tr: '<b>${sym}</b> ({name}) rug oldu.',
    ru: '<b>${sym}</b> ({name}) выведен в рагпулл.',
  },
  'scam.replyAdvice': {
    en: 'The original post has been marked as SCAM. Do not buy.',
    tr: 'Orijinal post SCAM olarak işaretlendi. Alım yapmayın.',
    ru: 'Исходный пост помечен как SCAM. Не покупайте.',
  },
  'scam.autoDeleteNote': {
    en: '🕒 This SCAM alert is automatically removed after 2 minutes to keep the channel clean.',
    tr: '🕒 Bu SCAM uyarısı kanalı temiz tutmak için 2 dakika sonra otomatik olarak silinir.',
    ru: '🕒 Это SCAM-уведомление автоматически удаляется через 2 минуты.',
  },

  // ─── /scan ───
  'scan.searching': { en: '🔎 Searching for new tokens...', tr: '🔎 Yeni tokenler aranıyor...', ru: '🔎 Поиск новых токенов...' },
  'scan.noResults': { en: 'No new tokens matching your filters right now.', tr: 'Şu an filtrelerine uyan yeni token yok.', ru: 'Сейчас нет новых токенов, соответствующих фильтрам.' },
  'scan.found': { en: 'Found', tr: 'Bulundu', ru: 'Найдено' },

  // ─── /settings ───
  'settings.title': {
    en: '*Channel Command Center*',
    tr: '*Kanal Komuta Merkezi*',
    ru: '*Командный центр канала*',
  },
  'settings.titleDM': { en: '⚙️ Settings', tr: '⚙️ Ayarlar', ru: '⚙️ Настройки' },
  'settings.dashboard.subtitle': {
    en: '_TON · BSC · Solana — filters, risk & channel posts_',
    tr: '_TON · BSC · ◎ Solana — filtre, risk ve kanal paylaşımı_',
    ru: '_TON · BSC · Solana — фильтры, риск и посты в канал_',
  },
  'settings.main.networkRow': {
    en: '*Network & language*',
    tr: '*Ağ ve dil*',
    ru: '*Сеть и язык*',
  },
  'settings.main.overview': {
    en: '*Snapshot*',
    tr: '*Özet*',
    ru: '*Сводка*',
  },
  'settings.intelButton': {
    en: '🧠 Scanner & data layer',
    tr: '🧠 Tarayıcı ve veri katmanı',
    ru: '🧠 Сканер и данные',
  },
  'settings.intel.title': {
    en: '🧠 *Scanner and data layer*',
    tr: '🧠 *Tarayıcı ve veri katmanı*',
    ru: '🧠 *Сканер и слой данных*',
  },
  'settings.intel.body': {
    en:
      '*Live checks (Solana)*\n' +
      '• *DexScreener* — price, liquidity, volume, pool age\n' +
      '• *SPL mint/freeze* — authority flags (RPC / Helius when configured)\n' +
      '• *Holder distribution* — top holder / top 10 concentration\n\n' +
      '*On-chain extras (when available)*\n' +
      '• LP burn / lock hints from pool metadata\n' +
      '• Early-buyer cluster (sybil-style) hints\n\n' +
      '*Posts*\n' +
      '• Risk-coloured cards, then a separate *bot analysis* message (Jupiter, Solscan, DexScreener links)\n\n' +
      '_Information only. Not financial advice — DYOR._',
    tr:
      '*Canlı kontroller (Solana)*\n' +
      '• *DexScreener* — fiyat, likidite, hacim, havuz yaşı\n' +
      '• *SPL mint/freeze* — yetki bayrakları (RPC / Helius yapılandırıldıysa)\n' +
      '• *Holder dağılımı* — en büyük holder / top 10 yoğunluğu\n\n' +
      '*Zincir üstü ekler (veri varsa)*\n' +
      '• LP yakım / kilit ipuçları\n' +
      '• Erken alıcı kümesi (sybil tarzı) ipuçları\n\n' +
      '*Paylaşımlar*\n' +
      '• Risk renkli kartlar, ardından ayrı *bot analizi* (Jupiter, Solscan, DexScreener linkleri)\n\n' +
      '_Bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir — DYOR._',
    ru:
      '*Проверки в реальном времени (Solana)*\n' +
      '• *DexScreener* — цена, ликвидность, объём, возраст пула\n' +
      '• *SPL mint/freeze* — флаги authority (RPC / Helius при настройке)\n' +
      '• *Распределение холдеров* — топ holder / top 10\n\n' +
      '*On-chain (если есть данные)*\n' +
      '• Подсказки по сжиганию / блокировке LP\n' +
      '• Кластеры ранних покупателей (sybil)\n\n' +
      '*Посты*\n' +
      '• Карточки по риску, затем отдельное сообщение *анализа бота* (Jupiter, Solscan, DexScreener)\n\n' +
      '_Только информация. Не финансовый совет — DYOR._',
  },
  'settings.pickChannel': { en: 'Pick a channel to configure:', tr: 'Ayarlamak için bir kanal seç:', ru: 'Выберите канал для настройки:' },
  'settings.noChannels': { en: 'You don\'t have any channels with this bot yet. Add it to a channel first.', tr: 'Henüz bu botun olduğu kanalın yok. Önce bir kanala ekle.', ru: 'У вас пока нет каналов с этим ботом. Сначала добавьте в канал.' },
  'settings.enabled': { en: 'Enabled', tr: 'Aktif', ru: 'Активен' },
  'settings.disabled': { en: 'Disabled', tr: 'Pasif', ru: 'Отключён' },
  'settings.minLiquidity': { en: 'Min. Liquidity', tr: 'Min. Likidite', ru: 'Мин. Ликвидность' },
  'settings.minVolume': { en: 'Min. Volume', tr: 'Min. Hacim', ru: 'Мин. Объём' },
  'settings.maxRisk': { en: 'Max. Risk', tr: 'Maks. Risk', ru: 'Макс. Риск' },
  'settings.minAge': { en: 'Min. Age', tr: 'Min. Yaş', ru: 'Мин. Возраст' },
  'settings.minHolders': { en: 'Min. Holders', tr: 'Min. Holder', ru: 'Мин. Холдеры' },
  'settings.minAuditScore': { en: 'Min. Safety Score', tr: 'Min. Güvenlik Skoru', ru: 'Мин. Балл безопасности' },
  'settings.watchDelay': { en: 'Watch Delay', tr: 'İzleme Gecikmesi', ru: 'Задержка наблюдения' },
  'settings.watchDelayHint': {
    en: '⏳ Tokens will be watched silently for this duration before posting. Only healthy survivors are shared.',
    tr: '⏳ Tokenler bu süre boyunca sessizce izlenir, sağlam çıkanlar paylaşılır.',
    ru: '⏳ Токены будут наблюдаться молча в течение этого времени; публикуются только устойчивые.',
  },
  'settings.groupFilters': { en: '🎯 Filters', tr: '🎯 Filtreler', ru: '🎯 Фильтры' },
  'settings.groupQuality': { en: '🛡 Quality & Safety', tr: '🛡 Kalite & Güvenlik', ru: '🛡 Качество и безопасность' },
  'settings.groupChannel': { en: '📢 Channel', tr: '📢 Kanal', ru: '📢 Канал' },
  'settings.groupDisplay': { en: '🌐 Display', tr: '🌐 Görünüm', ru: '🌐 Отображение' },
  'settings.main.reset': { en: 'Reset', tr: 'Sıfırla', ru: 'Сброс' },
  'settings.main.manualPost': { en: '📤 Manual post', tr: '📤 Manuel paylaş', ru: '📤 Ручной пост' },
  'settings.silent': { en: 'Silent notification', tr: 'Sessiz bildirim', ru: 'Тихие уведомления' },
  // ─ Chain (ağ) seçimi ─
  'settings.chain': { en: '🌐 Network', tr: '🌐 Ağ', ru: '🌐 Сеть' },
  'settings.chain.none': { en: 'not set', tr: 'seçilmedi', ru: 'не выбрана' },
  'settings.chain.menu.title': {
    en: '🌐 *Pick one network for this channel*\nTON, BSC, or ◎ Solana — only tokens on that chain are posted here.',
    tr: '🌐 *Bu kanal için tek ağ seçin*\nTON, BSC veya ◎ Solana — paylaşımlar yalnızca seçtiğiniz ağda.',
    ru: '🌐 *Одна сеть на канал*\nTON, BSC или ◎ Solana — публикации только в выбранной сети.',
  },
  'settings.chain.saved': { en: 'Network saved.', tr: 'Ağ kaydedildi.', ru: 'Сеть сохранена.' },
  'settings.chain.sanitizedMulti': {
    en:
      '⚠️ *Invalid network list*\nSupported: *ton*, *bsc*, *solana* (one per channel). Corrected to *{kept}*. Removed: {removed}.',
    tr:
      '⚠️ *Geçersiz ağ listesi*\nDesteklenen: *ton*, *bsc*, *solana* (kanal başına bir ağ). Düzeltildi: *{kept}*. Silinen: {removed}.',
    ru:
      '⚠️ *Неверный список сетей*\nПоддержка: *ton*, *bsc*, *solana* (одна на канал). Исправлено: *{kept}*. Удалено: {removed}.',
  },
  'settings.chain.required': {
    en: '⚠️ Select a network first (TON, BSC, or ◎ Solana). No posts until confirmed.',
    tr: '⚠️ Önce ağ seçin (TON, BSC veya ◎ Solana). Onaylanana kadar paylaşım yok.',
    ru: '⚠️ Сначала выберите сеть (TON, BSC или ◎ Solana). Без выбора постов не будет.',
  },
  'settings.chain.setupPanel': {
    en: '👇 *Setup:* tap **TON**, **BSC**, or **◎ Solana** under Network.\nOther filters unlock after you pick one.',
    tr: '👇 *Kurulum:* Ağ bölümünden **TON**, **BSC** veya **◎ Solana** seçin.\nSonra filtreleri ayarlayın.',
    ru: '👇 *Настройка:* выберите **TON**, **BSC** или **◎ Solana** в разделе «Сеть».\nЗатем настройте фильтры.',
  },
  'settings.chain.pickFirstAlert': {
    en: 'Pick TON, BSC, or ◎ Solana first.',
    tr: 'Önce TON, BSC veya ◎ Solana seçin.',
    ru: 'Сначала выберите TON, BSC или ◎ Solana.',
  },
  'settings.filterHeader': {
    en: '⚙️ *Configure the bot\'s filter settings*',
    tr: '⚙️ *Botun filtre ayarlamasını yapınız*',
    ru: '⚙️ *Настройте фильтры бота*',
  },
  'settings.language': { en: '🌐 Language', tr: '🌐 Dil', ru: '🌐 Язык' },
  'settings.langSaved': { en: 'Language saved.', tr: 'Dil kaydedildi.', ru: 'Язык сохранён.' },
  'settings.back': { en: '« Back', tr: '« Geri', ru: '« Назад' },
  'settings.close': { en: 'Close', tr: 'Kapat', ru: 'Закрыть' },
  'settings.open': { en: '⚙️ Open Settings (DM)', tr: '⚙️ Ayarları aç (DM)', ru: '⚙️ Открыть настройки (ЛС)' },
  'settings.dmOnly': {
    en: '⚙️ Settings open in *private chat*. Tap *Open Settings (DM)* on the channel welcome message.',
    tr: '⚙️ Ayarlar *özel mesajda* açılır. Kanaldaki *Ayarları aç (DM)* düğmesine basın.',
    ru: '⚙️ Настройки в *личке*. Нажмите *Открыть настройки (ЛС)* в приветствии канала.',
  },

  'settings.panel.current': { en: 'Current', tr: 'Mevcut', ru: 'Текущие' },
  'settings.recommended': { en: 'recommended', tr: 'önerilen', ru: 'реком.' },
  'settings.defaults': { en: 'Defaults', tr: 'Varsayılan', ru: 'По умолчанию' },
  'settings.marketCap': { en: 'Market Cap', tr: 'Piyasa değeri', ru: 'Капитализация' },
  'settings.mcap.minSection': { en: 'Min cap', tr: 'Min cap', ru: 'Мин. кап' },
  'settings.mcap.maxSection': { en: 'Max cap', tr: 'Max cap', ru: 'Макс. кап' },
  'settings.age.minSection': { en: 'Min age', tr: 'Min yaş', ru: 'Мин. возраст' },
  'settings.age.maxSection': { en: 'Max age', tr: 'Max yaş', ru: 'Макс. возраст' },
  'settings.state.off': { en: 'Off', tr: 'Kapalı', ru: 'Выкл' },
  'settings.state.off247': { en: 'Off (24/7)', tr: 'Kapalı (7/24)', ru: 'Выкл (24/7)' },
  'settings.state.on': { en: 'On', tr: 'Açık', ru: 'Вкл' },

  'settings.submenu.liqHint': {
    en: '_Minimum pool TVL in USD. Higher values reduce thin-pool rugs._',
    tr: '_Minimum havuz likiditesi (USD). Yüksek değer ince havuz rug riskini azaltır._',
    ru: '_Минимальная ликвидность пула в USD. Выше — меньше тонких пулов._',
  },
  'settings.submenu.volHint': {
    en: '_Minimum 24h volume. Filters dead or wash-only pools._',
    tr: '_Minimum 24s hacim. Ölü veya sahte hacimli havuzları eler._',
    ru: '_Минимальный объём за 24ч. Отсекает мёртвые пулы._',
  },
  'settings.submenu.ageHint': {
    en: '_Token age window. Narrow window targets fresher launches._',
    tr: '_Token yaş penceresi. Dar aralık daha taze lansmanları hedefler._',
    ru: '_Окно возраста токена. Уже — свежее._',
  },
  'settings.submenu.riskHint': {
    en: '_Max risk tier allowed through the gate. Stricter = fewer yellow/red cards._',
    tr: '_Geçirilecek maks. risk katmanı. Sıkı = daha az sarı/kırmızı kart._',
    ru: '_Макс. допустимый уровень риска. Строже — меньше предупреждений._',
  },
  'settings.submenu.holdersHint': {
    en: '_Minimum holder count from on-chain signals when available._',
    tr: '_Minimum holder sayısı (zincir verisi varsa)._',
    ru: '_Минимум держателей (если есть данные)._',
  },
  'settings.submenu.auditHint': {
    en: '_Minimum internal safety score (0–100). Higher = stricter._',
    tr: '_Minimum dahili güvenlik skoru (0–100). Yüksek = daha sıkı._',
    ru: '_Минимальный балл безопасности (0–100)._',
  },

  'settings.dex.title': { en: '🏛 DEX filter', tr: '🏛 DEX filtresi', ru: '🏛 Фильтр DEX' },
  'settings.dex.hintBsc': {
    en: '_Empty = all Solana DEXes on DexScreener. Check to allow only selected venues._',
    tr: '_Boş = tüm Solana DEX’leri (DexScreener). İşaretlersen sadece seçilenler._',
    ru: '_Пусто = все DEX Solana. Иначе только отмеченные._',
  },
  'settings.dex.hintSol': {
    en: '_Empty = all Solana DEXes on DexScreener. Check to allow only selected venues._',
    tr: '_Boş = tüm Solana DEX’leri (DexScreener). İşaretlersen sadece seçilenler._',
    ru: '_Пусто = все DEX Solana. Иначе только отмеченные._',
  },
  'settings.dex.hintTon': {
    en: '_Empty = both TON DEXes. Check to restrict to one._',
    tr: '_Boş = her iki TON DEX. Daraltmak için işaretle._',
    ru: '_Пусто = оба TON DEX. Иначе только отмеченные._',
  },
  'settings.dex.all': { en: 'All', tr: 'Hepsi', ru: 'Все' },

  'settings.banner.title': { en: '🖼 Banner', tr: '🖼 Banner', ru: '🖼 Баннер' },
  'settings.banner.specs': { en: '📏 720×250 px\n📁 JPG / PNG', tr: '📏 720×250 px\n📁 JPG / PNG', ru: '📏 720×250 px\n📁 JPG / PNG' },
  'settings.banner.uploadBtn': { en: '📤 Upload', tr: '📤 Yükle', ru: '📤 Загрузить' },
  'settings.banner.previewBtn': { en: '👁 Preview', tr: '👁 Önizle', ru: '👁 Просмотр' },
  'settings.banner.removeBtn': { en: '🗑 Remove', tr: '🗑 Kaldır', ru: '🗑 Удалить' },
  'settings.banner.awaitToast': {
    en: '📤 Send a 720×250 JPG or PNG now.',
    tr: '📤 Şimdi 720×250 JPG veya PNG gönderin.',
    ru: '📤 Отправьте JPG или PNG 720×250.',
  },

  'settings.hours.title': { en: '⏰ Active hours', tr: '⏰ Aktif saatler', ru: '⏰ Активные часы' },
  'settings.hours.hint': {
    en: '_Post only inside this window. Helps avoid overnight spam._',
    tr: '_Sadece bu aralıkta paylaş. Gece spam’ını azaltır._',
    ru: '_Публикация только в окне. Меньше ночного спама._',
  },
  'settings.hours.start': { en: 'Start', tr: 'Başlangıç', ru: 'Начало' },
  'settings.hours.end': { en: 'End', tr: 'Bitiş', ru: 'Конец' },
  'settings.hours.tzTr': { en: 'TR (UTC+3)', tr: 'TR (UTC+3)', ru: 'TR (UTC+3)' },
  'settings.hours.tzUtc': { en: 'UTC', tr: 'UTC', ru: 'UTC' },

  'settings.profile.title': { en: '🚀 Quick profile', tr: '🚀 Hızlı profil', ru: '🚀 Быстрый профиль' },
  'settings.profile.desc': {
    en: '_One-tap preset packs. Fine-tune afterwards in submenus._',
    tr: '_Tek dokunuşla hazır paket. Sonra alt menülerden ince ayar._',
    ru: '_Пакет в один тап. Потом донастройка в подменю._',
  },
  'settings.profile.conservative': { en: '🛡 Conservative', tr: '🛡 Muhafazakâr', ru: '🛡 Консервативный' },
  'settings.profile.balanced': { en: '⚖️ Balanced (recommended)', tr: '⚖️ Dengeli (önerilen)', ru: '⚖️ Сбалансированный' },
  'settings.profile.aggressive': { en: '🔥 Aggressive', tr: '🔥 Agresif', ru: '🔥 Агрессивный' },
  'settings.profile.detail.conservative': {
    en: '$5K liq · $2K vol · 50+ holders · audit 70 · mcap $50K–$10M · LP lock on',
    tr: '$5K likidite · $2K hacim · 50+ holder · audit 70 · mcap $50K–$10M · LP kilit zorunlu',
    ru: '$5K ликв. · $2K объём · 50+ холдеров · аудит 70 · кап $50K–$10M · LP lock',
  },
  'settings.profile.detail.balanced': {
    en: '$1.5K liq · $500 vol · 5+ holders · audit 40 · mcap $10K–$5M',
    tr: '$1,5K likidite · $500 hacim · 5+ holder · audit 40 · mcap $10K–$5M',
    ru: '$1.5K ликв. · $500 объём · 5+ холдеров · аудит 40 · кап $10K–$5M',
  },
  'settings.profile.detail.aggressive': {
    en: '$500 liq · $100 vol · audit 20 · wide cap · fast lane',
    tr: '$500 likidite · $100 hacim · audit 20 · geniş cap · hızlı hat',
    ru: '$500 ликв. · $100 объём · аудит 20 · широкий cap',
  },

  'settings.view.activeTitle': { en: '📋 Active filters', tr: '📋 Aktif filtreler', ru: '📋 Активные фильтры' },
  'settings.view.status': { en: 'Status', tr: 'Durum', ru: 'Статус' },
  'settings.view.group.filters': { en: 'Filters', tr: 'Filtreler', ru: 'Фильтры' },
  'settings.view.group.quality': { en: 'Quality', tr: 'Kalite', ru: 'Качество' },
  'settings.view.group.channel': { en: 'Channel', tr: 'Kanal', ru: 'Канал' },
  'settings.view.requireLpShort': { en: 'LP lock required', tr: 'LP kilit zorunlu', ru: 'LP lock' },
  'settings.view.sybil': { en: 'Sybil filter', tr: 'Sybil filtresi', ru: 'Sybil-фильтр' },
  'settings.view.silentShort': { en: 'Silent', tr: 'Sessiz', ru: 'Тихо' },
  'settings.view.hoursShort': { en: 'Active hours', tr: 'Aktif saatler', ru: 'Часы' },
  'settings.view.dexLabel': { en: 'DEX', tr: 'DEX', ru: 'DEX' },
  'settings.view.userbot': { en: 'Userbot', tr: 'Userbot', ru: 'Userbot' },
  'settings.view.allDex': { en: 'all', tr: 'tümü', ru: 'все' },
  'settings.view.h247': { en: '24/7', tr: '7/24', ru: '24/7' },
  'settings.view.ageUnitMinutes': { en: 'm', tr: 'dk', ru: 'мин' },

  'settings.pumpGrad.menuTitle': {
    en: 'Pump.fun graduation',
    tr: 'Pump.fun mezuniyet',
    ru: 'Pump.fun выпуск',
  },
  'settings.pumpGrad.desc': {
    en: '_Pump.fun tokens start on a bonding curve. At 100% the pool migrates to PumpSwap (graduation)._\n_Choose whether to post only graduated tokens, only on-curve, or all._',
    tr: '_Pump.fun tokenleri önce bonding curve’de işlem görür. %100 dolunca havuz PumpSwap’a geçer (mezuniyet)._\n_Sadece mezun olanları, sadece curve’de olanları veya hepsini paylaşmayı seçin._',
    ru: '_Токены Pump.fun сначала на bonding curve. При 100% пул переходит на PumpSwap (выпуск)._\n_Публикуйте только выпущенные, только на кривой или все._',
  },
  'settings.pumpGrad.modeOff': { en: 'Off (all Pump tokens)', tr: 'Kapalı (tümü)', ru: 'Выкл (все)' },
  'settings.pumpGrad.modeGraduated': {
    en: 'Graduated only (100%)',
    tr: 'Sadece mezun (%100)',
    ru: 'Только выпуск (100%)',
  },
  'settings.pumpGrad.modeCurve': {
    en: 'On curve only (before 100%)',
    tr: 'Sadece curve (öncesi)',
    ru: 'Только на кривой',
  },
  'settings.pumpGrad.short': {
    en: 'Pump graduation',
    tr: 'Pump mezuniyet',
    ru: 'Pump выпуск',
  },
  'settings.sybil.menuTitle': { en: 'Sybil filter', tr: 'Sybil filtresi', ru: 'Sybil-фильтр' },
  'settings.sybil.desc': {
    en: '_If early buyers funded from the same wallet exceed this ratio, the token is skipped._\n_Detects coordinated wash / sybil patterns._',
    tr: '_İlk alıcıların aynı cüzdandan fonlanma oranı bu eşiği aşarsa token atlanır._\n_Koordineli wash / sybil paternlerini yakalar._',
    ru: '_Если доля покупателей с одного кошелька выше порога — токен отклоняется._\n_Ловит координированные sybil/wash._',
  },

  'welcome.langPick': {
    en: '👋 Welcome! Which language should we speak?',
    tr: '👋 Hoş geldin! Hangi dilde konuşalim?',
    ru: '👋 Привет! На каком языке будем общаться?',
  },
  'welcome.dexLangPick': {
    en: '👋 *Sniper DEX*\n\nPick your language, then open the app below.',
    tr: '👋 *Sniper DEX*\n\nDilini seç, ardından uygulamayı aç.',
    ru: '👋 *Sniper DEX*\n\nВыберите язык и откройте приложение ниже.',
  },
  'welcome.dexLangPickHtml': {
    en: '<b>🎯 Sniper DEX</b>\nPick a language, then open the app.',
    tr: '<b>🎯 Sniper DEX</b>\nDilini seç, ardından uygulamayı aç.',
    ru: '<b>🎯 Sniper DEX</b>\nВыберите язык и откройте приложение.',
  },
  'welcome.dexStartHtml': {
    en:
      '<b>🎯 Sniper DEX</b>\n\n'
      + 'Trending, charts, risk &amp; alerts — everything is inside the app.\n\n'
      + 'Tap <b>Launch Mini App</b> below (or the menu button).',
    tr:
      '<b>🎯 Sniper DEX</b>\n\n'
      + 'Trending, grafik, risk ve alarmlar uygulamanın içinde.\n\n'
      + 'Aşağıdan <b>Uygulamayı Aç</b> veya menü düğmesine bas.',
    ru:
      '<b>🎯 Sniper DEX</b>\n\n'
      + 'Тренды, графики, риск и алерты — всё в приложении.\n\n'
      + 'Нажмите <b>Открыть Mini App</b> ниже (или кнопку меню).',
  },
  'welcome.langSetHtml': {
    en: '✅ Language: <b>English</b>',
    tr: '✅ Dil: <b>Türkçe</b>',
    ru: '✅ Язык: <b>Русский</b>',
  },
  'welcome.dexBtnLaunch': {
    en: '▶ Launch Mini App',
    tr: '▶ Uygulamayı Aç',
    ru: '▶ Открыть Mini App',
  },
  'welcome.dexBtnChannel': {
    en: '📢 Official feed',
    tr: '📢 Resmi kanal',
    ru: '📢 Официальный канал',
  },
  'welcome.dexBtnLang': {
    en: '🌐 Language',
    tr: '🌐 Dil',
    ru: '🌐 Язык',
  },
  'welcome.dexBtnScanBot': {
    en: '⚙️ Channel scanner bot',
    tr: '⚙️ Kanal tarama botu',
    ru: '⚙️ Бот для канала',
  },
  'welcome.langSet': {
    en: '✅ Language set to English.',
    tr: '✅ Dil Türkçe olarak ayarlandı.',
    ru: '✅ Язык установлен: Русский.',
  },

  // ─── Welcome ───
  'welcome.short': {
    en: 'Sniper Scan — TON, BSC & Solana. I post tokens that pass your channel filters.',
    tr: 'Sniper Scan — TON, BSC ve Solana. Filtrene uyan tokenleri kanala paylaşırım.',
    ru: 'Sniper Scan — TON, BSC и Solana. Публикую токены по вашим фильтрам.',
  },
  'welcome.added': {
    en: '✅ *{name}* is ready.\nTap *Open Settings (DM)* — pick *one* network (TON / BSC / ◎ Solana) and filters.',
    tr: '✅ *{name}* hazır.\n*Ayarları aç (DM)* → kanal için *tek ağ* (TON / BSC / ◎ Solana) ve filtreler.',
    ru: '✅ *{name}* готов.\n*Открыть настройки (ЛС)* → одна сеть (TON / BSC / ◎ Solana) и фильтры.',
  },
  'welcome.dexStart': {
    en: '👋 *Sniper DEX*\n\nTap *Launch Mini App* below — trending, charts & alerts are in the app.',
    tr: '👋 *Sniper DEX*\n\n*Uygulamayı Aç* — liste, grafik ve alarmlar uygulama içinde.',
    ru: '👋 *Sniper DEX*\n\n*Открыть Mini App* — всё внутри приложения.',
  },
  'welcome.start': {
    en:
      '👋 *Sniper Scan Bot*\n\n'
      + 'Scans *TON*, *BSC* and *◎ Solana* — shares tokens that pass your filters to channels where I am admin.\n\n'
      + '*Setup*\n'
      + '1. Add the bot to your channel as *admin*\n'
      + '2. On the channel, tap *Open Settings (DM)*\n'
      + '3. Choose *one network* per channel + filters\n\n'
      + '*Mini App:* *🎯 Sniper DEX* below (official Solana feed & charts)\n\n'
      + '*Commands:* /settings /dex /welcome /post /stats /ping',
    tr:
      '👋 *Sniper Scan Bot*\n\n'
      + '*TON*, *BSC* ve *◎ Solana* tarar — filtrene uyan tokenleri admin olduğum kanallara paylaşır.\n\n'
      + '*Kurulum*\n'
      + '1. Botu kanala *admin* ekle\n'
      + '2. Kanaldaki *Ayarları aç (DM)* düğmesine bas\n'
      + '3. Kanal başına *tek ağ* + filtreleri ayarla\n\n'
      + '*Mini App:* Aşağıda *🎯 Sniper DEX* (resmi Solana listesi & grafik)\n\n'
      + '*Komutlar:* /settings /dex /welcome /post /stats /ping',
    ru:
      '👋 *Sniper Scan Bot*\n\n'
      + 'Сканирует *TON*, *BSC* и *◎ Solana* — публикует токены по фильтрам в каналах, где я админ.\n\n'
      + '*Настройка*\n'
      + '1. Добавьте бота в канал как *админа*\n'
      + '2. В канале: *Открыть настройки (ЛС)*\n'
      + '3. Одна сеть на канал + фильтры\n\n'
      + '*Mini App:* *🎯 Sniper DEX* ниже (лента Solana)\n\n'
      + '*Команды:* /settings /dex /welcome /post /stats /ping',
  },
  'welcome.channelCmd': {
    en: 'ℹ️ /welcome — run in the *channel* (not DM), where the bot is admin.',
    tr: 'ℹ️ /welcome — *kanalda* yazın (DM değil); bot admin olmalı.',
    ru: 'ℹ️ /welcome — только в *канале* (не в ЛС), где бот админ.',
  },
  'welcome.openDex': {
    en: '🎯 Sniper DEX',
    tr: '🎯 Sniper DEX',
    ru: '🎯 Sniper DEX',
  },
  'dex.openHint': {
    en: '🎯 Tap *Launch Mini App* below.',
    tr: '🎯 Aşağıdan *Uygulamayı Aç*.',
    ru: '🎯 Нажмите *Открыть Mini App*.',
  },
  'dex.appOnlyHint': {
    en: 'ℹ️ Lists, filters & alerts are in the *Mini App* — tap the button below.\n\n_Channel scanner (separate bot):_ @solanachainscanbot',
    tr: 'ℹ️ Liste, filtre ve alarmlar *Mini App* içinde — aşağıdaki düğmeye bas.\n\n_Kanal tarayıcı (ayrı bot):_ @solanachainscanbot',
    ru: 'ℹ️ Списки и алерты в *Mini App* — кнопка ниже.\n\n_Сканер канала:_ @solanachainscanbot',
  },
  'dex.channelBotHint': {
    en: 'ℹ️ Channel filters & auto-posts: @solanachainscanbot\n\nFor the DEX feed, open the Mini App below.',
    tr: 'ℹ️ Kanal filtresi & otomatik paylaşım: @solanachainscanbot\n\nDEX listesi için Mini App\'i aç.',
    ru: 'ℹ️ Фильтры канала: @solanachainscanbot\n\nЛента DEX — Mini App ниже.',
  },

  // ─── Komutlar ───
  'cmd.adminOnly': { en: '⛔ Only admins can use this command.', tr: '⛔ Bu komutu sadece yönetici kullanabilir.', ru: '⛔ Только администраторы могут использовать эту команду.' },
  'cmd.adminOnlyShort': { en: '⛔ Admin only', tr: '⛔ Sadece yönetici', ru: '⛔ Только админы' },
  'cmd.notChannelAdmin': {
    en: '⛔ Not a channel admin (use the Telegram account that manages the channel). Bot owner: set ADMIN_USER_ID on Railway.',
    tr: '⛔ Bu kanalın yöneticisi değilsin (kanalı yöneten Telegram hesabıyla dene). Bot sahibi: Railway’de ADMIN_USER_ID.',
    ru: '⛔ Вы не админ канала. Владелец бота: ADMIN_USER_ID в Railway.',
  },
  'cmd.channelNotFound': { en: '❌ Channel not found. Make sure the bot was added to your channel as admin.', tr: '❌ Kanal bulunamadı. Botu kanalına admin olarak eklediğinden emin ol.', ru: '❌ Канал не найден. Убедитесь, что бот добавлен в канал как администратор.' },
  'cmd.scanRunning': { en: '⏳ A scan is already running.', tr: '⏳ Zaten tarama sürüyor.', ru: '⏳ Сканирование уже выполняется.' },
  'cmd.scanStarting': { en: '🔍 Starting manual scan...', tr: '🔍 Manuel tarama başlatılıyor...', ru: '🔍 Запуск ручного сканирования...' },
  'cmd.scanDone': { en: '✅ *Scan complete*', tr: '✅ *Tarama tamamlandı*', ru: '✅ *Сканирование завершено*' },
  'cmd.scanFound': { en: 'Found', tr: 'Bulunan', ru: 'Найдено' },
  'cmd.scanShared': { en: 'Tokens shared', tr: 'Paylaşılan token', ru: 'Поделились токенами' },
  'cmd.scanMessages': { en: 'Total messages', tr: 'Toplam mesaj', ru: 'Всего сообщений' },
  'cmd.scanActiveChannels': { en: 'Active channels', tr: 'Aktif kanal', ru: 'Активные каналы' },
  'cmd.scanSkipped': { en: 'Skipped', tr: 'Görülmüş', ru: 'Пропущено' },
  'cmd.scanErrors': { en: 'Errors', tr: 'Hata', ru: 'Ошибки' },
  'cmd.statsTitle': { en: '*Statistics*', tr: '*İstatistikler*', ru: '*Статистика*' },
  'cmd.statsTotalShared': { en: 'Total shared', tr: 'Toplam paylaşılan', ru: 'Всего поделились' },
  'cmd.statsChannels': { en: 'Registered channels', tr: 'Kayıtlı kanal', ru: 'Зарегистрированные каналы' },
  'cmd.statsActive': { en: 'active', tr: 'aktif', ru: 'активны' },
  'cmd.statsUptime': { en: 'Uptime', tr: 'Çalışma', ru: 'Аптайм' },
  'cmd.pickChannel': { en: '⚙️ Pick the channel/group you want to configure:', tr: '⚙️ Hangi kanal/grup için ayar yapacağını seç:', ru: '⚙️ Выберите канал/группу для настройки:' },
  'cmd.settingsFor': { en: '⚙️ Settings for *{name}*:', tr: '⚙️ *{name}* için ayarlar:', ru: '⚙️ Настройки для *{name}*:' },
  'cmd.bannerSaved': { en: '✅ Banner saved. Future token cards will use this image.', tr: '✅ Banner kaydedildi. Bundan sonraki token kartları bu görselle gelecek.', ru: '✅ Баннер сохранён. Будущие карточки токенов будут использовать это изображение.' },
  'cmd.bannerAdminOnly': { en: '⛔ Only admins can set the banner.', tr: '⛔ Sadece yönetici banner ayarlayabilir.', ru: '⛔ Только администратор может установить баннер.' },
  'cmd.bannerSendFailed': { en: '❌ Could not send banner: {err}', tr: '❌ Banner gönderilemedi: {err}', ru: '❌ Не удалось отправить баннер: {err}' },
  'cmd.bannerPreview': { en: '👁 Banner preview', tr: '👁 Banner önızlemesi', ru: '👁 Предпросмотр баннера' },
  'cmd.bannerPrompt': {
    en: '📤 Send a photo here to set the channel banner.',
    tr: '📤 Kanal bannerı için buraya fotoğraf gönderin.',
    ru: '📤 Отправьте фото сюда для баннера канала.',
  },
  'settings.banner.none': {
    en: 'No custom banner set yet.',
    tr: 'Henüz özel banner yok.',
    ru: 'Пользовательский баннер не задан.',
  },
  'cmd.noChannelPicked': { en: '⚠️ No channel selected, start with /settings', tr: '⚠️ Kanal seçilmedi, /settings ile başla', ru: '⚠️ Канал не выбран, начните с /settings' },
  'cmd.closed': { en: '✖ Closed', tr: '✖ Kapatıldı', ru: '✖ Закрыто' },
  'cmd.error': { en: '❌ Error', tr: '❌ Hata', ru: '❌ Ошибка' },

  // ─── /post (manuel paylaşım) ───
  'post.usage': {
    en: 'Usage: <code>/post MINT_OR_LINK</code>\n• Solana mint\n• DexScreener / Gecko <b>solana</b> link\n• <code>pump.fun/coin/MINT</code>\n• Solscan token link',
    tr: 'Kullanım: <code>/post MINT_VEYA_LINK</code>\n• Solana mint\n• DexScreener / Gecko <b>solana</b> linki\n• <code>pump.fun/coin/MINT</code>\n• Solscan token linki',
    ru: 'Использование: <code>/post MINT_ИЛИ_ССЫЛКА</code>\n• Mint Solana\n• DexScreener / Gecko <b>solana</b>\n• <code>pump.fun/coin/MINT</code>\n• Solscan',
  },
  'post.wrongChain': {
    en: '❌ Token network <code>{chain}</code> does not match this channel. Pick TON / BSC / ◎ Solana in channel settings.',
    tr: '❌ Token ağı <code>{chain}</code> bu kanalla uyuşmuyor. Kanal ayarlarında TON / BSC / ◎ Solana seçili olmalı.',
    ru: '❌ Сеть токена <code>{chain}</code> не совпадает с каналом. Выберите TON / BSC / ◎ Solana в настройках.',
  },
  'post.fetching': { en: '🔍 Fetching token data...', tr: '🔍 Token verisi alınıyor...', ru: '🔍 Получение данных токена...' },
  'post.notFound': {
    en: '❌ Token or pool not found on Solana. Check mint, DexScreener solana link, or pump.fun URL.',
    tr: '❌ Solana üzerinde token/havuz bulunamadı. Mint, DexScreener solana linki veya pump.fun adresini kontrol edin.',
    ru: '❌ Токен/пул на Solana не найден. Проверьте mint, ссылку DexScreener solana или pump.fun.',
  },
  'post.pickChannel': { en: '📤 Which channel should I post to?', tr: '📤 Hangi kanala gönderilsin?', ru: '📤 В какой канал отправить?' },
  'post.allChannels': { en: '📢 All channels', tr: '📢 Tüm kanallar', ru: '📢 Все каналы' },
  'post.filterFail': { en: '⛔ Token didn\'t pass channel filter: {reason}', tr: '⛔ Token kanal filtresine takıldı: {reason}', ru: '⛔ Токен не прошёл фильтр канала: {reason}' },
  'post.sent': { en: '✅ Posted to {count} channel(s).', tr: '✅ {count} kanala gönderildi.', ru: '✅ Отправлено в {count} канал(ов).' },
  'post.allFiltered': { en: '⚠️ No channel accepted this token (all filtered out).', tr: '⚠️ Hiçbir kanal bu tokeni kabul etmedi (hepsi filtreye takıldı).', ru: '⚠️ Ни один канал не принял токен (все отфильтрованы).' },

  // ─── Etc ───
  'common.yes': { en: 'Yes', tr: 'Evet', ru: 'Да' },
  'common.no': { en: 'No', tr: 'Hayır', ru: 'Нет' },
  'common.on': { en: 'ON', tr: 'AÇIK', ru: 'ВКЛ' },
  'common.off': { en: 'OFF', tr: 'KAPALI', ru: 'ВЫКЛ' },

  // ─── Reply Notifier (renk geçiş bildirimi) ───
  // CTA: Tüm renk geçişlerinde 2. satır. {symbol} = $TOKENSEMBOLU
  'replyNotify.cta': {
    en: 'Click this reply → go to {symbol} post, check the stats 👆',
    tr: 'Bu cevaplamaya tıklayın → {symbol} postuna gidin, istatistikleri inceleyin 👆',
    ru: 'Нажмите на этот ответ → перейдите к посту {symbol}, проверьте статистику 👆',
  },
  // Bot Analizi takip mesajı — canlı veri yokken kartla hizalamak için
  'analysis.staleNote': {
    en: 'Live data could not be refreshed; this block reflects the current alert level only.',
    tr: 'Canlı veri alınamadı; bu blok yalnızca güncel uyarı seviyesine göre güncellendi.',
    ru: 'Не удалось обновить данные; блок отражает только текущий уровень предупреждения.',
  },
  'analysis.recoveredNote': {
    en: 'Liquidity looks stable again — card returned to green. Keep monitoring.',
    tr: 'Likidite yeniden istikrarlı görünüyor — kart yeşile döndü. Takibe devam.',
    ru: 'Ликвидность снова стабильна — карта зелёная. Продолжайте наблюдение.',
  },

  'replyNotify.roleEarly': {
    en: 'EARLY ALERT (level)',
    tr: 'ERKEN UYARI (seviye)',
    ru: 'РАННЕЕ ПРЕДУПРЕЖДЕНИЕ (уровень)',
  },
  'replyNotify.roleDefinitive': {
    en: 'CONFIRMED STATUS',
    tr: 'KESİN DURUM',
    ru: 'ПОДТВЕРЖДЁННЫЙ СТАТУС',
  },
  'replyNotify.warnYellowToRed': {
    en: 'Liquidity risk: token moved from yellow to red level — act early.',
    tr: 'Likidite riski: token sarı seviyeden kırmızı (rug) seviyesine düştü — erken kontrol edin.',
    ru: 'Риск ликвидности: токен перешёл с жёлтого на красный уровень — проверьте срочно.',
  },
  'replyNotify.warnGreenToRed': {
    en: 'Liquidity risk: token jumped from green to red level — act early.',
    tr: 'Likidite riski: token yeşilden doğrudan kırmızı (rug) seviyesine düştü — erken kontrol edin.',
    ru: 'Риск ликвидности: токен сразу с зелёного на красный уровень — проверьте срочно.',
  },
  // SCAM özel mesajı — reply'da 2. satır olarak gösterilir
  'replyNotify.scam': {
    en: 'Liquidity drained — stay away',
    tr: 'Likidite çekildi — uzak durun',
    ru: 'Ликвидность выведена — держитесь подальше',
  },
  // SCAM özel mesajı — reply'da 3. satır (2 dk sonra silinecek uyarısı)
  'replyNotify.scamDelete': {
    en: 'Post will be deleted in 2 minutes',
    tr: 'Post 2 dakika sonra silinecek',
    ru: 'Пост будет удалён через 2 минуты',
  },
};

const SUPPORTED = ['en', 'tr', 'ru'];

/** Varsayılan bot dili — kullanıcı ayarlardan seçene kadar İngilizce. */
function getBotDefaultLang() {
  return 'en';
}

const DEFAULT_LANG = 'en';

function normalizeLang(lang) {
  if (!lang) return DEFAULT_LANG;
  const l = String(lang).toLowerCase().slice(0, 2);
  return SUPPORTED.includes(l) ? l : DEFAULT_LANG;
}

/**
 * t('key', 'tr', { pct: 30 })
 *  - placeholder: "{pct}" → 30
 *  - fallback to 'en' if missing
 */
function t(key, lang, vars) {
  const l = normalizeLang(lang);
  const entry = STRINGS[key];
  if (!entry) return key;
  let s = entry[l] ?? entry[DEFAULT_LANG] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

function langName(lang) {
  return { en: 'English 🇬🇧', tr: 'Türkçe 🇹🇷', ru: 'Русский 🇷🇺' }[normalizeLang(lang)] || 'English 🇬🇧';
}

module.exports = {
  t, normalizeLang, langName, SUPPORTED, DEFAULT_LANG, getBotDefaultLang,
};
