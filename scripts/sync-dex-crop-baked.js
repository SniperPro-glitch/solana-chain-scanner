/**
 * public/miniapp/dex-crop-profiles.json →
 *   dex-crop-baked.js, dex-crop-profiles.css, data/dex-crop-profiles.json
 * Kalibrasyon sonrası: node scripts/sync-dex-crop-baked.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public', 'miniapp', 'dex-crop-profiles.json');
const srcFallback = path.join(root, 'data', 'dex-crop-profiles.json');
const srcPath = fs.existsSync(src) ? src : srcFallback;
const bakedOut = path.join(root, 'public', 'miniapp', 'dex-crop-baked.js');
const cssOut = path.join(root, 'public', 'miniapp', 'dex-crop-profiles.css');
const dataOut = path.join(root, 'data', 'dex-crop-profiles.json');

const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
if (!data?.profiles) {
  console.error('profiles eksik:', src);
  process.exit(1);
}

function cssVarsForProfile(id, block) {
  const c = block.chart || {};
  const t = block.trades || {};
  const tape = block.tape || {};
  const brand = Number(c.brandCrop) || 0;
  return `html[data-dex-crop-profile="${id}"] {
  --chart-embed-h: ${c.stageH}px;
  --chart-embed-top: ${c.top}px;
  --chart-shift-down: ${c.shiftDown || 0}px;
  --chart-embed-left: ${c.left}%;
  --chart-embed-width: ${c.width}%;
  --chart-embed-extra: ${c.heightExtra || 0}px;
  --chart-brand-crop: ${brand}px;
  --tape-shift-down: ${tape.shiftDown || 0}px;
  --dex-trades-view-h: ${t.viewH}px;
  --dex-iframe-h: ${t.iframeH}px;
  --dex-iframe-top: ${t.iframeTop}px;
  --dex-trades-shift-down: ${t.shiftDown || 0}px;
  --dex-iframe-left: ${t.left}%;
  --dex-iframe-width: ${t.width}%;
  --dex-mask-top-h: ${t.maskTop || 0}px;
  --dex-mask-foot-h: ${t.maskFoot || 0}px;
}

html[data-dex-crop-profile="${id}"] .chart-terminal--dex-embed .chart-stage {
  height: ${c.stageH}px !important;
  min-height: ${c.stageH}px !important;
  max-height: ${c.stageH}px !important;
}

html[data-dex-crop-profile="${id}"] .dex-trades-embed-wrap {
  height: ${t.viewH}px !important;
  min-height: ${t.viewH}px !important;
  max-height: ${t.viewH}px !important;
}
`;
}

const profileIds = Object.keys(data.profiles);
const cssParts = [
  '/* Otomatik — scripts/sync-dex-crop-baked.js — kayıtlı 5 cihaz profili */',
  ...profileIds.map((id) => cssVarsForProfile(id, data.profiles[id])),
];
fs.writeFileSync(cssOut, `${cssParts.join('\n')}\n`, 'utf8');

const bakedJs = `/** Otomatik — scripts/sync-dex-crop-baked.js · ${data.updatedAt || 'sync'} */\nglobalThis.__DEX_CROP_BAKED__=${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(bakedOut, bakedJs, 'utf8');

const dataCopy = {
  ...data,
  note: '5 cihaz — kaynak public/miniapp/dex-crop-profiles.json',
};
fs.mkdirSync(path.dirname(dataOut), { recursive: true });
fs.writeFileSync(dataOut, `${JSON.stringify(dataCopy, null, 2)}\n`, 'utf8');

console.log('OK:', bakedOut);
console.log('OK:', cssOut);
console.log('OK:', dataOut);
console.log('Profiller:', profileIds.join(', '));
