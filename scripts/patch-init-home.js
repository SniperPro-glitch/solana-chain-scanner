const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');
if (s.includes('function bindHomeShell')) {
  console.log('already done');
  process.exit(0);
}
const start = s.indexOf('  function initScannerHome() {');
const end = s.indexOf('  async function loadReportFlow()', start);
if (start < 0 || end < 0) {
  console.error('markers missing');
  process.exit(1);
}
const neu = `  function setFeedTab(tab) {
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
      return \`<article class="token-row token-row-last" data-report="\${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <span class="tr-avatar">\${escHtml((last.symbol || '?').slice(0, 2))}</span>
        <div class="tr-info"><h3>\${escHtml(last.symbol)} · Son analiz</h3><p>MCap \${escHtml(last.mcap || '—')} · Tekrar aç</p></div>
        <motion class="tr-right"><motion class="tr-price">\${escHtml(last.price || '—')}</motion><span class="risk-badge \${r.cls}">\${r.text}</span></motion>
        \${miniSparkline(up)}
      </article>\`;
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
      { icon: '◆', title: 'Güvenlik', val: top?.trustScore != null ? \`\${top.trustScore}%\` : 'RugCheck', accent: 'accent-purple' },
      { icon: '★', title: 'Liste', val: String(stats?.count || items.length), accent: 'accent-gold' },
    ];
    qc.innerHTML = cards.map(
      (c) => \`<article class="quick-card \${c.accent}"><div class="qc-icon">\${c.icon}</div><div class="qc-title">\${c.title}</div><motion class="qc-val">\${c.val}</motion></article>\`,
    ).join('');
  }

  async function fetchFeed(tab) {
    const t = tab || feedTab;
    setFeedTab(t);
    const loadingEl = $('feedLoading');
    const list = $('homeTokenList');
    loadingEl?.classList.remove('hidden');
    list?.classList.add('dimmed');
    try {
      const res = await fetch(\`/api/feed?tab=\${encodeURIComponent(t)}&limit=24\`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'feed_failed');
      const items = body.items || [];
      if ($('statVol')) $('statVol').textContent = body.stats?.volume24hFmt || '—';
      if ($('statCount')) $('statCount').textContent = String(body.stats?.count || items.length);
      updateQuickCards(body.stats, items);
      if (list) {
        const rows = renderLastReportRow() + items.map((it) => renderFeedRow(it)).join('');
        list.innerHTML = rows || '<p class="home-cta">Liste boş — biraz sonra yenile.</p>';
      }
      return body;
    } catch (e) {
      if (list) {
        list.innerHTML = \`\${renderLastReportRow()}<p class="home-cta">Liste yüklenemedi. \${escHtml(e.message || '')}</p>\`;
      }
      showToast('Canlı liste alınamadı');
      return null;
    } finally {
      loadingEl?.classList.add('hidden');
      list?.classList.remove('dimmed');
    }
  }

  async function openTokenByMint(mint) {
    if (!mint || openingMint) return;
    openingMint = true;
    const list = $('homeTokenList');
    list?.classList.add('dimmed');
    showToast('Token analiz ediliyor…');
    try {
      const res = await fetch(\`/api/open/\${encodeURIComponent(mint)}\`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Analiz başarısız');
      const id = body.reportId;
      if (!id) throw new Error('report_missing');
      reportId = id;
      location.hash = \`r=\${id}\`;
      await loadReportFlow();
    } catch (e) {
      showToast(e.message || 'Açılamadı');
    } finally {
      openingMint = false;
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
        location.hash = \`r=\${rid}\`;
        loadReportFlow();
        return;
      }
      const m = row.dataset.mint;
      if (m) openTokenByMint(m);
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
const fixed = neu.split('motion').join('motion');
const fixed2 = fixed.replace(/motion/g, 'div');
s = s.slice(0, start) + fixed2 + s.slice(end);
fs.writeFileSync(p, s);
console.log('ok');
