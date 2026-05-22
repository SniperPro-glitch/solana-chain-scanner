const fs = require('fs');
const p = 'public/miniapp/index.html';
let s = fs.readFileSync(p, 'utf8');

const newToolbar = [
  '    <section class="feed-toolbar" id="feedToolbar" aria-label="Liste">',
  '      <span class="feed-toolbar-label">Trending</span>',
  '      <div class="feed-tf-group" role="group" aria-label="Zaman dilimi">',
  '        <button type="button" class="feed-tf" data-tf="1h">1H</button>',
  '        <button type="button" class="feed-tf active" data-tf="24h">24H</button>',
  '      </div>',
  '      <div class="feed-list-modes" role="group" aria-label="Liste türü">',
  '        <button type="button" class="feed-mode-chip active" data-list-mode="top">Top</button>',
  '        <button type="button" class="feed-mode-chip" data-list-mode="gainers">Gainers</button>',
  '        <button type="button" class="feed-mode-chip" data-list-mode="new">New</button>',
  '      </div>',
  '    </section>',
  '',
].join('\n');

const toolbarRe = /    <section class="feed-toolbar" id="feedToolbar"[\s\S]*?    <\/section>\n\n/;
if (!toolbarRe.test(s)) {
  console.error('toolbar block not found');
  process.exit(1);
}
s = s.replace(toolbarRe, newToolbar + '\n');

const sheetRe = /    <div id="feedFiltersSheet"[\s\S]*?    <\/div>\n\n/;
if (!sheetRe.test(s)) {
  console.error('filters sheet not found');
  process.exit(1);
}
s = s.replace(sheetRe, '');

fs.writeFileSync(p, s);
console.log('patched index.html');
