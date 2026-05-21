/**
 * public/miniapp/dex-crop-profiles.json → dex-crop-baked.js + data/dex-crop-profiles.json
 * Kalibrasyon sonrası: node scripts/sync-dex-crop-baked.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public', 'miniapp', 'dex-crop-profiles.json');
const bakedOut = path.join(root, 'public', 'miniapp', 'dex-crop-baked.js');
const dataOut = path.join(root, 'data', 'dex-crop-profiles.json');

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
if (!data?.profiles) {
  console.error('profiles eksik:', src);
  process.exit(1);
}

const bakedJs = `/** Otomatik — scripts/sync-dex-crop-baked.js · ${data.updatedAt || 'sync'} */\nglobalThis.__DEX_CROP_BAKED__=${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(bakedOut, bakedJs, 'utf8');

const dataCopy = {
  ...data,
  note: '5 cihaz — kaynak public/miniapp/dex-crop-profiles.json',
};
fs.mkdirSync(path.dirname(dataOut), { recursive: true });
fs.writeFileSync(dataOut, `${JSON.stringify(dataCopy, null, 2)}\n`, 'utf8');

console.log('OK:', bakedOut);
console.log('OK:', dataOut);
console.log('Profiller:', Object.keys(data.profiles).join(', '));
