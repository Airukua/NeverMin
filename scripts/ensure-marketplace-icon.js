/**
 * Ensure media/icon.png meets VS Marketplace rules:
 * - PNG
 * - at least 128x128 (square preferred)
 *
 * If a valid custom icon already exists, leave it alone.
 * Only write a fallback when missing or too small.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MIN = 128;
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

function readPngSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

function writeFallbackPng(size) {
  // Approximate NeverMIN mark: outer crescent + inner bean on dark field.
  function pixel(x, y) {
    const cx = (x + 0.5) / size;
    const cy = (y + 0.5) / size;
    // dark background (marketplace tiles are light/dark — solid near-black is fine)
    let r = 10;
    let g = 12;
    let b = 16;
    let a = 255;

    const dx = cx - 0.5;
    const dy = cy - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // outer ring arc (bottom-right heavy)
    const outer =
      dist > 0.22 &&
      dist < 0.42 &&
      !(dx < -0.05 && dy < -0.02);
    // inner bean
    const ix = (cx - 0.42) / 0.22;
    const iy = (cy - 0.38) / 0.18;
    const inner = ix * ix + iy * iy < 1 && cx > 0.28 && cy < 0.58;

    if (outer) {
      r = 45;
      g = 120;
      b = 95;
    }
    if (inner) {
      r = 125;
      g = 206;
      b = 184;
    }
    return [r, g, b, a];
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

if (fs.existsSync(OUT)) {
  const existing = fs.readFileSync(OUT);
  const dim = readPngSize(existing);
  if (dim && dim.width >= MIN && dim.height >= MIN) {
    console.log(`OK media/icon.png ${dim.width}x${dim.height} (Marketplace ready)`);
    process.exit(0);
  }
  if (dim) {
    console.warn(
      `media/icon.png is ${dim.width}x${dim.height} — Marketplace needs >= ${MIN}x${MIN}. Replacing with fallback.`
    );
  } else {
    console.warn('media/icon.png is not a valid PNG. Replacing with fallback.');
  }
} else {
  console.warn('media/icon.png missing. Writing fallback.');
}

const png = writeFallbackPng(MIN);
fs.writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${MIN}x${MIN}, ${png.length} bytes)`);
