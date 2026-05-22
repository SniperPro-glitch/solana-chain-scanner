const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'index.html');
let h = fs.readFileSync(p, 'utf8');
h = h.replace(/\r?\n\s*<div class="dex-chart-brand-mask"[^>]*><\/motion>\r?\n/, '\n');
h = h.replace(/\r?\n\s*<motion class="dex-chart-brand-mask"[^>]*><\/motion>\r?\n/, '\n');
h = h.replace(/<div class="dex-chart-brand-mask"[^>]*><\/motion>\s*/g, '');
h = h.replace(/<div class="dex-chart-brand-mask"[^>]*><\/div>\s*/g, '');
fs.writeFileSync(p, h);
console.log('removed mask', !h.includes('dex-chart-brand-mask'));
