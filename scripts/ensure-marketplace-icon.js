/**
 * Writes a minimal 128x128 Marketplace PNG to media/icon.png (no native deps).
 * Prefer replacing with a designed asset when available.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 128;
const OUT = path.join(__dirname, '..', 'media', 'icon.png');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pixel(x, y) {
  // charcoal background
  let r = 26;
  let g = 29;
  let b = 35;
  // soft mint N strokes
  const inLeft = x >= 34 && x <= 48 && y >= 28 && y <= 100;
  const inRight = x >= 80 && x <= 94 && y >= 28 && y <= 100;
  const diag = Math.abs((y - 28) - ((x - 48) * (72 / 32))) < 8 && x >= 48 && x <= 80 && y >= 28 && y <= 100;
  if (inLeft || inRight || diag) {
    r = 125;
    g = 206;
    b = 184;
  }
  return [r, g, b, 255];
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  for (let x = 0; x < SIZE; x += 1) {
    const [r, g, b, a] = pixel(x, y);
    const offset = rowStart + 1 + x * 4;
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
    raw[offset + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length} bytes)`);
