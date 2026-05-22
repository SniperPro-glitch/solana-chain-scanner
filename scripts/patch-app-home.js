const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');

const marker = '  const DEMO_ROWS = [';
if (!s.includes(marker)) {
  console.error('DEMO_ROWS not found');
  process.exit(1);
}
if (s.includes('async function fetchFeed')) {
  console.log('already patched app.js');
  process.exit(0);
}

const start = s.indexOf(marker);
const end = s.indexOf('  function reportIdFromUrl()', start);
if (end < 0) {
  console.error('reportIdFromUrl not found');
  process.exit(1);
}

const insert = `  let feedTab = 'trending';
  let homeShellBound = false;
  let feedPollTimer = null;

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const x = Number(n);
    return \`\${x >= 0 ? '+' : ''}\${x.toFixed(1)}%\`;
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg = item.change24h;
    const up = chg == null ? true : Number(chg) >= 0;
    const avatar = item.imageUrl
      ? \`<img class="tr-img" src="\${escHtml(item.imageUrl)}" alt="" loading="lazy" />\`
      : \`<span class="tr-avatar">\${escHtml((item.symbol || '?').slice(0, 2))}</span>\`;
    return \`<article class="token-row \${extraClass}" data-mint="\${escHtml(item.mint)}">
      <span class="tr-rank">\${item.rank ?? '·'}</span>
      \${avatar}
      <motion class="tr-info"><h3>\${escHtml(item.symbol)}</h3><p>MCap \${escHtml(item.marketCapUsdFmt)} · \${escHtml(item.pairLabel || item.dex || 'SOL')}</p></motion>
      <motion class="tr-right">
        <motion class="tr-price">\${escHtml(item.priceUsdFmt)}</motion>
        <span class="tr-chg \${up ? 'up' : 'down'}">\${formatPct(chg)}</span>
        <span class="risk-badge \${rc}">\${escHtml(label)}</span>
      </motion>
      \${miniSparkline(up)}
    </article>\`.replace(/<\\/?motion/g, (m) => m.replace('motion', 'motion'.startsWith('</') ? 'div' : 'motion')).replace(/motion/g, 'motion');
  }

`.replace(/<\\/?motion/g, () => '').replace(/motion/g, 'div');

// Fix the botched replace above - build insert cleanly
const cleanInsert = `  let feedTab = 'trending';
  let homeShellBound = false;
  let feedPollTimer = null;

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const x = Number(n);
    return \`\${x >= 0 ? '+' : ''}\${x.toFixed(1)}%\`;
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg = item.change24h;
    const up = chg == null ? true : Number(chg) >= 0;
    const avatar = item.imageUrl
      ? \`<img class="tr-img" src="\${escHtml(item.imageUrl)}" alt="" loading="lazy" />\`
      : \`<span class="tr-avatar">\${escHtml((item.symbol || '?').slice(0, 2))}</span>\`;
    const D = 'd' + 'iv';
    const o = (c, inner) => \`<\${D} class="\${c}">\${inner}</\${D}>\`;
    return \`<article class="token-row \${extraClass}" data-mint="\${escHtml(item.mint)}">
      <span class="tr-rank">\${item.rank ?? '·'}</span>
      \${avatar}
      \${o('tr-info', \`<h3>\${escHtml(item.symbol)}</h3><p>MCap \${escHtml(item.marketCapUsdFmt)} · \${escHtml(item.pairLabel || item.dex || 'SOL')}</p>\`)}
      \${o('tr-right', \`<div class="tr-price">\${escHtml(item.priceUsdFmt)}</motion><span class="tr-chg \${up ? 'up' : 'down'}">\${formatPct(chg)}</span><span class="risk-badge \${rc}">\${escHtml(label)}</span>\`.replace(/<\\/motion>/g, '</div>').replace(/<motion/g, '<div'))}
      \${miniSparkline(up)}
    </article>\`;
  }

`;

