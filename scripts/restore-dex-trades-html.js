const fs = require('fs');
const path = require('path');
const D = 'di' + 'v';
const file = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const block = [
  '      <section class="trades-tape glass" id="tradesTape" aria-live="polite">',
  `        <${D} class="trades-head">`,
  '          <span class="trades-title">Canlı alım / satım</span>',
  '          <span class="trades-live" aria-hidden="true"><span class="trades-live-dot"></span> LIVE</span>',
  '          <span class="trades-meta" id="tradesMeta">DexScreener</span>',
  `        </${D}>`,
  `        <${D} class="dex-trades-embed-wrap" id="dexTradesWrap">`,
  '          <iframe id="dexTradesEmbed" class="dex-trades-embed hidden" title="DexScreener canlı işlemler" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe>',
  `          <${D} class="dex-mask dex-mask-brand" aria-hidden="true"></${D}>`,
  `          <${D} class="dex-mask dex-mask-foot" aria-hidden="true"></${D}>`,
  '          <p class="dex-trades-fallback" id="dexTradesFallback">İşlem akışı yükleniyor…</p>',
  `        </${D}>`,
  '      </section>',
].join('\n');

html = html.replace(
  /<section class="trades-tape glass" id="tradesTape"[\s\S]*?<\/section>/,
  block,
);

html = html.replace('styles.css?v=27', 'styles.css?v=28');
html = html.replace('app.js?v=26', 'app.js?v=27');

fs.writeFileSync(file, html);
console.log('restored dex trades html');
