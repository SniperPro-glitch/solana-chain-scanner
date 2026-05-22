const fs = require('fs');
const p = require('path').join(__dirname, '../public/miniapp/index.html');
let s = fs.readFileSync(p, 'utf8');
const wrong = String.fromCharCode(109, 111, 116, 105, 111, 110);
const right = String.fromCharCode(100, 105, 118);
s = s.split('<' + wrong + ' ').join('<' + right + ' ');
s = s.split('</' + wrong + '>').join('</' + right + '>');

s = s.replace(/\n  <\/motion>\n\n  <!-- Screen B/g, '\n  </div>\n\n  <!-- Screen B');
s = s.replace(/<nav class="bottom-nav sniper-bottom-nav"[\s\S]*?<\/nav>\s*<\/div>/, (m) => m.replace(/\s*<\/div>\s*$/, ''));

if (!s.includes('chainScroll')) {
  console.warn('chain pills missing');
}

fs.writeFileSync(p, s);
console.log('ok');
