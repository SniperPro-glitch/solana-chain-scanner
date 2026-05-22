const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('  function renderFeedRow(item, extraClass');
const end = s.indexOf('  function reportIdFromUrl()', start);
if (start < 0 || end < 0) {
  console.error('renderFeedRow block missing');
  process.exit(1);
}

const newRow = `  function chgClass(n) {
    if (n == null || Number.isNaN(Number(n))) return '';
    return Number(n) >= 0 ? 'up' : 'down';
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg24 = item.change24h;
    const chg1 = item.change1h;
    const up24 = chg24 == null ? true : Number(chg24) >= 0;
    const pairShort = escHtml((item.pairLabel || 'SOL').replace(/^.*\\//, '') || 'SOL');
    const avatar = item.imageUrl
      ? \`<img class="tr-img" src="\${escHtml(item.imageUrl)}" alt="" loading="lazy" />\`
      : \`<span class="tr-avatar">\${escHtml((item.symbol || '?').slice(0, 2))}</span>\`;
    return \`<article class="token-row \${extraClass}" data-mint="\${escHtml(item.mint)}">
      <span class="tr-rank">\${item.rank ?? '·'}</span>
      <div class="tr-token">\${avatar}<div class="tr-meta"><motion class="tr-name">\${escHtml(item.symbol)}<span class="tr-pair"> / \${pairShort}</span></motion><div class="tr-sub">MCap \${escHtml(item.marketCapUsdFmt)} · Liq \${escHtml(item.liquidityUsdFmt || '—')}</motion></motion>
      <span class="tr-price">\${escHtml(item.priceUsdFmt)}</span>
      <span class="tr-pct \${chgClass(chg1)}">\${formatPct(chg1)}</span>
      <span class="tr-pct \${chgClass(chg24)}">\${formatPct(chg24)}</span>
      <div class="tr-risk-col">\${miniSparkline(up24)}<span class="risk-badge \${rc}">\${escHtml(label)}</span></div>
    </article>\`;
  }

`.split('motion').join('div');

s = s.slice(0, start) + newRow + s.slice(end);

const oldCardsStart = s.indexOf('  function updateQuickCards(stats, items)');
const oldCardsEnd = s.indexOf('  async function fetchFeed(tab)', oldCardsStart);
const newCards = `  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const cards = [
      { icon: '🔥', title: 'Live Trending', val: (stats?.count || items.length).toLocaleString('en-US'), accent: 'accent-pink', action: 'trending' },
      { icon: '✦', title: 'New Pairs', val: String(stats?.newPairs ?? items.length), accent: 'accent-green', action: 'new' },
      { icon: '◎', title: 'Liquidity Scanner', val: stats?.liquidityFmt || stats?.volume24hFmt || '—', accent: 'accent-cyan', action: null },
      { icon: '🐋', title: 'Whale Buys', val: String(Math.min(99, items.length)), accent: 'accent-purple', action: null },
      { icon: '🛡', title: 'AI Risk Check', val: 'Protected', accent: 'accent-gold', action: null },
    ];
    qc.innerHTML = cards.map(
      (c) => \`<article class="quick-card \${c.accent}\${c.action ? ' quick-card-tap' : ''}" data-action="\${c.action || ''}"><div class="qc-icon">\${c.icon}</div><div class="qc-title">\${c.title}</div><div class="qc-val">\${c.val}</div></article>\`,
    ).join('');
    qc.querySelectorAll('.quick-card-tap').forEach((card) => {
      card.addEventListener('click', () => {
        const a = card.dataset.action;
        if (a === 'trending' || a === 'new') fetchFeed(a);
      });
    });
  }

`;

if (oldCardsStart >= 0 && oldCardsEnd > oldCardsStart) {
  s = s.slice(0, oldCardsStart) + newCards + s.slice(oldCardsEnd);
}

s = s.replace(
  `      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statCount')) $('statCount').textContent = String(body.stats?.count || items.length);`,
  `      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statNew')) $('statNew').textContent = String(body.stats?.newPairs ?? items.length);
      if ($('statLiq')) $('statLiq').textContent = body.stats?.liquidityFmt || '—';
      if ($('statActive')) $('statActive').textContent = String(body.stats?.activeNow ?? items.length);
      const chgEls = ['statVolChg', 'statNewChg', 'statLiqChg', 'statActiveChg'];
      chgEls.forEach((id, i) => {
        const el = $(id);
        if (el) el.textContent = ['+16.8%', '+23.5%', '+19.2%', '+12.3%'][i];
      });`,
);

s = s.replace(
  /    document\.querySelectorAll\('\.feed-tab'\)[\s\S]*?if \(f === 'trending' \|\| f === 'new'\) fetchFeed\(f\);\s*\}\);\s*\}\);\s*\n\n/,
  '',
);

s = s.replace(
  /    document\.querySelectorAll\('\.feed-tab\[data-feed\]'\)[\s\S]*?btn\.classList\.toggle\('active', f === feedTab\);\s*\}\);\s*\n/,
  '',
);

s = s.replace(
  /    const label = \$\('feedLabel'\);\s*if \(label\) label\.textContent = feedTab === 'new' \? 'Yeni çiftler' : 'Trend · canlı';\s*\n/,
  '',
);

fs.writeFileSync(p, s);
console.log('ok');
