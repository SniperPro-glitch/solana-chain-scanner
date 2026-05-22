const fs = require('fs');
const p = 'public/miniapp/app.js';
let s = fs.readFileSync(p, 'utf8');
const needle = '<span class="tr-pair"> / ${pairShort}</span></motion>';
const repl = '<span class="tr-pair"> / ${pairShort}</span>${dexBadge}</motion>';
if (s.includes('${dexBadge}</motion>') || s.includes('${dexBadge}</div>')) {
  console.log('already patched');
  process.exit(0);
}
const needle2 = '<span class="tr-pair"> / ${pairShort}</span></div>';
const repl2 = '<span class="tr-pair"> / ${pairShort}</span>${dexBadge}</div>';
if (s.includes(needle2)) {
  s = s.replace(needle2, repl2);
  fs.writeFileSync(p, s);
  console.log('patched div');
} else {
  console.log('needle not found');
  const i = s.indexOf('pairShort}</span>');
  console.log(JSON.stringify(s.slice(i, i + 60)));
  process.exit(1);
}
