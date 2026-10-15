#!/usr/bin/env node
/**
 * Generates the app icons from one vector description (no dependencies).
 * Writes assets/icons/icon.svg, favicon.svg, icon-192.png, icon-512.png, maskable-512.png.
 * Usage: node parley/tools/make-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/icons');
const CORAL = [0xFF, 0x5B, 0x4A];
const EDGE = [0xD6, 0x3E, 0x2F];
const WHITE = [0xFF, 0xFF, 0xFF];

// Geometry on a 100x100 canvas. Bubble with tail, three sound bars.
const BUBBLE = { x: 20, y: 22, w: 60, h: 44, r: 14 };
const TAIL = [[30, 62], [46, 62], [28, 80]];
const BARS = [{ x: 37, y1: 37, y2: 51 }, { x: 50, y1: 31, y2: 57 }, { x: 63, y1: 37, y2: 51 }];
const BAR_W = 7;

function svgSource(maskable) {
  const s = maskable ? 0.72 : 1;
  const t = (v) => (50 + (v - 50) * s).toFixed(2);
  const bg = maskable
    ? '<rect width="100" height="100" fill="#FF5B4A"/>'
    : '<rect x="2" y="2" width="96" height="96" rx="24" fill="#D63E2F"/><rect x="2" y="2" width="96" height="91" rx="24" fill="#FF5B4A"/>';
  const b = BUBBLE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}`
    + `<rect x="${t(b.x)}" y="${t(b.y)}" width="${(b.w * s).toFixed(2)}" height="${(b.h * s).toFixed(2)}" rx="${(b.r * s).toFixed(2)}" fill="#FFFFFF"/>`
    + `<path d="M${TAIL.map(([x, y]) => `${t(x)} ${t(y)}`).join(' L')} Z" fill="#FFFFFF"/>`
    + BARS.map((bar) => `<line x1="${t(bar.x)}" y1="${t(bar.y1)}" x2="${t(bar.x)}" y2="${t(bar.y2)}" stroke="#FF5B4A" stroke-width="${(BAR_W * s).toFixed(2)}" stroke-linecap="round"/>`).join('')
    + '</svg>\n';
}

const inRoundRect = (x, y, rx, ry, w, h, r) => {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return x >= rx && x <= rx + w && y >= ry && y <= ry + h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inTriangle = (x, y, [a, b, c]) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([x, y], a, b), d2 = s([x, y], b, c), d3 = s([x, y], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const inCapsule = (x, y, bar, w) => {
  const cy = Math.min(Math.max(y, bar.y1), bar.y2);
  return (x - bar.x) ** 2 + (y - cy) ** 2 <= (w / 2) ** 2;
};

/** Returns the color at a point in 100x100 space, or null for transparent. */
function colorAt(x, y, maskable) {
  const s = maskable ? 0.72 : 1;
  const u = 50 + (x - 50) / s;
  const v = 50 + (y - 50) / s;
  let base;
  if (maskable) base = CORAL;
  else if (inRoundRect(x, y, 2, 2, 96, 91, 24)) base = CORAL;
  else if (inRoundRect(x, y, 2, 2, 96, 96, 24)) base = EDGE;
  else return null;
  const b = BUBBLE;
  if (inRoundRect(u, v, b.x, b.y, b.w, b.h, b.r) || inTriangle(u, v, TAIL)) {
    return BARS.some((bar) => inCapsule(u, v, bar, BAR_W)) ? CORAL : WHITE;
  }
  return base;
}

function render(size, maskable) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, bl = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) {
        const c = colorAt(((i + (si + 0.5) / SS) / size) * 100, ((j + (sj + 0.5) / SS) / size) * 100, maskable);
        if (c) { r += c[0]; g += c[1]; bl += c[2]; a += 1; }
      }
      const o = (j * size + i) * 4;
      if (a) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(bl / a); }
      px[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.svg'), svgSource(false));
fs.writeFileSync(path.join(OUT, 'favicon.svg'), svgSource(false));
fs.writeFileSync(path.join(OUT, 'icon-192.png'), render(192, false));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), render(512, false));
fs.writeFileSync(path.join(OUT, 'maskable-512.png'), render(512, true));
console.log(`Icons written to ${OUT}`);
