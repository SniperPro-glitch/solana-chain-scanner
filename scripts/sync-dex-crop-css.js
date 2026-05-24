#!/usr/bin/env node
/**
 * dex-crop-profiles.json → dex-scanner.css (tek kaynak, CSS değişkenleri)
 * Kullanım: node scripts/sync-dex-crop-css.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROFILES_JSON = path.join(ROOT, 'public', 'miniapp', 'dex-crop-profiles.json');
const CSS_FILE = path.join(ROOT, 'public', 'miniapp', 'dex-scanner.css');
const MARK_START = '/* AUTO_DEX_CROP_PROFILES_START */';
const MARK_END = '/* AUTO_DEX_CROP_PROFILES_END */';
const ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];

function px(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? `${v}px` : `${fallback}px`;
}

function pct(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? `${v}%` : `${fallback}%`;
}

function blockForProfile(id, block) {
  const c = block.chart || {};
  const t = block.trades || {};
  const tape = block.tape || {};
  return `html[data-dex-crop-profile="${id}"] {
  --chart-embed-h: ${px(c.stageH, 330)};
  --chart-embed-top: ${px(c.top, 0)};
  --chart-shift-down: ${px(c.shiftDown, 0)};
  --chart-embed-left: ${pct(c.left, 0)};
  --chart-embed-width: ${pct(c.width, 100)};
  --chart-embed-extra: ${px(c.heightExtra, 0)};
  --chart-brand-crop: ${px(c.brandCrop, 40)};
  --tape-shift-down: ${px(tape.shiftDown, 0)};
  --dex-trades-view-h: ${px(t.viewH, 302)};
  --dex-iframe-h: ${px(t.iframeH, 845)};
  --dex-iframe-top: ${px(t.iframeTop, -590)};
  --dex-trades-shift-down: ${px(t.shiftDown, 0)};
  --dex-iframe-left: ${pct(t.left, 0)};
  --dex-iframe-width: ${pct(t.width, 100)};
  --dex-mask-top-h: ${px(t.maskTop, 0)};
  --dex-mask-foot-h: ${px(t.maskFoot, 0)};
}`;
}

function generateSection(data) {
  const profiles = data?.profiles || {};
  const lines = [
    MARK_START,
    `/* Otomatik — ${path.basename(__filename)} · ${data.updatedAt || new Date().toISOString()} */`,
    '',
    'html:not([data-dex-crop-profile]) {',
    '  --dex-trades-view-h: 302px;',
    '  --chart-embed-h: 330px;',
    '}',
    '',
  ];
  ORDER.forEach((id) => {
    if (!profiles[id]) return;
    lines.push(blockForProfile(id, profiles[id]));
    lines.push('');
  });
  lines.push(MARK_END);
  return `${lines.join('\n')}\n`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(PROFILES_JSON, 'utf8'));
  let css = fs.readFileSync(CSS_FILE, 'utf8');
  const start = css.indexOf(MARK_START);
  const end = css.indexOf(MARK_END);
  const section = generateSection(data);
  if (start === -1 || end === -1) {
    console.error('Markers not found in dex-scanner.css — add AUTO_DEX_CROP_PROFILES_START/END');
    process.exit(1);
  }
  const before = css.slice(0, start);
  const after = css.slice(end + MARK_END.length);
  css = before + section + after.replace(/^\s*\n/, '\n');
  fs.writeFileSync(CSS_FILE, css, 'utf8');
  console.log('Synced crop CSS vars for:', ORDER.filter((id) => data.profiles?.[id]).join(', '));
}

main();
