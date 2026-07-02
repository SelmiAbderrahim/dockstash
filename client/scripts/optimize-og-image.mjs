// Re-encode public/og/default.png in place to a crawler-friendly size:
// 1200×630 (the standard Open Graph aspect) and well under 300 KB so social
// scrapers and AI crawlers fetch it fast. Run via `npm run assets:og` after
// replacing the artwork.
import { statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const TARGET = fileURLToPath(new URL('../public/og/default.png', import.meta.url));
const MAX_BYTES = 300_000;

const before = statSync(TARGET).size;

async function encode(quality) {
  return sharp(TARGET)
    .resize(1200, 630, { fit: 'cover' })
    .png({ palette: true, quality, compressionLevel: 9 })
    .toBuffer();
}

let output = await encode(90);
if (output.length > MAX_BYTES) {
  output = await encode(80);
}
if (output.length > MAX_BYTES) {
  console.error(`still ${output.length} bytes after quality=80 — reduce the artwork`);
  process.exit(1);
}

writeFileSync(TARGET, output);
const meta = await sharp(TARGET).metadata();
console.log(
  `og/default.png: ${before} → ${output.length} bytes (${meta.width}×${meta.height})`,
);
