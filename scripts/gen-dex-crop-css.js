/** data/dex-crop-profiles.json → public/miniapp/dex-crop-profiles.css + dex-crop-baked.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'dex-crop-profiles.json'), 'utf8'));

function block(id, b) {
  const t = b.trades || {};
  return [
    `html[data-dex-crop-profile="${id}"] {`,
    `  --dex-trades-view-h: ${t.viewH}px;`,
    `  --dex-iframe-h: ${t.iframeH}px;`,
    `  --dex-iframe-top: ${t.iframeTop}px;`,
    `  --dex-trades-shift-down: ${t.shiftDown || 0}px;`,
    `  --dex-iframe-left: ${t.left}%;`,
    `  --dex-iframe-width: ${t.width}%;`,
    '}',
    `html[data-dex-crop-profile="${id}"] .dex-trades-embed-wrap {`,
    `  height: ${t.viewH}px !important;`,
    `  min-height: ${t.viewH}px !important;`,
    `  max-height: ${t.viewH}px !important;`,
    '}',
  ].join('\n');
}

const css = [
  '/* Otomatik — scripts/gen-dex-crop-css.js */',
  ...Object.entries(data.profiles).flatMap(([id, b]) => [block(id, b), '']),
  `.dex-trades-embed-wrap {
  position: relative;
  overflow: hidden;
  background: #0d1117;
}
.dex-trades-embed {
  position: absolute;
  border: 0;
  left: var(--dex-iframe-left, 0);
  width: var(--dex-iframe-width, 100%);
  height: var(--dex-iframe-h, 800px);
  top: calc(var(--dex-iframe-top, -500px) + var(--dex-trades-shift-down, 0px));
  background: #0d1117;
}
.dex-mask {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 2;
}
.dex-mask-top {
  top: 0;
  height: var(--dex-mask-top-h, 6px);
  background: #0d1117;
}
.dex-mask-foot {
  bottom: 0;
  height: var(--dex-mask-foot-h, 6px);
  background: #0d1117;
}
.trades-tape--dex-embed .trades-thead,
.trades-tape--dex-embed #tradesList {
  display: none !important;
}
`,
].join('\n');

const outDir = path.join(root, 'public', 'miniapp');
fs.writeFileSync(path.join(outDir, 'dex-crop-profiles.css'), css);
fs.writeFileSync(
  path.join(outDir, 'dex-crop-baked.js'),
  `/** Otomatik — scripts/gen-dex-crop-css.js */\nglobalThis.__DEX_CROP_BAKED__=${JSON.stringify(data)};\n`,
);
console.log('ok', path.join(outDir, 'dex-crop-profiles.css'));
