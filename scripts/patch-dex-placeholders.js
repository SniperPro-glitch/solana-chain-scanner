const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');

if (!s.includes('PLACEHOLDER_TOKENS')) {
  const insert = `
  const PLACEHOLDER_TOKENS = [
    { rank: 1, symbol: 'WOFFY', pairLabel: 'WOFFY/SOL', priceUsdFmt: '$0.0042', change1h: 12.4, change24h: 86.2, volume24hFmt: '$248K', liquidityUsdFmt: '$89K', marketCapUsdFmt: '$1.2M', risk: { band: 'high', label: 'HIGH RISK' }, mint: 'demo1' },
    { rank: 2, symbol: 'BONK', pairLabel: 'BONK/SOL', priceUsdFmt: '$0.000019', change1h: 3.2, change24h: 12.4, volume24hFmt: '$1.2M', liquidityUsdFmt: '$420K', marketCapUsdFmt: '$890K', risk: { band: 'low', label: 'LOW RISK' }, mint: 'demo2' },
    { rank: 3, symbol: 'POPCAT', pairLabel: 'POPCAT/SOL', priceUsdFmt: '$1.24', change1h: -2.1, change24h: -5.1, volume24hFmt: '$890K', liquidityUsdFmt: '$310K', marketCapUsdFmt: '$2.1M', risk: { band: 'mid', label: 'MEDIUM RISK' }, mint: 'demo3' },
    { rank: 4, symbol: 'WIF', pairLabel: 'WIF/SOL', priceUsdFmt: '$2.86', change1h: 8.7, change24h: 24.3, volume24hFmt: '$3.1M', liquidityUsdFmt: '$1.1M', marketCapUsdFmt: '$2.8M', risk: { band: 'low', label: 'LOW RISK' }, mint: 'demo4' },
    { rank: 5, symbol: 'MEW', pairLabel: 'MEW/SOL', priceUsdFmt: '$0.0089', change1h: -4.2, change24h: 18.6, volume24hFmt: '$520K', liquidityUsdFmt: '$180K', marketCapUsdFmt: '$780K', risk: { band: 'mid', label: 'MEDIUM RISK' }, mint: 'demo5' },
  ];

  const PLACEHOLDER_STATS = {
    volume24hFmt: '$2.48B',
    newPairs: 1248,
    liquidityFmt: '$243.6M',
    activeNow: 18457,
    count: 12458,
  };

`;
  s = s.replace('  let openingMint = false;\n', '  let openingMint = false;\n' + insert);
}

const newRenderRow = `  function renderFeedRow(item, extraClass = '') {
    const risk = item.risk || {};
    const rc = risk.band || 'mid';
    const label = risk.label || 'SCAN';
    const chg24 = item.change24h;
    const chg1 = item.change1h;
    const up24 = chg24 == null ? true : Number(chg24) >= 0;
    const pairShort = escHtml((item.pairLabel || 'SOL').replace(/^.*\\//, '') || 'SOL');
    const avatar = item.imageUrl
      ? \`<span class="tr-avatar-wrap"><img class="tr-img" src="\${escHtml(item.imageUrl)}" alt="" loading="lazy" /><span class="tr-chain-dot">◎</span></span>\`
      : \`<span class="tr-avatar-wrap"><span class="tr-avatar">\${escHtml((item.symbol || '?').slice(0, 2))}</span><span class="tr-chain-dot">◎</span></span>\`;
    return \`<article class="token-row \${extraClass}" data-mint="\${escHtml(item.mint)}">
      <span class="tr-rank">\${item.rank ?? '·'}</span>
      <div class="tr-token">\${avatar}<div class="tr-meta"><motion class="tr-name">\${escHtml(item.symbol)}<span class="tr-pair"> / \${pairShort}</span></motion><div class="tr-sub">MCap \${escHtml(item.marketCapUsdFmt)}</motion></motion>
      <span class="tr-price">\${escHtml(item.priceUsdFmt)}</span>
      <span class="tr-pct \${chgClass(chg1)}">\${formatPct(chg1)}</span>
      <span class="tr-pct \${chgClass(chg24)}">\${formatPct(chg24)}</span>
      <span class="tr-vol">\${escHtml(item.volume24hFmt || '—')}</span>
      <span class="tr-liq">\${escHtml(item.liquidityUsdFmt || '—')}</span>
      <div class="tr-risk-col">\${miniSparkline(up24)}<span class="risk-badge \${rc}">\${escHtml(label)}</span></div>
    </article>\`;
  }`.split('motion').join('motion').replace(/motion/g, 'div');

