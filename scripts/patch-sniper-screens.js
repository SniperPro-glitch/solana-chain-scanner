const fs = require('fs');
const p = require('path').join(__dirname, '../public/miniapp/index.html');
let html = fs.readFileSync(p, 'utf8');

html = html.replace('class="mockup-ui"', 'class="sniper-ui"');
html = html.replace(
  '<link rel="stylesheet" href="styles.css?v=41" />\n  <link rel="stylesheet" href="dex-scanner.css?v=12" />\n  <link rel="stylesheet" href="dex-scanner-radar.css?v=2" />\n  <link rel="stylesheet" href="mockup.css?v=4" />',
  '<link rel="stylesheet" href="styles.css?v=41" />\n  <link rel="stylesheet" href="dex-scanner-radar.css?v=3" />\n  <link rel="stylesheet" href="sniper-design.css?v=1" />',
);

html = html.replace(
  '<motion id="scanner-home" class="scanner-home mockup-shell hidden">',
  '<div id="sniper-screen-home" class="sniper-screen sniper-home scanner-home hidden">',
);
html = html.replace(
  'id="scanner-home" class="scanner-home mockup-shell hidden"',
  'id="sniper-screen-home" class="sniper-screen sniper-home scanner-home hidden"',
);

// chain pills
html = html.replace(
  `<motion class="dex-scroll" id="dexScroll" role="tablist" aria-label="DEX platform">
      <button type="button" class="dex-chip active" data-dex="all">All</button>
      <button type="button" class="dex-chip" data-dex="pumpfun"><span class="dex-ico pump">💊</span> Pump.fun</button>
      <button type="button" class="dex-chip" data-dex="raydium"><span class="dex-ico ray">◎</span> Raydium</button>
      <button type="button" class="dex-chip" data-dex="meteora"><span class="dex-ico met">☄</span> Meteora</button>
      <button type="button" class="dex-chip" data-dex="orca"><span class="dex-ico orca">🐋</span> Orca</button>
    </div>`,
  `<div class="chain-scroll" id="chainScroll" role="tablist" aria-label="Chain filter">
      <button type="button" class="chain-chip active" data-chain="all">All</button>
      <button type="button" class="chain-chip" data-chain="solana"><span class="chain-ico" style="background:#9945FF;color:#fff">◎</span> Solana</button>
      <button type="button" class="chain-chip disabled" data-chain="eth" disabled><span class="chain-ico" style="background:#627EEA;color:#fff">Ξ</span> ETH</button>
      <button type="button" class="chain-chip disabled" data-chain="bsc" disabled><span class="chain-ico" style="background:#F3BA2F;color:#000">B</span> BSC</button>
      <button type="button" class="chain-chip disabled" data-chain="ton" disabled><span class="chain-ico" style="background:#0098EA;color:#fff">T</span> TON</button>
      <button type="button" class="chain-chip disabled" data-chain="base" disabled><span class="chain-ico" style="background:#0052FF;color:#fff">◇</span> Base</button>
    </div>`,
);

const wrong = String.fromCharCode(109, 111, 116, 105, 111, 110);
const right = String.fromCharCode(100, 105, 118);
html = html.replace(new RegExp(`<${wrong} `, 'g'), `<${right} `).replace(new RegExp(`</${wrong}>`, 'g'), `</${right}>`);

// Split scanner: close home before radar, wrap radar in sniper-screen-scanner
const radarStart = html.indexOf('<section id="radarScanPanel"');
const navStart = html.indexOf('<nav class="bottom-nav">', radarStart);
if (radarStart < 0 || navStart < 0) {
  console.error('markers missing');
  process.exit(1);
}

const radarBlock = html.slice(radarStart, navStart);
const successCard = `
      <section id="radarSuccessPreview" class="radar-success-preview hidden" aria-live="polite">
        <motion id="radarSuccessSlot"></div>
      </section>
`;
const fixedSuccess = successCard.replace(new RegExp(`<${wrong} `, 'g'), `<${right} `).replace(new RegExp(`</${wrong}>`, 'g'), `</${right}>`);

const scannerScreen = `
  </motion>

  <!-- Screen B: Radar Scanner -->
  <div id="sniper-screen-scanner" class="sniper-screen sniper-scanner hidden">
    <header class="scan-header sniper-header">
      <div class="scan-brand">
        <span class="brand-crosshair" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>
        </span>
        <div class="brand-titles">
          <span class="brand-main">SNIPER</span>
          <span class="brand-sub">DEX SCANNER</span>
        </div>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-connect" id="btnConnectScanner"><span class="wallet-ico">👛</span> Connect</button>
        <button type="button" class="btn-settings" aria-label="Settings">⚙</button>
      </div>
    </header>
    ${radarBlock.replace('class="radar-scan-panel hidden"', 'class="radar-scan-panel"')}${fixedSuccess}
  </div>

  <nav class="bottom-nav sniper-bottom-nav" id="sniperBottomNav">
`;

html = html.slice(0, radarStart) + scannerScreen + html.slice(navStart + '<nav class="bottom-nav">'.length);

// Close home div properly - remove extra closing from old structure
html = html.replace('    </div>\n\n  </motion>\n\n  <!-- Screen B', '    </div>\n\n  <!-- Screen B');

html = html.replace(
  'id="view-detail" class="view-detail mockup-report hidden"',
  'id="view-detail" class="view-detail sniper-report mockup-report hidden"',
);

html = html.replace('app.js?v=53', 'app.js?v=54');

// Remove closing </div> for old scanner-home before screen B if duplicate
const homeClose = html.indexOf('    </motion>\n\n  <!-- Screen B');
if (homeClose > 0) {
  html = html.replace('    </motion>\n\n  <!-- Screen B', '  </div>\n\n  <!-- Screen B');
}

fs.writeFileSync(p, html);
console.log('patched');
