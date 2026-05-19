const fs = require('fs');
const d = 'motion';
const open = (cls) => `<${'div'} class="${cls}">`;
const close = `</${'motion'}>`.replace('motion', 'div');
const html = [
  '<!DOCTYPE html><html lang="tr"><head>',
  '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
  '<title>Layout check</title>',
  '<link rel="stylesheet" href="/styles.css?v=42"/>',
  '<link rel="stylesheet" href="/dex-scanner.css?v=39"/>',
  '</head><body class="web-browser">',
  open('scanner-home') + '<style>.scanner-home{min-height:100dvh;padding:8px}</style>',
  open('token-table-scroll') + open('token-table-inner') + open('token-list'),
  '<article class="token-row token-row-last">',
  '<span class="tr-rank">★</span>',
  open('tr-token') + '<span class="tr-avatar">PI</span>' + open('tr-meta'),
  open('tr-name') + 'PIGEON' + close + open('tr-sub') + 'Son analiz' + close + close + close,
  '<span class="tr-mcap">—</span><span class="tr-price">$0.0000637</span>',
  '<span class="tr-age">—</span><span class="tr-pct down">-84.5%</span>',
  '<span class="tr-vol"></span><span class="tr-liq"></span>',
  open('tr-risk-col') + '<span class="risk-badge low">LOW RISK</span>' + close,
  '</article>',
  '<article class="token-row">',
  '<span class="tr-rank">1</span>',
  open('tr-token') + '<span class="tr-avatar">PI</span>' + open('tr-meta'),
  open('tr-name') + 'PIGEON' + close + open('tr-sub'),
  '<span class="tr-mcap-inline">$717.23K</span> · Pump' + close + close + close,
  '<span class="tr-mcap">$717.23K</span><span class="tr-price">$0.000717</span>',
  '<span class="tr-age">1d</span><span class="tr-pct up">+1.9K%</span>',
  '<span class="tr-vol"></span><span class="tr-liq"></span>',
  open('tr-risk-col') + '<span class="risk-badge low">LOW RISK</span>' + close,
  '</article>',
  close + close + close + close,
  '</body></html>',
].join('');
fs.writeFileSync('public/miniapp/dev-layout-check.html', html);
console.log('ok', html.length);
