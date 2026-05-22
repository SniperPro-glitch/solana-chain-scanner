const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const bad = "Liq ${escHtml(item.liquidityUsdFmt || '—')}</div></motion>\n      <span class=\"tr-price\"";
const good = "Liq ${escHtml(item.liquidityUsdFmt || '—')}</motion></motion></motion>\n      <span class=\"tr-price\"";
const bad2 = bad.split('motion').join('div');
const good2 = good.split('motion').join('motion');
if (!s.includes(bad2)) {
  console.log('pattern not found, trying alt');
  const alt = bad2.replace('</div></div>', '</div></div></motion>');
}
s = s.replace(bad2, good2.split('motion').join('div'));
fs.writeFileSync(p, s);
console.log('fixed', s.includes(good2.split('motion').join('div')));
