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

    // A kapott PNG hattere nem teljesen homogen feher: 1-2 erteknyi
    // tomoritesi zajt tartalmaz. Ezt nem szabad szines, felatlatszo pontokka
    // erositeni az unpremultiply lepesben.
    if (a <= 10) {
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

const isOrange = (r, g, b) => r > 135 && r > g * 1.22 && g > b * 1.35;
const isGreen = (r, g, b) => g > 65 && g > r * 1.3 && g > b * 1.25;
const isPurple = (r, g, b) => b > 65 && b > g * 1.35 && r > g * 1.15;
const isMarkColor = (r, g, b) => isGreen(r, g, b) || isPurple(r, g, b);
const isTaglineColor = (r, g, b) =>
  isOrange(r, g, b) || isGreen(r, g, b) || isPurple(r, g, b) || Math.max(r, g, b) < 130;

/**
 * Kivalasztja egy szinvilag legnagyobb osszefuggo vizszintes savjat.
 * Ez valasztja el a felső narancssarga szologot az also jelmondattol, illetve
 * a hidat a jelmondat zold es lila betuitol.
 */
async function findLargestBandBox(src, matches) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rows = [];

  for (let y = 0; y < info.height; y++) {
    let count = 0;

    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (matches(data[i], data[i + 1], data[i + 2])) count++;
    }

    if (count >= 3) rows.push({ y, count });
  }

  const bands = [];

  for (const row of rows) {
    const current = bands.at(-1);

    if (!current || row.y > current.bottom + 3) {
      bands.push({ top: row.y, bottom: row.y, pixels: row.count });
    } else {
      current.bottom = row.y;
      current.pixels += row.count;
    }
  }

  const band = bands.sort((a, b) => b.pixels - a.pixels)[0];
  if (!band) throw new Error('Nem talalhato kivaghato logoelem.');

  let minX = info.width;
  let maxX = 0;
  let minY = info.height;
  let maxY = 0;

  for (let y = band.top; y <= band.bottom; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (!matches(data[i], data[i + 1], data[i + 2])) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Megkeresi egy also sav szines tartalmanak befoglalo teglalapjat. */
async function findBoxBelow(src, matches, fromY) {
  const { data, info } = await sharp(src)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rows = [];

  for (let y = fromY; y < info.height; y++) {
    let count = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (matches(data[i], data[i + 1], data[i + 2])) count++;
    }
    if (count >= 3) rows.push({ y, count });
  }

  const bands = [];
  for (const row of rows) {
    const current = bands.at(-1);
    if (!current || row.y > current.bottom + 3) {
      bands.push({ top: row.y, bottom: row.y, pixels: row.count });
    } else {
      current.bottom = row.y;
      current.pixels += row.count;
    }
  }

  const band = bands.sort((a, b) => b.pixels - a.pixels)[0];
  if (!band) throw new Error('Nem talalhato also logosav.');

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = band.top; y <= band.bottom; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (!matches(data[i], data[i + 1], data[i + 2])) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Csak a keresett szinvilagot hagyja meg, a tobbi pixelt atlatszova teszi. */
async function keepColors(src, selectorSrc, matches) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const selector = await sharp(selectorSrc).removeAlpha().raw().toBuffer();

  for (let i = 0; i < data.length; i += info.channels) {
    const selectorIndex = (i / info.channels) * 3;
    if (
      data[i + 3] < 6 ||
      !matches(
        selector[selectorIndex],
        selector[selectorIndex + 1],
        selector[selectorIndex + 2],
      )
    ) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
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
const box = await findLargestBandBox(SRC, isMarkColor);
const pad = 14;
console.log('hid grafika:', box);

const markOnly = await (await keepColors(fullBuf, SRC, isMarkColor)).png().toBuffer();

await sharp(markOnly)
  .extract({
    left: Math.max(0, box.left - pad),
    top: Math.max(0, box.top - pad),
    width: Math.min(box.width + pad * 2, (await sharp(SRC).metadata()).width - Math.max(0, box.left - pad)),
    // Alul csak a tenyleges, harom pixeles ures savig hagyunk helyet, hogy a
    // jelmondat zold es lila betui ne keruljenek bele az ikonba.
    height: box.height + pad + 2,
  })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo-mark.png');

const markBuf = await sharp('src/assets/logo-mark.png').toBuffer();

// --- 3. Narancssarga szologo a kompakt fejlechez ---
const wordmarkBox = await findLargestBandBox(SRC, isOrange);
const wordmarkOnly = await (await keepColors(fullBuf, SRC, isOrange)).png().toBuffer();

await sharp(wordmarkOnly)
  .extract({
    left: Math.max(0, wordmarkBox.left - pad),
    top: Math.max(0, wordmarkBox.top - pad),
    width: wordmarkBox.width + pad * 2,
    height: wordmarkBox.height + pad * 2,
  })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo-wordmark.png');

// --- 4. Szines jelmondat a kompakt fejlechez ---
const taglineBox = await findBoxBelow(SRC, isTaglineColor, box.top + box.height);
const taglinePadY = 4;

await sharp(fullBuf)
  .extract({
    left: Math.max(0, taglineBox.left - pad),
    top: Math.max(0, taglineBox.top - taglinePadY),
    width: taglineBox.width + pad * 2,
    height: taglineBox.height + taglinePadY * 2,
  })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo-tagline.png');

// --- 5. Favicon es keplyukas ikonok ---
for (const size of [32, 180]) {
  await sharp(markBuf)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(size === 32 ? 'public/favicon-32.png' : 'public/apple-touch-icon.png');
}

// --- 6. Megosztaskep (Facebook, WhatsApp): a logo krem hatteren ---
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
  'src/assets/logo-wordmark.png',
  'src/assets/logo-tagline.png',
  'public/favicon-32.png',
  'public/apple-touch-icon.png',
  'public/images/og-image.png',
]) {
  const m = await sharp(f).metadata();
  console.log(`${f}: ${m.width}x${m.height}`);
}
