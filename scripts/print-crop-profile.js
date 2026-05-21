/**
 * Kayıtlı kırpma profillerini yazdır — kalibrasyon sonrası karşılaştırma.
 * node scripts/print-crop-profile.js [web|app13|...]
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.json');
const id = process.argv[2] || 'web';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const p = data.profiles?.[id];
if (!p) {
  console.error('Profil yok:', id);
  process.exit(1);
}
const t = p.trades;
const c = p.chart;
console.log(`Profil: ${id}  updated: ${data.updatedAt || '?'}`);
console.log('chart:', { stageH: c.stageH, top: c.top, left: c.left, width: c.width, shiftDown: c.shiftDown });
console.log('trades:', {
  viewH: t.viewH,
  iframeTop: t.iframeTop,
  shiftDown: t.shiftDown,
  iframeH: t.iframeH,
  left: t.left,
  width: t.width,
});
