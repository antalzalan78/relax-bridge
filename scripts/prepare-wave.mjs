/**
 * A logo hullam nelkuli valtozata az animalt komponenshez.
 *
 * A logo raszterkep, abban egy reszlet nem mozgathato. Ezert a harom lila
 * hullamvonalat kitoroljuk a kepbol, es a BridgeMark komponens SVG-ben rajzolja
 * ujra oket — ugyanoda, ugyanolyan szinnel es vastagsaggal, de mozogva.
 *
 * Csak a logo-nowave.png-t irja. A tobbi logofajlt (logo.png, logo-mark.png,
 * logo-wordmark.png) szandekosan nem erinti.
 *
 * Futtatas: node scripts/prepare-wave.mjs
 * Ujra kell futtatni, ha a forraslogo valtozik.
 */
import sharp from 'sharp';

const SRC = 'src/assets/logo-source.png';

/**
 * A hullamsav a forraskepen. Merve: scripts/inspect-waves.mjs es
 * scripts/measure-wave.mjs. A lila "balanCe" felirat csak y=569-tol kezdodik,
 * ezert az a savon kivul esik.
 */
export const WAVE_BAND = { top: 498, bottom: 564, left: 174, right: 631 };

/** Feher hatter -> atlatszosag, a vonalszin visszaallitasaval. */
function keyOutWhite(data, info) {
  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = 255 - Math.min(r, g, b);

    if (a === 0) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      continue;
    }

    const unpremul = (c) =>
      Math.max(0, Math.min(255, Math.round(((c - (255 - a)) * 255) / a)));

    out[o] = unpremul(r);
    out[o + 1] = unpremul(g);
    out[o + 2] = unpremul(b);
    out[o + 3] = a;
  }

  return out;
}

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// A vagast az eredeti kepbol szamoljuk, hogy pixelre egyezzen a logo.png-vel.
const original = await sharp(
  Buffer.from(keyOutWhite(data, info)),
  { raw: { width: info.width, height: info.height, channels: 4 } },
)
  .trim({ threshold: 5 })
  .toBuffer({ resolveWithObject: true });

const crop = {
  left: -original.info.trimOffsetLeft,
  top: -original.info.trimOffsetTop,
  width: original.info.width,
  height: original.info.height,
};

/*
 * A hullamok kitorlese. Megengedo szabaly: az elsimitott szelek halvany lila
 * pixeleit is elkapja, kulonben szellemkep marad a helyukon. Feheren r=g=b,
 * a zoldnel a g a legnagyobb, a narancsnal a b a legkisebb — azokat nem erinti.
 */
const erased = Buffer.from(data);
let cleared = 0;

for (let y = WAVE_BAND.top; y <= WAVE_BAND.bottom; y++) {
  for (let x = WAVE_BAND.left; x <= WAVE_BAND.right; x++) {
    const i = (y * info.width + x) * info.channels;
    const r = erased[i], g = erased[i + 1], b = erased[i + 2];
    if (b - g >= 6 && r - g >= 3) {
      erased[i] = erased[i + 1] = erased[i + 2] = 255;
      cleared++;
    }
  }
}

await sharp(
  Buffer.from(keyOutWhite(erased, info)),
  { raw: { width: info.width, height: info.height, channels: 4 } },
)
  .extract(crop)
  .png({ compressionLevel: 9 })
  .toFile('src/assets/logo-nowave.png');

console.log(`kitorolt hullam pixelek: ${cleared}`);
console.log(`logo-nowave.png: ${crop.width} x ${crop.height}`);
console.log('\na hullam helye a keper belul (a komponens ezeket hasznalja):', {
  x0: WAVE_BAND.left + original.info.trimOffsetLeft,
  x1: WAVE_BAND.right + original.info.trimOffsetLeft,
  top: WAVE_BAND.top + original.info.trimOffsetTop,
  bottom: WAVE_BAND.bottom + original.info.trimOffsetTop,
});
