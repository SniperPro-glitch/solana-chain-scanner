const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
const D = 'd' + 'iv';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('feed-tabs')) {
  console.log('already patched');
  process.exit(0);
}
const open = (cls, extra = '') => `<${D} class="${cls}"${extra}>`;
const close = `</${D}>`;
const old =
  open('section-label') +
  '\n      <span>Canlı tarama</span>\n      <span class="live-dot"></span>\n    ' +
  close +
  '\n\n    ' +
  open('token-list', ' id="homeTokenList"') +
  close +
  '\n\n    ' +
  open('market-footer') +
  '\n      ' +
  open('mf-item') +
  '<span>24H VOL</span><strong>$243.6M</strong><em class="up">+12%</em>' +
  close +
  '\n      ' +
  open('mf-item') +
  '<span>ACTIVE</span><strong>1.2K</strong><em class="up">+8%</em>' +
  close +
  '\n    ' +
  close;
const neu =
  open('feed-tabs') +
  '\n      <button type="button" class="feed-tab active" data-feed="trending">Trend</button>\n      <button type="button" class="feed-tab" data-feed="new">Yeni çiftler</button>\n      <button type="button" class="feed-tab" data-feed="refresh" id="btnFeedRefresh" title="Yenile">↻</button>\n    ' +
  close +
  '\n\n    ' +
  open('section-label') +
  '\n      <span id="feedLabel">Canlı tarama</span>\n      <span class="live-dot"></span>\n    ' +
  close +
  '\n\n    ' +
  open('feed-loading hidden', ' id="feedLoading"') +
  'Liste yükleniyor…' +
  close +
  '\n\n    ' +
  open('token-list', ' id="homeTokenList"') +
  close +
  '\n\n    ' +
  open('market-footer', ' id="marketFooter"') +
  '\n      ' +
  open('mf-item') +
  '<span>24H VOL</span><strong id="statVol">—</strong>' +
  close +
  '\n      ' +
  open('mf-item') +
  '<span>LISTED</span><strong id="statCount">—</strong>' +
  close +
  '\n    ' +
  close;
if (!s.includes(old)) {
  console.error('old block not found');
  process.exit(1);
}
s = s.replace(old, neu);
fs.writeFileSync(p, s);
console.log('ok');
