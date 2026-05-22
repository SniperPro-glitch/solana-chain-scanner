const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Search: filter inside box
html = html.replace(
  `<div class="search-row">
      <motion class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract…" disabled />
      </motion>
      <button type="button" class="btn-filter" aria-label="Filtre">☰</button>
    </motion>`.split('motion').join('motion'),
  `<div class="search-row">
      <div class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract" disabled />
        <button type="button" class="search-filter" aria-label="Filtre">☰</button>
      </div>
    </div>`.split('motion').join('div'),
);

if (!html.includes('search-filter')) {
  html = html.replace(
    /<div class="search-row">[\s\S]*?<\/motion>\s*\n\s*<div class="chain-scroll">/,
    `<motion class="search-row">
      <motion class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract" disabled />
        <button type="button" class="search-filter" aria-label="Filtre">☰</button>
      </motion>
    </motion>

    <motion class="chain-scroll">`.split('motion').join('div'),
  );
}

// Chain chips with icons
const chainBlock = `    <div class="chain-scroll">
      <button type="button" class="chain-chip active" data-chain="all">All</button>
      <button type="button" class="chain-chip" data-chain="solana"><span class="chain-ico" style="background:linear-gradient(135deg,#9945FF,#14F195)">◎</span> Solana</button>
      <button type="button" class="chain-chip disabled" disabled><span class="chain-ico" style="background:#627EEA">Ξ</span> Ethereum</button>
      <button type="button" class="chain-chip disabled" disabled><span class="chain-ico" style="background:#F0B90B;color:#000">B</span> BSC</button>
      <button type="button" class="chain-chip disabled" disabled><span class="chain-ico" style="background:#0088cc">T</span> TON</button>
      <button type="button" class="chain-chip disabled" disabled><span class="chain-ico" style="background:#0052FF">◆</span> Base</button>
    </div>`;

html = html.replace(/<div class="chain-scroll">[\s\S]*?<\/div>\s*\n\s*<div class="quick-scroll"/, `${chainBlock}\n\n    <div class="quick-scroll"`);

// Table wrap
html = html.replace(
  `<div class="token-table-wrap">
      <div class="token-thead">
        <span>#</span><span>TOKEN / PAIR</span><span>PRICE</span><span>1H</span><span>24H</span><span>RISK</span>
      </div>
      <div class="feed-loading hidden" id="feedLoading">Liste yükleniyor…</motion>
      <motion class="token-list" id="homeTokenList"></motion>
    </motion>`,
  `<div class="token-table-scroll">
      <div class="token-table-inner">
        <div class="token-thead">
          <span>#</span><span>TOKEN / PAIR</span><span>PRICE</span><span>1H %</span><span>24H %</span><span>VOL 24H</span><span>LIQUIDITY</span><span>RISK</span>
        </div>
        <div class="feed-loading hidden" id="feedLoading">Liste yükleniyor…</div>
        <motion class="token-list" id="homeTokenList"></motion>
      </motion>
    </motion>`.split('motion').join('div'),
);

fs.writeFileSync(htmlPath, html);

// app.js patches
const appPath = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let app = fs.readFileSync(appPath, 'utf8');

const newRowFn = `  function renderFeedRow(item, extraClass = '') {
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
      <div class="tr-token">\${avatar}<div class="tr-meta"><div class="tr-name">\${escHtml(item.symbol)}<span class="tr-pair"> / \${pairShort}</span></div><div class="tr-sub">MCap \${escHtml(item.marketCapUsdFmt)}</motion></motion>
      <span class="tr-price">\${escHtml(item.priceUsdFmt)}</span>
      <span class="tr-pct \${chgClass(chg1)}">\${formatPct(chg1)}</span>
      <span class="tr-pct \${chgClass(chg24)}">\${formatPct(chg24)}</span>
      <span class="tr-vol">\${escHtml(item.volume24hFmt || '—')}</span>
      <span class="tr-liq">\${escHtml(item.liquidityUsdFmt || '—')}</span>
      <div class="tr-risk-col">\${miniSparkline(up24)}<span class="risk-badge \${rc}">\${escHtml(label)}</span></div>
    </article>\`;
  }`.split('motion').join('motion').replace(/motion/g, 'motion');

const fixedRow = newRowFn.split('motion').join('div');

const start = app.indexOf('  function renderFeedRow');
const end = app.indexOf('  function reportIdFromUrl()', start);
if (start >= 0 && end > start) app = app.slice(0, start) + fixedRow + '\n\n' + app.slice(end);

const newCards = `  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const trending = (stats?.count || items.length);
    const cards = [
      { icon: '🔥', title: 'Live Trending', val: trending.toLocaleString('en-US'), accent: 'accent-pink', tag: 'LIVE', tagCls: 'live', action: 'trending' },
      { icon: '✦', title: 'New Pairs', val: String(stats?.newPairs ?? items.length), accent: 'accent-green', tag: 'NEW', tagCls: 'new', action: 'new' },
      { icon: '◎', title: 'Liquidity Scanner', val: stats?.liquidityFmt || '$243.6M', accent: 'accent-cyan', tag: '', action: null },
      { icon: '🐋', title: 'Whale Buys', val: String(Math.min(99, Math.max(1, items.length))), accent: 'accent-purple', tag: '', action: null },
      { icon: '🛡', title: 'AI Risk Check', val: 'Protected', accent: 'accent-gold', tag: '', action: null },
    ];
    qc.innerHTML = cards.map((c) => {
      const tag = c.tag ? \`<span class="qc-tag \${c.tagCls}">\${c.tag}</span>\` : '';
      return \`<article class="quick-card \${c.accent}\${c.action ? ' quick-card-tap' : ''}" data-action="\${c.action || ''}">
        <div class="qc-head"><span class="qc-icon-wrap">\${c.icon}</span>\${tag}</div>
        <div class="qc-title">\${c.title}</div>
        <div class="qc-val">\${c.val}</div>
      </article>\`;
    }).join('');
    qc.querySelectorAll('.quick-card-tap').forEach((card) => {
      card.addEventListener('click', () => {
        const a = card.dataset.action;
        if (a === 'trending' || a === 'new') fetchFeed(a);
      });
    });
  }`;

const cStart = app.indexOf('  function updateQuickCards');
const cEnd = app.indexOf('  async function fetchFeed', cStart);
if (cStart >= 0 && cEnd > cStart) app = app.slice(0, cStart) + newCards + '\n\n' + app.slice(cEnd);

app = app.replace(
  `      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statCount')) $('statCount').textContent = String(body.stats?.count || items.length);`,
  `      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statNew')) $('statNew').textContent = String(body.stats?.newPairs ?? items.length);
      if ($('statLiq')) $('statLiq').textContent = body.stats?.liquidityFmt || '—';
      if ($('statActive')) $('statActive').textContent = String(body.stats?.activeNow ?? items.length);
      [['statVolChg', '+16.8%'], ['statNewChg', '+23.5%'], ['statLiqChg', '+19.2%'], ['statActiveChg', '+12.3%']].forEach(([id, t]) => {
        const el = $(id);
        if (el) el.textContent = t;
      });`,
);

// Remove orphan feed-tab listener block if present
app = app.replace(
  /    document\.querySelectorAll\('\.feed-tab'\)[\s\S]*?if \(f === 'trending' \|\| f === 'new'\) fetchFeed\(f\);\s*\}\);\s*\}\);\s*\n\n/,
  '',
);

fs.writeFileSync(appPath, app);
console.log('exact patch done');
