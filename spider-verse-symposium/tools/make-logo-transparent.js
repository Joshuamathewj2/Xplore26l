const path = require("path");
const sharp = require("sharp");

/* ════════════════════════════════════════════════════════════
   Key the white background out of the two hero-nav logos.

   Both source files are flat white-background exports (confirmed via
   metadata: hasAlpha: false, corner pixels ~254-255). A global white
   threshold would also punch holes in any white *inside* the artwork
   (e.g. highlights inside the LICET crest), so this floods inward from
   the four edges instead — only background actually connected to the
   border becomes transparent. Near-white edge pixels next to the keyed
   region get a partial alpha so the cutout isn't a hard jagged edge.

   Re-run after replacing either source: node tools/make-logo-transparent.js
   ════════════════════════════════════════════════════════════ */

const ROOT = path.resolve(__dirname, "..");
const WHITE_MIN = 235; // min(r,g,b) at/above this counts as "background white"
const SOFT_BAND = 40; // pixels from WHITE_MIN down to this get a soft alpha ramp

const JOBS = [
  { src: `${ROOT}/images/Logo/Dept logo.jpeg`, out: `${ROOT}/images/Logo/dept-logo-transparent.png` },
  { src: `${ROOT}/images/Logo/licet logo.png`, out: `${ROOT}/images/Logo/licet-logo-transparent.png` },
];

async function keyOutBackground(src) {
  const img = sharp(src);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;
  const lightness = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

  // Flood fill from every border pixel across 4-connected near-white runs.
  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) {
    stack.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    stack.push([0, y], [width - 1, y]);
  }

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    const i = idx(x, y);
    if (lightness(i) < WHITE_MIN - SOFT_BAND) continue; // too dark, must be artwork
    visited[p] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  for (let p = 0; p < width * height; p++) {
    if (!visited[p]) continue;
    const i = p * channels;
    const l = lightness(i);
    if (l >= WHITE_MIN) {
      data[i + 3] = 0;
    } else {
      // Soft ramp across the anti-aliased rim between artwork and background.
      const t = (l - (WHITE_MIN - SOFT_BAND)) / SOFT_BAND; // 0 (dark) -> 1 (white)
      data[i + 3] = Math.round(255 * (1 - t));
    }
  }

  return sharp(data, { raw: { width, height, channels } });
}

(async () => {
  for (const { src, out } of JOBS) {
    const result = await keyOutBackground(src);
    const info = await result.png().toFile(out);
    console.log(
      `${out.split(/[\\/]/).pop().padEnd(28)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} kB`
    );
  }
})();
