#!/usr/bin/env node
/* ============================================================================
   make-qr.js — export the card's QR code on its own.

       node tools/make-qr.js

   Writes into dist/:
       mahak-jain-qr.svg          vector — scales to any size, best for print
       mahak-jain-qr-card.png     the exact size printed on the card
       mahak-jain-qr-1024.png     large raster for slides, email signatures

   Encodes PROFILE.siteUrl, with the same error-correction level and the same
   whole-pixel module snapping the card uses, so the standalone file and the
   card carry an identical symbol.

   No dependencies: PNGs are written with Node's built-in zlib.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const QR = require(path.join(ROOT, 'assets', 'js', 'qr.js'));
const PROFILE = require(path.join(ROOT, 'config', 'profile.js'));

/* --- the same gate the card uses ----------------------------------------- */
function validate(raw) {
  const v = String(raw || '').trim();
  if (!v) return { ok: false, why: 'siteUrl is empty — deploy the page first' };
  if (/[\[\]]/.test(v)) return { ok: false, why: 'siteUrl is still a placeholder' };
  let u;
  try { u = new URL(v); } catch { return { ok: false, why: 'siteUrl is not a valid absolute URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, why: 'siteUrl must be http(s)' };
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || /\.localhost$|\.local$/.test(h) || h === '0.0.0.0' ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return { ok: false, why: 'siteUrl points at a development address' };
  }
  if (!h.includes('.')) return { ok: false, why: 'siteUrl has no domain' };
  return { ok: true, url: v };
}

/* --- minimal 8-bit greyscale PNG writer ---------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** @param {Uint8Array} pixels one byte per pixel, 0 = black, 255 = white */
function writePng(file, pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;        // bit depth
  ihdr[9] = 0;        // colour type 0 = greyscale
  ihdr[10] = 0;       // deflate
  ihdr[11] = 0;       // adaptive filtering
  ihdr[12] = 0;       // no interlace

  // raw scanlines, each prefixed with filter type 0
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width, width)
      .copy(raw, y * (width + 1) + 1);
  }

  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

/* Render the symbol to a pixel buffer at `modPx` per module, with a quiet
   zone of at least 4 modules — the standard's minimum. */
function rasterise(qr, modPx, quietModules = 4) {
  const n = qr.size + quietModules * 2;
  const size = n * modPx;
  const px = new Uint8Array(size * size).fill(255);
  for (let my = 0; my < qr.size; my++) {
    for (let mx = 0; mx < qr.size; mx++) {
      if (!qr.modules[my][mx]) continue;
      const x0 = (mx + quietModules) * modPx;
      const y0 = (my + quietModules) * modPx;
      for (let dy = 0; dy < modPx; dy++) {
        px.fill(0, (y0 + dy) * size + x0, (y0 + dy) * size + x0 + modPx);
      }
    }
  }
  return { px, size };
}

function svg(qr, quietModules = 4) {
  const n = qr.size + quietModules * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 8}" height="${n * 8}"`,
    ` shape-rendering="crispEdges" role="img" aria-label="QR code for ${qr.text}">`,
    `<title>${qr.text}</title>`,
    `<rect width="${n}" height="${n}" fill="#FFFFFF"/>`,
    `<g transform="translate(${quietModules} ${quietModules})" fill="#161616">`,
    `<path d="${QR.toPath(qr)}"/>`,
    `</g></svg>`, ''
  ].join('');
}

/* --- go ------------------------------------------------------------------ */
const check = validate(PROFILE.siteUrl);
if (!check.ok) {
  console.error('Cannot build the QR: ' + check.why + '.');
  console.error('No file written — a placeholder QR is never produced.');
  process.exit(1);
}

const ecc = (PROFILE.print && PROFILE.print.qrEcc) || 'M';
const sizeIn = (PROFILE.print && PROFILE.print.qrSizeIn) || 0.84;
const qr = QR.encode(check.url, { ecc });

const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });

// vector
const svgPath = path.join(dist, 'mahak-jain-qr.svg');
fs.writeFileSync(svgPath, svg(qr));

// the card's own module size, so the two symbols are identical geometry
const cardMod = Math.max(2, Math.round((sizeIn * 300) / qr.size));
const card = rasterise(qr, cardMod);
writePng(path.join(dist, 'mahak-jain-qr-card.png'), card.px, card.size, card.size);

// a large one for slides and signatures
const bigMod = Math.max(2, Math.round(1024 / (qr.size + 8)));
const big = rasterise(qr, bigMod);
writePng(path.join(dist, 'mahak-jain-qr-1024.png'), big.px, big.size, big.size);

const mm = (n) => (n / 300 * 25.4).toFixed(1);
console.log('QR exported');
console.log('  encodes          ' + qr.text);
console.log('  symbol           version ' + qr.version + ', ' + qr.size + 'x' + qr.size +
            ' modules, level ' + qr.ecc + ', mask ' + qr.mask);
console.log('  mahak-jain-qr.svg          vector, scales to any size');
console.log('  mahak-jain-qr-card.png     ' + card.size + 'x' + card.size + ' px  = ' +
            mm(cardMod * qr.size) + ' mm at 300 DPI (same as the card)');
console.log('  mahak-jain-qr-1024.png     ' + big.size + 'x' + big.size + ' px  for screens');
console.log('  quiet zone       4 modules on every side');
