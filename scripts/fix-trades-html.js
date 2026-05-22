const fs = require('fs');
const path = require('path');
const D = 'di' + 'v';
const o = (cls, extra = '') => `<${D} class="${cls}"${extra}>`;
const c = () => `</${D}>`;

const file = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const corrupt = 'mo' + 'tion';
html = html.split('<' + corrupt).join('<' + D);
html = html.split('</' + corrupt + '>').join(c());

html = html.replace(/<div class="dex-trades-embed-wrap" id="dexTradesWrap">\s*/g, '');

const extraClose = html.match(/\n        <\/div>\s*\n      <\/section>\s*\n\n      <section class="metrics-dashboard"/);
if (extraClose) {
  html = html.replace(
    /<ul class="trades-list" id="tradesList"><\/ul>\s*<\/motion>\s*\n      <\/section>/,
    '<ul class="trades-list" id="tradesList"></ul>\n      </section>',
  );
  html = html.replace(
    /<ul class="trades-list" id="tradesList"><\/ul>\s*<\/div>\s*\n      <\/section>/,
    '<ul class="trades-list" id="tradesList"></ul>\n      </section>',
  );
}

if (!html.includes('dex-chart-brand-mask')) {
  html = html.replace(
    new RegExp(`<${D} id="priceChart" class="chart-canvas"><\\/${D}>`),
    `<${D} id="priceChart" class="chart-canvas"></${D}>\n          ${o('dex-chart-brand-mask', ' aria-hidden="true"')}${c()}`,
  );
}

const tradesBlock = [
  '      <section class="trades-tape glass" id="tradesTape" aria-live="polite">',
  `        ${o('trades-head')}`,
  '          <span class="trades-title">Canlı alım / satım</span>',
  '          <span class="trades-live" aria-hidden="true"><span class="trades-live-dot"></span> LIVE</span>',
  '          <span class="trades-meta" id="tradesMeta">DexScreener verisi</span>',
  `        ${c()}`,
  `        ${o('trades-thead', ' aria-hidden="true"')}`,
  '          <span>Zaman</span><span>Tip</span><span>USD</span><span id="tradesColToken">Token</span><span>Cüzdan</span>',
  `        ${c()}`,
  '        <ul class="trades-list" id="tradesList"></ul>',
  '      </section>',
].join('\n');

html = html.replace(
  /<section class="trades-tape glass" id="tradesTape"[\s\S]*?<\/section>\s*\n\s*<section class="metrics-dashboard"/,
  `${tradesBlock}\n\n      <section class="metrics-dashboard"`,
);

fs.writeFileSync(file, html);
console.log('fixed', file);
