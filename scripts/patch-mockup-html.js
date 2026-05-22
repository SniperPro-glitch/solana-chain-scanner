const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'miniapp', 'index.html');
let html = fs.readFileSync(file, 'utf8');

html = html.replace(
  'class="scanner-home hidden"',
  'class="scanner-home mockup-shell hidden"',
);

const detailStart = '  <!-- Token detay (rapor #r=) -->';
const detailEnd = '  <script src="wallet.js?v=1"></script>';
const i0 = html.indexOf(detailStart);
const i1 = html.indexOf(detailEnd);
if (i0 < 0 || i1 < 0) throw new Error('markers not found');

const block = fs.readFileSync(path.join(__dirname, 'mockup-detail.fragment.html'), 'utf8');

html = html.slice(0, i0) + block + html.slice(i1);
html = html.replace(/app\.js\?v=\d+/, 'app.js?v=51');
html = html.replace(/mockup\.css\?v=\d+/, 'mockup.css?v=2');

fs.writeFileSync(file, html, 'utf8');
console.log('patched', file);
