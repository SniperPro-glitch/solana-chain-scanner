const fs = require('fs');
const p = 'public/miniapp/app.js';
let s = fs.readFileSync(p, 'utf8');

const re = /      const up = \(last\.chg \|\| 0\) >= 0;\n      return `[\s\S]*?      <\/article>`;/;
const replacement = `      const up = (last.chg || 0) >= 0;
      const lastChg = last.chg != null ? formatPct(last.chg) : '—';
      return \`<article class="token-row token-row-last" data-report="\${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <div class="tr-token"><span class="tr-avatar">\${escHtml((last.symbol || '?').slice(0, 2))}</span><motion class="tr-meta"><div class="tr-name">\${escHtml(last.symbol)}</div><div class="tr-sub">Son analiz · Tekrar aç</div></div></div>
        <span class="tr-mcap">—</span>
        <span class="tr-price">\${escHtml(last.price || '—')}</span>
        <span class="tr-age">—</span>
        <span class="tr-pct \${chgClass(last.chg)}">\${escHtml(lastChg)}</span>
        <span class="tr-vol" aria-hidden="true"></span>
        <span class="tr-liq" aria-hidden="true"></span>
        \${riskColHtml(r.cls, r.text, up)}
      </article>\`;`;

const fixed = replacement.replace(/<motion class="tr-meta">/g, '<motion class="tr-meta">').replace(/<\/motion><\/div><\/motion>/g, '</div></motion></div>');
// Actually write clean:
const clean = `      const up = (last.chg || 0) >= 0;
      const lastChg = last.chg != null ? formatPct(last.chg) : '—';
      return \`<article class="token-row token-row-last" data-report="\${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <div class="tr-token"><span class="tr-avatar">\${escHtml((last.symbol || '?').slice(0, 2))}</span><div class="tr-meta"><div class="tr-name">\${escHtml(last.symbol)}</div><div class="tr-sub">Son analiz · Tekrar aç</div></div></div>
        <span class="tr-mcap">—</span>
        <span class="tr-price">\${escHtml(last.price || '—')}</span>
        <span class="tr-age">—</span>
        <span class="tr-pct \${chgClass(last.chg)}">\${escHtml(lastChg)}</span>
        <span class="tr-vol" aria-hidden="true"></span>
        <span class="tr-liq" aria-hidden="true"></span>
        \${riskColHtml(r.cls, r.text, up)}
      </article>\`;`;

if (!re.test(s)) {
  console.error('not found');
  process.exit(1);
}
s = s.replace(re, clean);
fs.writeFileSync(p, s);
console.log('fixed');
