/**
 * A logo elokeszitese az oldalhoz.
 *
 * A forras (src/assets/logo-source.png) feher hatteren van, atlatszosag nelkul.
 * Sotet temaban ez egy feher teglalapkent latszana, ezert kulcsoljuk ki a
 * fehéret, es a vonalak szinet visszaallitjuk (unpremultiply).
 *
 * Futtatas: node scripts/prepare-logo.mjs
 * Csak akkor kell ujra lefuttatni, ha a forraslogo valtozik.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'src/assets/logo-source.png';

/** Feher hatter -> atlatszosag, a vonalszin visszaallitasaval. */
async function keyOutWhite(src) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Minel tavolabb van a pixel a fehertol, annal atlatszatlanabb.
    const a = 255 - Math.min(r, g, b);

    if (a === 0) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      continue;
    }

    // A feher hatter kivonasa a szinbol, hogy barmilyen hatteren jol nezzen ki.
    const unpremul = (c) =>
      Math.max(0, Math.min(255, Math.round(((c - (255 - a)) * 255) / a)));

    out[o] = unpremul(r);
    out[o + 1] = unpremul(g);
    out[o + 2] = unpremul(b);
    out[o + 3] = a;
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

/**
 * A hid grafika hatarai.
 *
 * Ket menetben: eloszor a zold pixelek (hid es levelek), utana a lila hullam,
 * de csak a zold teteje alatt. Igy a "Massage" felirat lila betuszara nem log
 * bele a kivagasba, a hullam viszont teljes egeszeben benne marad.
 */
async function findMarkBox(src) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const [r, g, b] = px(x, y);
      if (g > 90 && g - r > 25 && g - b > 25) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const greenTop = minY;

  for (let y = greenTop; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const [r, g, b] = px(x, y);
      if (b > 110 && b - g > 30 && r - g > 15) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    left: minX,
    top: greenTop,
    width: maxX - minX + 1,
    height: maxY - greenTop + 1,
  };
}

await mkdir('public/images', { recursive: true });

// --- 1. Teljes logo, atlatszo hatterrel ---
const keyed = await keyOutWhite(SRC);
const fullBuf = await keyed.png().toBuffer();

await sharp(fullBuf)
  .trim({ threshold: 5 })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo.png');

// --- 2. Csak a hid jel, ikonnak ---
const box = await findMarkBox(SRC);
const pad = 14;
console.log('hid grafika:', box);

await sharp(fullBuf)
  .extract({
    left: Math.max(0, box.left - pad),
    // Pontosan a levelcsucsnal kezdunk: egy pixellel feljebb mar a "Massage"
    // felirat "g" betujenek szara logna bele.
    top: box.top,
    width: Math.min(box.width + pad * 2, 1024 - Math.max(0, box.left - pad)),
    height: box.height + pad,
  })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo-mark.png');

const markBuf = await sharp('src/assets/logo-mark.png').toBuffer();

// --- 3. Favicon es keplyukas ikonok ---
for (const size of [32, 180]) {
  await sharp(markBuf)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(size === 32 ? 'public/favicon-32.png' : 'public/apple-touch-icon.png');
}

// --- 4. Megosztaskep (Facebook, WhatsApp): a logo krem hatteren ---
await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    // Ugyanaz a meleg krem, mint az oldal hattere (--bg: #fdf8f2).
    background: { r: 253, g: 248, b: 242, alpha: 1 },
  },
})
  .composite([
    {
      input: await sharp(await sharp('src/assets/logo.png').toBuffer())
        .resize({ height: 480, fit: 'inside' })
        .toBuffer(),
      gravity: 'centre',
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile('public/images/og-image.png');

for (const f of [
  'src/assets/logo.png',
  'src/assets/logo-mark.png',
  'public/favicon-32.png',
  'public/apple-touch-icon.png',
  'public/images/og-image.png',
]) {
  const m = await sharp(f).metadata();
  console.log(`${f}: ${m.width}x${m.height}`);
}