// Still messy - use simple div strings in cleanInsert
const finalInsert = `  let feedTab = 'trending';
  let homeShellBound = false;
  let feedPollTimer = null;

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const x = Number(n);
    return \`\${x >= 0 ? '+' : ''}\${x.toFixed(1)}%\`;
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg = item.change24h;
    const up = chg == null ? true : Number(chg) >= 0;
    const avatar = item.imageUrl
      ? '<img class="tr-img" src="' + escHtml(item.imageUrl) + '" alt="" loading="lazy" />'
      : '<span class="tr-avatar">' + escHtml((item.symbol || '?').slice(0, 2)) + '</span>';
    return '<article class="token-row ' + extraClass + '" data-mint="' + escHtml(item.mint) + '">' +
      '<span class="tr-rank">' + (item.rank ?? '·') + '</span>' +
      avatar +
      '<motion class="tr-info"><h3>' + escHtml(item.symbol) + '</h3><p>MCap ' + escHtml(item.marketCapUsdFmt) + ' · ' + escHtml(item.pairLabel || item.dex || 'SOL') + '</p></motion>' +
      '<motion class="tr-right"><motion class="tr-price">' + escHtml(item.priceUsdFmt) + '</motion>' +
      '<span class="tr-chg ' + (up ? 'up' : 'down') + '">' + formatPct(chg) + '</span>' +
      '<span class="risk-badge ' + rc + '">' + escHtml(label) + '</span></motion>' +
      miniSparkline(up) +
      '</article>';
  }

`;

// fix motion to div in finalInsert
const fixedInsert = finalInsert.replace(/motion/g, 'motion').replace(/<\/?motion/g, (x) => x.replace('motion', 'div'));

// manual fix - the replace motion globally breaks things. Do explicit:
const fixedInsert2 = `  let feedTab = 'trending';
  let homeShellBound = false;
  let feedPollTimer = null;

  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPct(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const x = Number(n);
    return \`\${x >= 0 ? '+' : ''}\${x.toFixed(1)}%\`;
  }

  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg = item.change24h;
    const up = chg == null ? true : Number(chg) >= 0;
    const avatar = item.imageUrl
      ? '<img class="tr-img" src="' + escHtml(item.imageUrl) + '" alt="" loading="lazy" />'
      : '<span class="tr-avatar">' + escHtml((item.symbol || '?').slice(0, 2)) + '</span>';
    return '<article class="token-row ' + extraClass + '" data-mint="' + escHtml(item.mint) + '">' +
      '<span class="tr-rank">' + (item.rank ?? '·') + '</span>' +
      avatar +
      '<div class="tr-info"><h3>' + escHtml(item.symbol) + '</h3><p>MCap ' + escHtml(item.marketCapUsdFmt) + ' · ' + escHtml(item.pairLabel || item.dex || 'SOL') + '</p></motion>' +
      '<motion class="tr-right"><div class="tr-price">' + escHtml(item.priceUsdFmt) + '</motion>' +
      '<span class="tr-chg ' + (up ? 'up' : 'down') + '">' + formatPct(chg) + '</span>' +
      '<span class="risk-badge ' + rc + '">' + escHtml(label) + '</span></motion>' +
      miniSparkline(up) +
      '</article>';
  }

`.split('motion').join('div');

s = s.slice(0, start) + fixedInsert2 + s.slice(end);

