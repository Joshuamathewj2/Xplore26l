const ROOT = require("path").resolve(__dirname, "..");
/* ════════════════════════════════════════════════════════════
   Turn raw character art into card-ready webp.

   The card's art cell is a ~412×440 near-square that crops with
   object-fit: cover, so anything outside the figure — a comic cover's
   masthead, a printed border, dead transparent margin — either eats the
   cell or forces an awkward object-position. Every source is therefore
   cropped to the art BEFORE it ships, exactly as the note at the top of
   src/data/events.ts asks.

   Re-run after dropping new art in:  node tools/prepare-event-art.js
   ════════════════════════════════════════════════════════════ */
const sharp = require("sharp");
const SRC = "C:/Users/MELDAN ROY/Desktop/xplore'26/images/Character images";
const OUT = ROOT + "/events";

/** Crops are in SOURCE pixels: [left, top, width, height]. */
const JOBS = [
  {
    src: `${SRC}/noir .png`,
    out: `${OUT}/event-noir.webp`,
    // 1024×1536. Keeps the smoke-and-vignette halo around the figure — on a
    // near-black card that halo IS the background, so it wants to survive.
    crop: [20, 80, 990, 1330],
  },
  {
    src: `${SRC}/punk.png`,
    out: `${OUT}/event-punk.webp`,
    // 1665×2560, a full comic cover. The crop drops the Marvel badge
    // (top-right), the credits and pull-quote (top-left) and the SPIDER-PUNK
    // masthead with its yellow starburst (below y≈1856), leaving the figure.
    crop: [430, 270, 1235, 1580],
  },
  {
    src: `${SRC}/edited-photo (3).png`,
    out: `${OUT}/event-pavitr.webp`,
    // 751×1063 with a printed white border — trimmed off all four sides.
    crop: [12, 12, 727, 1039],
  },
];

(async () => {
  for (const { src, out, crop } of JOBS) {
    const [left, top, width, height] = crop;
    const meta = await sharp(src).metadata();
    if (left + width > meta.width || top + height > meta.height) {
      throw new Error(
        `${src}: crop ${crop} runs past ${meta.width}×${meta.height}`
      );
    }
    const info = await sharp(src)
      .extract({ left, top, width, height })
      // The cell is never wider than 440 CSS px; 900 covers 2× displays.
      .resize({ width: 900, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);
    console.log(
      `${out.split(/[\\/]/).pop().padEnd(20)} ${meta.width}×${meta.height}` +
      ` -> ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} kB`
    );
  }
})();
