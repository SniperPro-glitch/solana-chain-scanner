/**
 * Build 640x360 BotFather description GIF from a PNG screenshot.
 * Usage: node scripts/make-description-gif.js [input.png] [output.gif]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import GIFEncoder from 'gif-encoder-2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const input =
  process.argv[2] ||
  path.join(root, 'public', 'bot-assets', 'dexscanner-live-ui.png');
const output =
  process.argv[3] ||
  path.join(root, 'public', 'bot-assets', 'dexscanner-description-640x360.gif');

const W = 640;
const H = 360;
const FRAMES = 24;
const DELAY_MS = 80;

const base = await sharp(input)
  .resize(W, H, { fit: 'cover', position: 'top' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data, info } = base;
const channels = info.channels;

function frameBuffer(zoom) {
  const zw = Math.round(W * zoom);
  const zh = Math.round(H * zoom);
  const ox = Math.round((zw - W) / 2);
  const oy = Math.round((zh - H) / 2);
  const out = Buffer.alloc(W * H * channels, 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(W - 1, Math.max(0, x + ox));
      const sy = Math.min(H - 1, Math.max(0, y + oy));
      const si = (sy * W + sx) * channels;
      const oi = (y * W + x) * channels;
      for (let c = 0; c < channels; c++) out[oi + c] = data[si + c];
    }
  }
  return out;
}

const encoder = new GIFEncoder(W, H, 'neuquant', true);
encoder.setDelay(DELAY_MS);
encoder.setRepeat(0);
encoder.setQuality(10);
encoder.start();

for (let i = 0; i < FRAMES; i++) {
  const t = i / (FRAMES - 1);
  const zoom = 1 + 0.04 * Math.sin(t * Math.PI * 2);
  encoder.addFrame(frameBuffer(zoom));
}

encoder.finish();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, encoder.out.getData());
console.log('Wrote', output, `(${FRAMES} frames, ${W}x${H})`);