const oldInit = `  function initScannerHome() {
    const qc = $('quickCards');
    if (qc) {
      qc.innerHTML = QUICK_CARDS.map(
        (c) => \`<article class="quick-card \${c.accent}"><div class="qc-icon">\${c.icon}</div><motion class="qc-title">\${c.title}</motion><motion class="qc-val">\${c.val}</motion></article>\`,
      ).join('').split('div').join('motion');
    }

    const list = $('homeTokenList');
    if (!list) return;

    let html = '';
    try {
      const last = JSON.parse(sessionStorage.getItem('lastReport') || 'null');
      if (last?.id) {
        const r = riskBadgeLabel(last.level, last.score);
        html += \`<article class="token-row" data-report="\${last.id}">
          <span class="tr-rank">★</span>
          <span class="tr-avatar">\${(last.symbol || '?').slice(0, 2)}</span>
          <motion class="tr-info"><h3>\${last.symbol} · Son analiz</h3><p>MCap \${last.mcap || '—'} · Tekrar aç</p></motion>
          <motion class="tr-right"><motion class="tr-price">\${last.price || '—'}</motion><span class="risk-badge \${r.cls}">\${r.text}</span></motion>
          \${miniSparkline((last.chg || 0) >= 0)}
        </article>\`;
      }
    } catch { /* yoksay */ }

    html += DEMO_ROWS.map((t) => {
      const r = t.risk === 'high' ? 'HIGH RISK' : t.risk === 'mid' ? 'MEDIUM RISK' : 'LOW RISK';
      const rc = t.risk === 'high' ? 'high' : t.risk === 'mid' ? 'mid' : 'low';
      const up = t.chg >= 0;
      return \`<article class="token-row demo-row">
        <span class="tr-rank">\${t.rank}</span>
        <span class="tr-avatar">\${t.sym.slice(0, 2)}</span>
        <motion class="tr-info"><h3>\${t.sym}</h3><p>MCap \${t.mcap}</p></motion>
        <motion class="tr-right"><motion class="tr-price">\${t.price}</motion><span class="tr-chg \${up ? 'up' : 'down'}">\${up ? '+' : ''}\${t.chg}%</span><span class="risk-badge \${rc}">\${r}</span></motion>
        \${miniSparkline(up)}
      </article>\`;
    }).join('');

    html += \`<p class="home-cta">Gerçek analiz için kanaldaki token kartının altındaki <b>Tam rapor</b> butonuna bas. Demo satırlar örnektir.</p>\`;

    list.innerHTML = html.split('div').join('motion');

    list.querySelectorAll('.token-row[data-report]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.report;
        if (id) {
          location.hash = \`r=\${id}\`;
          reportId = id;
          loadReportFlow();
        }
      });
    });

    list.querySelectorAll('.demo-row').forEach((row) => {
      row.addEventListener('click', () => {
        showToast('Demo — kanaldan Tam rapor ile aç');
      });
    });
  }`;

// Read actual init from file
const initStart = s.indexOf('  function initScannerHome()');
const initEnd = s.indexOf('  async function loadReportFlow()', initStart);
const actualInit = s.slice(initStart, initEnd);

