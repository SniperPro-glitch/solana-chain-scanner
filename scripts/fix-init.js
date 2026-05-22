const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  "MCap ${escHtml(item.marketCapUsdFmt)}</motion></motion>\n      <span class=\"tr-price\"",
  "MCap ${escHtml(item.marketCapUsdFmt)}</motion></motion></motion>\n      <span class=\"tr-price\"",
);
// fix if only 2 closes
s = s.replace(
  /MCap \$\{escHtml\(item\.marketCapUsdFmt\)\}<\/div><\/motion>\n      <span class="tr-price"/,
  'MCap ${escHtml(item.marketCapUsdFmt)}</div></motion></motion>\n      <span class="tr-price"',
);
s = s.replace(
  /MCap \$\{escHtml\(item\.marketCapUsdFmt\)\}<\/div><\/div>\n      <span class="tr-price"/,
  'MCap ${escHtml(item.marketCapUsdFmt)}</div></div></motion>\n      <span class="tr-price"',
);

const oldInit = `  function initScannerHome() {
    bindHomeShell();
    setFeedTab(feedTab);
    fetchFeed(feedTab);
  }`;

const newInit = `  function initScannerHome() {
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
  }`;

if (s.includes(oldInit)) s = s.replace(oldInit, newInit);

fs.writeFileSync(p, s);
console.log('fixed');
