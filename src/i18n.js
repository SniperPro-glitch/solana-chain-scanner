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
  'card.safetyWord': { en: 'safety', tr: 'güven', ru: 'безоп.' },

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
    en: '_Early listings · Live risk signals · Your filter rules_',
    tr: '_Erken listeler · Canlı risk sinyalleri · Senin filtre kuralların_',
    ru: '_Ранние листинги · Сигналы риска · Ваши правила фильтра_',
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
    en: '🌐 *Select the network this channel will listen to*\nThe bot posts tokens only from the selected network.',
    tr: '🌐 *Bu kanalın dinleyeceği ağı seçin*\nBot sadece seçtiğiniz ağdaki tokenleri paylaşır.',
    ru: '🌐 *Выберите сеть для этого канала*\nБот публикует токены только из выбранной сети.',
  },
  'settings.chain.saved': { en: 'Network saved.', tr: 'Ağ kaydedildi.', ru: 'Сеть сохранена.' },
  'settings.chain.sanitizedMulti': {
    en:
      '⚠️ *Invalid network list*\nThis bot supports *Solana only*. The channel list was corrected to *{kept}*. Removed: {removed}.\n_(In channels.json use: ["solana"].)_',
    tr:
      '⚠️ *Geçersiz ağ listesi*\nBu bot *yalnızca Solana* destekler. Kanal listesi *{kept}* olarak düzeltildi. Silinenler: {removed}.\n_(channels.json: ["solana"])_',
    ru:
      '⚠️ *Неверный список сетей*\nБот поддерживает *только Solana*. Список исправлен на *{kept}*. Удалено: {removed}.\n_(В channels.json: ["solana"].)_',
  },
  'settings.chain.required': {
    en: '⚠️ Solana network must be enabled for this channel.',
    tr: '⚠️ Bu kanal için Solana ağı etkin olmalıdır.',
    ru: '⚠️ Для этого канала должна быть включена сеть Solana.',
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
  'settings.open': { en: '⚙️ Open Settings (DM)', tr: '⚙️ Ayarları aç (DM)', ru: '⚙️ Настройки (ЛС)' },

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
  'welcome.langSet': {
    en: '✅ Language set to English.',
    tr: '✅ Dil Türkçe olarak ayarlandı.',
    ru: '✅ Язык установлен: Русский.',
  },

  // ─── Welcome ───
  'welcome.short': {
    en: 'Hi! I scan new Solana tokens and post the ones that pass your filters.',
    tr: 'Selam! Solana’daki yeni tokenleri tarayıp filtrene uyanları yayınlıyorum.',
    ru: 'Привет! Я сканирую новые токены Solana и публикую те, что проходят ваши фильтры.',
  },
  'welcome.added': {
    en: '✅ *{name}* — successfully added.\n\nManage settings using the button below.',
    tr: '✅ *{name}* — başarıyla eklendim.\n\nAyarları aşağıdaki butondan yönet.',
    ru: '✅ *{name}* — успешно добавлен.\n\nНастройки управляются кнопкой ниже.',
  },
  'welcome.start': {
    en: '👋 *Solana Chain Scanner*\n\nI automatically discover and audit new tokens on the Solana network and share them with the channels/groups I am added to.\n\n*Quick start:*\n1. Add me to your channel as admin\n2. Tap the *“Open Settings”* button when I send the welcome message\n3. Configure your filters there\n\n*Commands:* /settings /ping /stats /post',
    tr: '👋 *Solana Chain Scanner*\n\nSolana ağındaki yeni tokenleri otomatik olarak bulup denetler ve eklendiğim kanal/gruplara paylaşırım.\n\n*Hızlı başlangıç:*\n1. Bu botu kanalına admin olarak ekle\n2. Eklendiğimde gelen mesajdaki *“Ayarları aç”* butonuna bas\n3. Buradan ayarları düzenle\n\n*Komutlar:* /settings /ping /stats /post',
    ru: '👋 *Solana Chain Scanner*\n\nЯ автоматически нахожу и проверяю новые токены в сети Solana и делюсь ими в каналах/группах, куда меня добавили.\n\n*Быстрый старт:*\n1. Добавьте меня в канал как администратора\n2. Нажмите кнопку *«Открыть настройки»* в приветственном сообщении\n3. Настройте фильтры\n\n*Команды:* /settings /ping /stats /post',
  },

  // ─── Komutlar ───
  'cmd.adminOnly': { en: '⛔ Only admins can use this command.', tr: '⛔ Bu komutu sadece yönetici kullanabilir.', ru: '⛔ Только администраторы могут использовать эту команду.' },
  'cmd.adminOnlyShort': { en: '⛔ Admin only', tr: '⛔ Sadece yönetici', ru: '⛔ Только админы' },
  'cmd.notChannelAdmin': { en: '⛔ You are not an admin of this channel.', tr: '⛔ Bu kanalın yöneticisi değilsin.', ru: '⛔ Вы не администратор этого канала.' },
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
  'cmd.noChannelPicked': { en: '⚠️ No channel selected, start with /settings', tr: '⚠️ Kanal seçilmedi, /settings ile başla', ru: '⚠️ Канал не выбран, начните с /settings' },
  'cmd.closed': { en: '✖ Closed', tr: '✖ Kapatıldı', ru: '✖ Закрыто' },
  'cmd.error': { en: '❌ Error', tr: '❌ Hata', ru: '❌ Ошибка' },

  // ─── /post (manuel paylaşım) ───
  'post.usage': {
    en: 'Usage: <code>/post &lt;link or contract address&gt;</code>\n\nExample:\n<code>/post EQAbc...xyz</code>',
    tr: 'Kullanım: <code>/post &lt;link veya kontrat adresi&gt;</code>\n\nÖrnek:\n<code>/post EQAbc...xyz</code>',
    ru: 'Использование: <code>/post &lt;ссылка или адрес контракта&gt;</code>\n\nПример:\n<code>/post EQAbc...xyz</code>',
  },
  'post.fetching': { en: '🔍 Fetching token data...', tr: '🔍 Token verisi alınıyor...', ru: '🔍 Получение данных токена...' },
  'post.notFound': { en: '❌ Token or pool not found. Make sure the link/address is valid.', tr: '❌ Token veya havuz bulunamadı. Link/adresin doğru olduğundan emin ol.', ru: '❌ Токен или пул не найден. Убедитесь, что ссылка/адрес верны.' },
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

module.exports = { t, normalizeLang, langName, SUPPORTED, DEFAULT_LANG };