const newInit = `  function setFeedTab(tab) {
    feedTab = tab === 'new' ? 'new' : 'trending';
    document.querySelectorAll('.feed-tab[data-feed]').forEach((btn) => {
      const f = btn.dataset.feed;
      if (f === 'refresh') return;
      btn.classList.toggle('active', f === feedTab);
    });
    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      const n = btn.dataset.nav;
      btn.classList.toggle('active', n === 'home' || n === feedTab);
    });
    const label = $('feedLabel');
    if (label) label.textContent = feedTab === 'new' ? 'Yeni çiftler' : 'Trend · canlı';
  }

  function renderLastReportRow() {
    try {
      const last = JSON.parse(sessionStorage.getItem('lastReport') || 'null');
      if (!last?.id) return '';
      const r = riskBadgeLabel(last.level, last.score);
      const up = (last.chg || 0) >= 0;
      return '<article class="token-row token-row-last" data-report="' + escHtml(last.id) + '">' +
        '<span class="tr-rank">★</span>' +
        '<span class="tr-avatar">' + escHtml((last.symbol || '?').slice(0, 2)) + '</span>' +
        '<div class="tr-info"><h3>' + escHtml(last.symbol) + ' · Son analiz</h3><p>MCap ' + escHtml(last.mcap || '—') + ' · Tekrar aç</p></motion>' +
        '<motion class="tr-right"><div class="tr-price">' + escHtml(last.price || '—') + '</motion><span class="risk-badge ' + r.cls + '">' + r.text + '</span></motion>' +
        miniSparkline(up) +
        '</article>';
    } catch {
      return '';
    }
  }

  function updateQuickCards(stats, items) {
    const qc = $('quickCards');
    if (!qc) return;
    const top = items[0];
    const cards = [
      { icon: '🔥', title: 'Trend', val: stats?.volume24hFmt || 'Canlı', accent: 'accent-pink' },
      { icon: '✦', title: 'Yeni', val: feedTab === 'new' ? 'Aktif' : 'Çiftler', accent: 'accent-green' },
      { icon: '◎', title: 'Likidite', val: top?.liquidityUsdFmt || 'Scanner', accent: 'accent-cyan' },
      { icon: '◆', title: 'Güvenlik', val: top?.trustScore != null ? top.trustScore + '%' : 'RugCheck', accent: 'accent-purple' },
      { icon: '★', title: 'Liste', val: String(stats?.count || items.length), accent: 'accent-gold' },
    ];
    qc.innerHTML = cards.map(
      (c) => '<article class="quick-card ' + c.accent + '"><div class="qc-icon">' + c.icon + '</div><div class="qc-title">' + c.title + '</div><div class="qc-val">' + c.val + '</div></article>',
    ).join('');
  }

  async function fetchFeed(tab) {
    const t = tab || feedTab;
    setFeedTab(t);
    const loading = $('feedLoading');
    const list = $('homeTokenList');
    loading?.classList.remove('hidden');
    if (list) list.classList.add('dimmed');
    try {
      const res = await fetch('/api/feed?tab=' + encodeURIComponent(t) + '&limit=24');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'feed_failed');
      const items = body.items || [];
      $('statVol') && ($('statVol').textContent = body.stats?.volume24hFmt || '—');
      $('statCount') && ($('statCount').textContent = String(body.stats?.count || items.length));
      updateQuickCards(body.stats, items);
      if (list) {
        const rows = renderLastReportRow() + items.map((it) => renderFeedRow(it)).join('');
        list.innerHTML = rows || '<p class="home-cta">Liste boş — biraz sonra yenile.</p>';
      }
      return body;
    } catch (e) {
      if (list) {
        list.innerHTML = renderLastReportRow() + '<p class="home-cta">Liste yüklenemedi. ' + escHtml(e.message || '') + '</p>';
      }
      showToast('Canlı liste alınamadı');
      return null;
    } finally {
      loading?.classList.add('hidden');
      list?.classList.remove('dimmed');
    }
  }

  async function openTokenByMint(mint) {
    if (!mint || feedLoading) return;
    feedLoading = true;
    const list = $('homeTokenList');
    list?.classList.add('dimmed');
    showToast('Token analiz ediliyor…');
    try {
      const res = await fetch('/api/open/' + encodeURIComponent(mint));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Analiz başarısız');
      const id = body.reportId;
      if (!id) throw new Error('report_missing');
      reportId = id;
      location.hash = 'r=' + id;
      await loadReportFlow();
    } catch (e) {
      showToast(e.message || 'Açılamadı');
    } finally {
      feedLoading = false;
      list?.classList.remove('dimmed');
    }
  }

  function bindHomeShell() {
    if (homeShellBound) return;
    homeShellBound = true;

    document.querySelectorAll('.feed-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.feed;
        if (f === 'refresh') {
          fetchFeed(feedTab);
          return;
        }
        if (f === 'trending' || f === 'new') fetchFeed(f);
      });
    });

    document.querySelectorAll('.bnav[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'home') {
          location.hash = '';
          reportId = null;
          showScannerHome();
          return;
        }
        if (nav === 'trend') {
          fetchFeed('trending');
          return;
        }
        if (nav === 'new') {
          fetchFeed('new');
          return;
        }
        if (nav === 'scan') {
          showToast('Listeden bir token seç');
          return;
        }
        showToast('Yakında');
      });
    });

    $('homeTokenList')?.addEventListener('click', (ev) => {
      const row = ev.target.closest('.token-row');
      if (!row) return;
      const rid = row.dataset.report;
      if (rid) {
        reportId = rid;
        location.hash = 'r=' + rid;
        loadReportFlow();
        return;
      }
      const mint = row.dataset.mint;
      if (mint) openTokenByMint(mint);
    });

    feedPollTimer = setInterval(() => {
      if (!$('scanner-home')?.classList.contains('hidden')) fetchFeed(feedTab);
    }, 90000);
  }

  function initScannerHome() {
    bindHomeShell();
    setFeedTab(feedTab);
    fetchFeed(feedTab);
  }

`;

const newInitClean = newInit.split('motion').join('motion').replace(/motion/g, 'motion');
// fix motion in newInit manually
const newInitFixed = newInit.replace(/motion/g, 'div');

s = s.slice(0, initStart) + newInitFixed + s.slice(initEnd);

// fix feedLoading variable shadow - used as bool but also element id feedLoading - rename bool
s = s.replace('if (!mint || feedLoading) return;\n    feedLoading = true;', 'if (!mint || openingMint) return;\n    openingMint = true;');
s = s.replace('feedLoading = false;', 'openingMint = false;');
s = s.replace('let feedPollTimer = null;', 'let feedPollTimer = null;\n  let openingMint = false;');

fs.writeFileSync(p, s);
console.log('app.js patched');
