const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let js = fs.readFileSync(file, 'utf8');

const replacement = `  function stopTradesPoll() {
    if (tradesResizeHandler) {
      window.removeEventListener('resize', tradesResizeHandler);
      tradesResizeHandler = null;
    }
  }

  function calibrateDexTradesCrop() {
    const wrap = $('dexTradesWrap');
    if (!wrap) return;
    const vh = window.innerHeight || 640;
    const rowH = 44;
    const viewH = rowH * 6 + 24;
    const iframeH = Math.round(Math.min(980, Math.max(820, vh * 0.92)));
    const offset = Math.round(iframeH * 0.535 - 8);
    wrap.style.setProperty('--dex-trades-view-h', \`\${viewH}px\`);
    wrap.style.setProperty('--dex-iframe-h', \`\${iframeH}px\`);
    wrap.style.setProperty('--dex-iframe-top', \`-\${offset}px\`);
  }

  function dexTradesEmbedUrl(poolOrMint) {
    const ref = String(poolOrMint || '').trim();
    if (!ref) return null;
    const q = new URLSearchParams({
      embed: '1',
      theme: 'dark',
      trades: '1',
      info: '0',
      tabs: '0',
      chartLeftToolbar: '0',
      chartTheme: 'dark',
      interval: '15',
    });
    return \`https://dexscreener.com/solana/\${encodeURIComponent(ref)}?\${q.toString()}\`;
  }

  function showDexTradesEmbed(m) {
    const wrap = $('tradesTape');
    const iframe = $('dexTradesEmbed');
    const fallback = $('dexTradesFallback');
    const meta = $('tradesMeta');
    if (!wrap) return;

    wrap.classList.remove('hidden');
    const poolRef = m?.poolAddress || m?.address || appData?.address;
    const url = dexTradesEmbedUrl(poolRef);

    if (!iframe) return;
    if (!url) {
      iframe.classList.add('hidden');
      if (fallback) {
        fallback.textContent = 'İşlem akışı için pool bulunamadı.';
        fallback.classList.remove('hidden');
      }
      return;
    }

    calibrateDexTradesCrop();
    if (!tradesResizeHandler) {
      tradesResizeHandler = () => calibrateDexTradesCrop();
      window.addEventListener('resize', tradesResizeHandler);
    }

    if (fallback) {
      fallback.textContent = 'İşlem akışı yükleniyor…';
      fallback.classList.remove('hidden');
    }
    iframe.classList.remove('hidden');
    iframe.onload = () => {
      calibrateDexTradesCrop();
      if (fallback) fallback.classList.add('hidden');
      if (meta) meta.textContent = 'canlı';
    };
    if (iframe.src !== url) iframe.src = url;
    else if (meta) meta.textContent = 'canlı';
  }

  function startTradesPoll(m) {
    stopTradesPoll();
    showDexTradesEmbed(m);
  }

`;

const start = js.indexOf('  function stopTradesPoll() {');
const end = js.indexOf('  function dexEmbedUrlFor(poolOrMint, tf) {');
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}
js = js.slice(0, start) + replacement + js.slice(end);
fs.writeFileSync(file, js);
console.log('restored dex trades app.js');
