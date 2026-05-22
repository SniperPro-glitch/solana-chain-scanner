const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(/SOLANA SCANNER/g, 'SNIPER DEX SCANNER');
html = html.replace('<title>Solana Scanner</title>', '<title>SNIPER DEX SCANNER</title>');

const start = html.indexOf('  <!-- Ana scanner');
const end = html.indexOf('  <!-- Token detay');
if (start < 0 || end < 0) {
  console.error('block not found', start, end);
  process.exit(1);
}

const newHome = `  <!-- SNIPER DEX SCANNER home -->
  <motion id="scanner-home" class="scanner-home hidden">
    <header class="scan-header">
      <motion class="scan-brand">
        <span class="brand-crosshair" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>
        </span>
        <motion class="brand-titles">
          <span class="brand-main">SNIPER</span>
          <span class="brand-sub">DEX SCANNER</span>
        </motion>
      </motion>
      <motion class="header-actions">
        <button type="button" class="btn-connect" id="btnConnect"><span class="wallet-ico">👛</span> Connect</button>
        <button type="button" class="btn-settings" aria-label="Ayarlar">⚙</button>
      </motion>
    </header>

    <motion class="search-row">
      <motion class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract…" disabled />
      </motion>
      <button type="button" class="btn-filter" aria-label="Filtre">☰</button>
    </motion>

    <motion class="chain-scroll">
      <button type="button" class="chain-chip active" data-chain="all">All</button>
      <button type="button" class="chain-chip" data-chain="solana">◎ Solana</button>
      <button type="button" class="chain-chip disabled" disabled>Ξ ETH</button>
      <button type="button" class="chain-chip disabled" disabled>BSC</button>
      <button type="button" class="chain-chip disabled" disabled>TON</button>
      <button type="button" class="chain-chip disabled" disabled>Base</button>
    </motion>

    <motion class="quick-scroll" id="quickCards"></motion>

    <motion class="token-table-wrap">
      <motion class="token-thead">
        <span>#</span><span>TOKEN / PAIR</span><span>PRICE</span><span>1H</span><span>24H</span><span>RISK</span>
      </motion>
      <motion class="feed-loading hidden" id="feedLoading">Liste yükleniyor…</motion>
      <motion class="token-list" id="homeTokenList"></motion>
    </motion>

    <motion class="market-footer" id="marketFooter">
      <motion class="mf-item"><span>24H VOLUME</span><strong id="statVol">—</strong><em class="up" id="statVolChg"></em></motion>
      <motion class="mf-item"><span>NEW PAIRS</span><strong id="statNew">—</strong><em class="up" id="statNewChg"></em></motion>
      <motion class="mf-item"><span>LIQUIDITY</span><strong id="statLiq">—</strong><em class="up" id="statLiqChg"></em></motion>
      <motion class="mf-item"><span>ACTIVE NOW</span><strong id="statActive">—</strong><em class="up" id="statActiveChg"></em></motion>
    </motion>

    <nav class="bottom-nav">
      <button type="button" class="bnav active" data-nav="home"><span class="bnav-ico">⌂</span><span class="bnav-lbl">Home</span></button>
      <button type="button" class="bnav" data-nav="trend"><span class="bnav-ico">🔥</span><span class="bnav-lbl">Trending</span></button>
      <button type="button" class="bnav" data-nav="new"><span class="bnav-ico">✦</span><span class="bnav-lbl">New Pairs</span></button>
      <button type="button" class="bnav" data-nav="scan"><span class="bnav-ico">◎</span><span class="bnav-lbl">Scanner</span></button>
      <button type="button" class="bnav" data-nav="watch"><span class="bnav-ico">★</span><span class="bnav-lbl">Watchlist</span></button>
    </nav>
  </motion>

`.split('motion').join('motion').replace(/motion/g, 'motion');

const fixed = newHome.split('motion').join('div');
html = html.slice(0, start) + fixed + html.slice(end);
fs.writeFileSync(htmlPath, html);
console.log('ok');
