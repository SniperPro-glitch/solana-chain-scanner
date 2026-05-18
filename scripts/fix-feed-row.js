const fs = require('fs');
const p = 'public/miniapp/app.js';
let s = fs.readFileSync(p, 'utf8');
const close = '</div>';
const from = `marketCapUsdFmt)}${close}${close}\r\n      <span class="tr-price"`;
const to = `marketCapUsdFmt)}${close}${close}${close}\r\n      <span class="tr-price"`;
if (!s.includes(from)) {
  console.error('pattern not found');
  process.exit(1);
}
s = s.replace(from, to);
fs.writeFileSync(p, s);
console.log('ok');
