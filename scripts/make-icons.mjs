// Generates the app icon + tray icon from signed-distance shapes, so the repo
// carries no binary assets and needs no image dependency.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(rootDir, 'assets');
const buildDir = join(rootDir, 'build');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedSquareAlpha(px, py, radius) {
  const dx = Math.max(Math.abs(px) - (1 - radius), 0);
  const dy = Math.max(Math.abs(py) - (1 - radius), 0);
  return Math.hypot(dx, dy) - radius;
}

// The mark: a thin outer orbit, a heavy arc with a gap on the right, a centre
// dot, and a short tick inside the gap.
function markAlpha(px, py) {
  const r = Math.hypot(px, py);
  const angle = Math.atan2(py, px);
  const ring = Math.abs(r - 0.47) - 0.012;
  const arc = Math.abs(angle) < 0.34 ? 1 : Math.abs(r - 0.3) - 0.055;
  const dot = r - 0.085;
  const tick = Math.max(Math.abs(px - 0.34) - 0.055, Math.abs(py) - 0.014);
  return Math.min(ring, arc, dot, tick);
}

function gradient(y, size) {
  const t = y / (size - 1);
  return [
    139 + (86 - 139) * t,
    126 + (58 - 126) * t,
    214 + (150 - 214) * t,
  ];
}

/**
 * @param {number} size
 * @param {{ background?: boolean, layers: { color: number[], scale?: number, alpha?: number }[] }} options
 */
function render(size, { background = false, layers }) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 4;
  const samples = ss * ss;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCoverage = 0;
      const coverages = layers.map(() => 0);

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
          const py = ((y + (sy + 0.5) / ss) / size) * 2 - 1;

          if (background && roundedSquareAlpha(px, py, 0.235) <= 0) bgCoverage += 1;
          layers.forEach((layer, index) => {
            const scale = layer.scale ?? 1;
            if (markAlpha(px / scale, py / scale) <= 0) coverages[index] += 1;
          });
        }
      }

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (background) {
        [r, g, b] = gradient(y, size);
        a = bgCoverage / samples;
      }

      layers.forEach((layer, index) => {
        const coverage = coverages[index] / samples;
        if (coverage <= 0) return;
        const alpha = coverage * (layer.alpha ?? 1);
        const out = alpha + a * (1 - alpha);
        r = (layer.color[0] * alpha + r * a * (1 - alpha)) / out;
        g = (layer.color[1] * alpha + g * a * (1 - alpha)) / out;
        b = (layer.color[2] * alpha + b * a * (1 - alpha)) / out;
        a = out;
      });

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(a * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

writeFileSync(
  join(outDir, 'icon.png'),
  render(512, { background: true, layers: [{ color: [255, 255, 255] }] }),
);

// electron-builder auto-detects build/icon.png and derives .ico/.icns from it.
writeFileSync(
  join(buildDir, 'icon.png'),
  render(1024, { background: true, layers: [{ color: [255, 255, 255] }] }),
);

// Tray: light mark over a dark halo so it stays legible on light and dark panels.
writeFileSync(
  join(outDir, 'tray.png'),
  render(64, {
    layers: [
      { color: [18, 18, 22], scale: 1.22, alpha: 0.45 },
      { color: [246, 246, 248] },
    ],
  }),
);

console.log('icons written to assets/ and build/');
