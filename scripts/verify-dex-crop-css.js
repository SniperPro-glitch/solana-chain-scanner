/**
 * Kayıtlı JSON ölçüleri ↔ üretilen dex-crop-profiles.css doğrulama
 */
const fs = require('fs');
const path = require('path');

const json = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.json'), 'utf8'),
);
const css = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.css'),
  'utf8',
);

let ok = true;
for (const [id, block] of Object.entries(json.profiles)) {
  const t = block.trades;
  const c = block.chart;
  const checks = [
    [`html[data-dex-crop-profile="${id}"]`, `--dex-trades-view-h: ${t.viewH}px`],
    [`html[data-dex-crop-profile="${id}"]`, `--dex-iframe-top: ${t.iframeTop}px`],
    [`html[data-dex-crop-profile="${id}"]`, `--dex-trades-shift-down: ${t.shiftDown || 0}px`],
    [`html[data-dex-crop-profile="${id}"]`, `--dex-iframe-h: ${t.iframeH}px`],
    [`html[data-dex-crop-profile="${id}"] .dex-trades-embed-wrap`, `height: ${t.viewH}px !important`],
    [`html[data-dex-crop-profile="${id}"]`, `--chart-embed-h: ${c.stageH}px`],
  ];
  for (const [ctx, needle] of checks) {
    const slice = css.includes(ctx) && css.includes(needle);
    if (!slice) {
      console.error('FAIL', id, needle);
      ok = false;
    }
  }
}
if (ok) console.log('OK: 5 profil CSS dosyasında kayıtlı ölçülerle eşleşiyor');
process.exit(ok ? 0 : 1);