const start = s.indexOf('  function chgClass(n)');
const end = s.indexOf('  function reportIdFromUrl()', start);
if (start >= 0 && end > start) {
  s = s.slice(0, start) + newRenderRow + '\n\n' + s.slice(end);
}

// renderTokenList helper
if (!s.includes('function renderTokenList')) {
  const helper = `
  function renderTokenList(items) {
    const list = $('homeTokenList');
    if (!list) return;
    const rows = renderLastReportRow() + (items || []).map((it) => renderFeedRow(it)).join('');
    list.innerHTML = rows || '<p class="home-cta">No tokens found.</p>';
  }

  function applyMarketStats(stats) {
    const st = stats || PLACEHOLDER_STATS;
    if ($('statVol')) $('statVol').textContent = st.volume24hFmt || '—';
    if ($('statNew')) $('statNew').textContent = String(st.newPairs ?? '—');
    if ($('statLiq')) $('statLiq').textContent = st.liquidityFmt || '—';
    if ($('statActive')) $('statActive').textContent = String(st.activeNow ?? '—');
    [['statVolChg', '+16.8%'], ['statNewChg', '+23.5%'], ['statLiqChg', '+19.2%'], ['statActiveChg', '+12.3%']].forEach(([id, t]) => {
      const el = $(id);
      if (el) el.textContent = t;
    });
  }

`;
  s = s.replace('  function updateQuickCards(stats, items)', helper + '  function updateQuickCards(stats, items)');
}

// fetchFeed - use placeholders on fail and merge
s = s.replace(
  /async function fetchFeed\(tab\) \{[\s\S]*?finally \{[\s\S]*?list\?\.classList\.remove\('dimmed'\);\s*\}\s*\}/,
  `async function fetchFeed(tab) {
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
      const items = body.items?.length ? body.items : PLACEHOLDER_TOKENS;
      applyMarketStats(body.stats || PLACEHOLDER_STATS);
      updateQuickCards(body.stats || PLACEHOLDER_STATS, items);
      renderTokenList(items);
      return body;
    } catch (e) {
      applyMarketStats(PLACEHOLDER_STATS);
      updateQuickCards(PLACEHOLDER_STATS, PLACEHOLDER_TOKENS);
      renderTokenList(PLACEHOLDER_TOKENS);
      showToast('Demo data — live feed unavailable');
      return null;
    } finally {
      loadingEl?.classList.add('hidden');
      list?.classList.remove('dimmed');
    }
  }`,
);

// initScannerHome - show placeholders instantly
s = s.replace(
  '  function initScannerHome() {\n    bindHomeShell();\n    setFeedTab(feedTab);\n    fetchFeed(feedTab);\n  }',
  `  function initScannerHome() {
    bindHomeShell();
    setFeedTab(feedTab);
    applyMarketStats(PLACEHOLDER_STATS);
    updateQuickCards(PLACEHOLDER_STATS, PLACEHOLDER_TOKENS);
    renderTokenList(PLACEHOLDER_TOKENS);
    fetchFeed(feedTab);
    const search = $('searchInput');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        const filtered = PLACEHOLDER_TOKENS.filter((t) =>
          !q || t.symbol.toLowerCase().includes(q) || (t.pairLabel || '').toLowerCase().includes(q));
        renderTokenList(filtered);
      });
    }
  }`,
);

// openTokenByMint - demo mints toast
s = s.replace(
  "const res = await fetch(`/api/open/${encodeURIComponent(mint)}`);",
  `if (String(mint).startsWith('demo')) {
        showToast('Demo token — connect live feed for full report');
        openingMint = false;
        list?.classList.remove('dimmed');
        return;
      }
      const res = await fetch(\`/api/open/\${encodeURIComponent(mint)}\`);`,
);

// miniSparkline colors
s = s.replace("const col = up ? '#4ade80' : '#fb7185';", "const col = up ? '#00ff88' : '#ff3b3b';");

fs.writeFileSync(p, s);
console.log('placeholders ok');
