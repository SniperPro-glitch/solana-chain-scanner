/**
 * /start & BotFather Description — 640×360, yuvarlatılmış köşeler, net çıktı.
 * Canva'dan mümkünse 1280×720 veya 1920×1080 PNG indir (küçük JPEG piksel yapar).
 *
 * Usage: node scripts/prepare-welcome-image.js path/to/image.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPng = path.join(root, 'public', 'bot-assets', 'dex-welcome-start.png');
const outJpg = path.join(root, 'public', 'bot-assets', 'dex-welcome-start.jpg');
const outHi = path.join(root, 'public', 'bot-assets', 'dex-welcome-start@2x.png');

const W = 640;
const H = 360;
const RADIUS = parseInt(process.env.WELCOME_CORNER_RADIUS || '36', 10);

const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error('Kullanım: node scripts/prepare-welcome-image.js <girdi.png|jpg>');
  process.exit(1);
}

const meta = await sharp(input).metadata();
const iw = meta.width || 0;
const ih = meta.height || 0;
console.log(`Girdi: ${iw}×${ih} (${meta.format})`);

if (iw < W || ih < H) {
  console.warn('⚠️ Girdi 640×360\'tan küçük — Canva\'dan 1280×720 PNG indirmen daha net olur.');
}

let pipeline = sharp(input).rotate(); // EXIF düzelt

// Sadece büyük dosyada küçült (Lanczos3 + hafif keskinleştirme). Aynı boyutta resize YOK.
if (iw > W + 2 || ih > H + 2) {
  pipeline = pipeline.resize(W, H, {
    fit: 'cover',
    position: 'centre',
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: true,
  });
  if (iw >= W * 1.25) {
    pipeline = pipeline.sharpen({ sigma: 0.5, m1: 0.5, m2: 0.25 });
  }
} else if (iw !== W || ih !== H) {
  pipeline = pipeline.resize(W, H, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 });
}

const maskSvg = Buffer.from(
  `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`,
);

pipeline = pipeline
  .ensureAlpha()
  .composite([{ input: maskSvg, blend: 'dest-in' }]);

fs.mkdirSync(path.dirname(outPng), { recursive: true });
await pipeline.clone().png({ compressionLevel: 6, effort: 10 }).toFile(outPng);
await pipeline
  .clone()
  .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
  .toFile(outJpg);

// Telegram retina — sadece kaynak yeterince büyükse
if (iw >= 960) {
  const mask2x = Buffer.from(
    `<svg width="${W * 2}" height="${H * 2}"><rect width="${W * 2}" height="${H * 2}" rx="${RADIUS * 2}" ry="${RADIUS * 2}" fill="#fff"/></svg>`,
  );
  await sharp(input)
    .rotate()
    .resize(W * 2, H * 2, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.45, m1: 0.5, m2: 0.25 })
    .ensureAlpha()
    .composite([{ input: mask2x, blend: 'dest-in' }])
    .png({ compressionLevel: 6 })
    .toFile(outHi);
  console.log('OK', outHi, '(1280×720 — bot önce bunu dener)');
}

console.log('OK', outPng);
console.log('OK', outJpg);
console.log(`${W}×${H}, köşe ${RADIUS}px`);
