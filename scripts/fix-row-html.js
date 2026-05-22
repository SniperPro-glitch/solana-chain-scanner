const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  'MCap ${escHtml(item.marketCapUsdFmt)}</div></motion>',
  'MCap ${escHtml(item.marketCapUsdFmt)}</div></div></div>',
);
s = s.replace(
  /function renderLastReportRow[\s\S]*?catch \{\s*return '';\s*\}\s*\}/,
  `function renderLastReportRow() {
    try {
      const last = JSON.parse(sessionStorage.getItem('lastReport') || 'null');
      if (!last?.id) return '';
      const r = riskBadgeLabel(last.level, last.score);
      const up = (last.chg || 0) >= 0;
      return \`<article class="token-row token-row-last" data-report="\${escHtml(last.id)}">
        <span class="tr-rank">★</span>
        <div class="tr-token"><span class="tr-avatar">\${escHtml((last.symbol || '?').slice(0, 2))}</span><div class="tr-meta"><motion class="tr-name">\${escHtml(last.symbol)}</motion><div class="tr-sub">Son analiz · Tekrar aç</div></div></div>
        <span class="tr-price">\${escHtml(last.price || '—')}</span>
        <span class="tr-pct"></span><span class="tr-pct"></span><span class="tr-vol"></span><span class="tr-liq"></span>
        <div class="tr-risk-col">\${miniSparkline(up)}<span class="risk-badge \${r.cls}">\${r.text}</span></div>
      </article>\`;
    } catch {
      return '';
    }
  }`.split('motion').join('div'),
);
fs.writeFileSync(p, s);
console.log('row fix ok');
