// Generates the extension icons (public/icon/16.png ... 128.png) without any dependencies.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;
const TOP = [0x3b, 0x6c, 0xf6];
const BOTTOM = [0x25, 0x4a, 0xc4];
const CHECK = [
  [0.27, 0.53],
  [0.43, 0.69],
  [0.74, 0.33],
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(x, y, radius) {
  // Unit square [0,1]^2 with the given corner radius.
  const dx = Math.max(radius - x, 0, x - (1 - radius));
  const dy = Math.max(radius - y, 0, y - (1 - radius));
  return dx * dx + dy * dy <= radius * radius;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function onCheck(x, y, halfWidth) {
  return (
    distanceToSegment(x, y, CHECK[0], CHECK[1]) <= halfWidth ||
    distanceToSegment(x, y, CHECK[1], CHECK[2]) <= halfWidth
  );
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let background = 0;
      let check = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!insideRoundedSquare(x, y, 0.22)) continue;
          background += 1;
          if (onCheck(x, y, 0.075)) check += 1;
        }
      }
      const gradient = (py + 0.5) / size;
      const base = TOP.map((top, i) => top + (BOTTOM[i] - top) * gradient);
      const whiteShare = background === 0 ? 0 : check / background;
      const offset = (py * size + px) * 4;
      for (let i = 0; i < 3; i += 1) {
        pixels[offset + i] = Math.round(base[i] * (1 - whiteShare) + 255 * whiteShare);
      }
      pixels[offset + 3] = Math.round((background / samples) * 255);
    }
  }
  return pixels;
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = join(outDir, `${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote ${file}`);
}
