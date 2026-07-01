import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = new URL('../public/', import.meta.url);

const COLORS = {
  bg: [15, 17, 19, 255],
  blue: [47, 111, 237, 255],
  white: [248, 250, 252, 255],
  mint: [98, 220, 165, 255],
};

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3];
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + width);
  const y1 = Math.ceil(y + height);
  const r = Math.max(0, radius);
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const cx = px < x + r ? x + r : px > x + width - r ? x + width - r : px;
      const cy = py < y + r ? y + r : py > y + height - r ? y + height - r : py;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r ** 2) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const x0 = Math.floor(cx - radius);
  const y0 = Math.floor(cy - radius);
  const x1 = Math.ceil(cx + radius);
  const y1 = Math.ceil(cy + radius);
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function strokeLine(canvas, x1, y1, x2, y2, width, color) {
  const radius = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - radius);
  const maxX = Math.ceil(Math.max(x1, x2) + radius);
  const minY = Math.floor(Math.min(y1, y2) - radius);
  const maxY = Math.ceil(Math.max(y1, y2) + radius);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= radius ** 2) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function renderMark(size) {
  const scale = 4;
  const canvas = createCanvas(size * scale, size * scale);
  const s = (size * scale) / 64;
  const drawRoundedRect = (x, y, width, height, radius, color) =>
    fillRoundedRect(canvas, x * s, y * s, width * s, height * s, radius * s, color);
  const drawCircle = (cx, cy, radius, color) =>
    fillCircle(canvas, cx * s, cy * s, radius * s, color);
  const drawLine = (x1, y1, x2, y2, width, color) =>
    strokeLine(canvas, x1 * s, y1 * s, x2 * s, y2 * s, width * s, color);

  drawRoundedRect(0, 0, 64, 64, 14, COLORS.bg);
  drawRoundedRect(13, 12, 36, 25, 4, COLORS.blue);
  drawLine(18, 20, 40, 20, 3.5, COLORS.bg);
  drawLine(18, 27, 40, 27, 3.5, COLORS.bg);
  drawLine(18, 34, 31, 34, 3.5, COLORS.bg);
  drawRoundedRect(22, 33, 29, 9, 3.5, COLORS.white);
  drawRoundedRect(22, 43, 29, 9, 3.5, COLORS.white);
  drawLine(27, 42, 46, 42, 3, COLORS.bg);
  drawLine(27, 52, 42, 52, 3, COLORS.bg);
  drawCircle(49, 48, 8.5, COLORS.mint);
  drawLine(45, 48, 48, 51, 3, COLORS.bg);
  drawLine(48, 51, 54, 44, 3, COLORS.bg);

  return downsample(canvas, size, size, scale);
}

function downsample(source, width, height, scale) {
  const canvas = createCanvas(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = ((y * scale + sy) * source.width + x * scale + sx) * 4;
          totals[0] += source.data[index];
          totals[1] += source.data[index + 1];
          totals[2] += source.data[index + 2];
          totals[3] += source.data[index + 3];
        }
      }
      setPixel(
        canvas,
        x,
        y,
        totals.map((value) => Math.round(value / (scale * scale))),
      );
    }
  }
  return canvas;
}

function pngBuffer(canvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowOffset = y * (canvas.width * 4 + 1);
    raw[rowOffset] = 0;
    Buffer.from(canvas.data.slice(y * canvas.width * 4, (y + 1) * canvas.width * 4)).copy(
      raw,
      rowOffset + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND'),
  ]);
}

function writePng(relativePath, canvas) {
  const url = new URL(relativePath, ROOT);
  mkdirSync(dirname(url.pathname), { recursive: true });
  writeFileSync(url, pngBuffer(canvas));
}

writePng('icons/favicon-16.png', renderMark(16));
writePng('icons/favicon-32.png', renderMark(32));
writePng('icons/icon-192.png', renderMark(192));
writePng('icons/icon-512.png', renderMark(512));
writePng('apple-touch-icon.png', renderMark(180));
writePng('og/logo.png', renderMark(512));
