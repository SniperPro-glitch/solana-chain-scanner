const fs = require('fs');
const p = 'public/miniapp/app.js';
let s = fs.readFileSync(p, 'utf8');
const from =
  '<div class="tr-name">${escHtml(item.symbol)}<span class="tr-pair"> / ${pairShort}</span>${dexBadge}</div><div class="tr-sub">MCap ${escHtml(item.marketCapUsdFmt)}</div>';
const to =
  '<div class="tr-name">${escHtml(item.symbol)}<span class="tr-pair"> / ${pairShort}</span></div><div class="tr-sub">${subParts || \'—\'}</div>';
if (!s.includes(from)) {
  console.error('pattern missing');
  const i = s.indexOf('${dexBadge}</motion>');
  if (i < 0) {
    const j = s.indexOf('${dexBadge}</div>');
    if (j >= 0) console.log(JSON.stringify(s.slice(j, j + 120)));
  } else console.log(JSON.stringify(s.slice(i, i + 120)));
  process.exit(1);
}
s = s.replace(from, to);
fs.writeFileSync(p, s);
console.log('ok');
