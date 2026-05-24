#!/usr/bin/env node
/**
 * Tek referans profilden tüm cihazları üretir ve kaydeder.
 *
 * Örnek (app13 referans, mevcut app13 bloğu):
 *   node scripts/scale-crop-from-reference.js --ref app13
 *
 * Özel JSON dosyası (telefondan export):
 *   node scripts/scale-crop-from-reference.js --ref app13 --block ./henry-ref.json --width 390
 */
const fs = require('fs');
const path = require('path');
const { scaleFromReference, CANONICAL_WIDTH } = require('../src/cropScaleReference');
const cropProfiles = require('../src/cropProfiles');

const ROOT = path.join(__dirname, '..');
const PROFILES_JSON = path.join(ROOT, 'public', 'miniapp', 'dex-crop-profiles.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { ref: 'app13', blockPath: '', width: 0, dry: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--ref' && args[i + 1]) {
      out.ref = args[++i];
      continue;
    }
    if ((args[i] === '--block' || args[i] === '--file') && args[i + 1]) {
      out.blockPath = args[++i];
      continue;
    }
    if (args[i] === '--width' && args[i + 1]) {
      out.width = Number(args[++i]);
      continue;
    }
    if (args[i] === '--dry') out.dry = true;
  }
  return out;
}

function main() {
  const { ref, blockPath, width, dry } = parseArgs();
  const data = JSON.parse(fs.readFileSync(PROFILES_JSON, 'utf8'));
  let refBlock = data.profiles?.[ref];
  if (blockPath) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(blockPath), 'utf8'));
    refBlock = raw.chart ? raw : raw.profiles?.[ref] || raw;
  }
  if (!refBlock?.chart) {
    console.error(`Referans profil bulunamadı: ${ref}`);
    process.exit(1);
  }
  const refWidth = width > 0 ? width : CANONICAL_WIDTH[ref] || 390;
  const scaled = scaleFromReference(ref, refBlock, refWidth, data.profiles);
  console.log(scaled.note);
  Object.entries(CANONICAL_WIDTH).forEach(([id, w]) => {
    const c = scaled.profiles[id].chart;
    const t = scaled.profiles[id].trades;
    console.log(
      `  ${id} (${w}px): chart stageH=${c.stageH} top=${c.top} | trades viewH=${t.viewH} iframeTop=${t.iframeTop}`,
    );
  });
  if (dry) {
    console.log('\n--dry: dosyaya yazılmadı');
    return;
  }
  const saved = cropProfiles.saveBakedProfiles({
    version: 1,
    profiles: scaled.profiles,
    note: scaled.note,
  });
  console.log('\nKaydedildi:', saved.updatedAt);
}

main();
