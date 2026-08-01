/**
 * A logo atvizsgalasa: van-e atlatszosag, mik a sajat szinei, mennyi
 * feher keret van korulotte. Egyszeri segedeszkoz, `node scripts/inspect-logo.mjs`.
 */
import sharp from 'sharp';

const src = 'src/assets/logo-source.png';
const img = sharp(src);
const meta = await img.metadata();
console.log('meta:', {
  w: meta.width,
  h: meta.height,
  channels: meta.channels,
  hasAlpha: meta.hasAlpha,
});

const { data, info } = await img
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const at = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

console.log('bal felso sarok:', at(2, 2));
console.log('jobb also sarok:', at(info.width - 3, info.height - 3));

const buckets = new Map();
for (let y = 0; y < info.height; y += 2) {
  for (let x = 0; x < info.width; x += 2) {
    const [r, g, b, a] = at(x, y);
    if (a < 200) continue;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 60) continue;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
}

const hex = (v, n) => Math.round(v / n).toString(16).padStart(2, '0');
console.log(
  'fo szinek:',
  [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((e) => `#${hex(e.r, e.n)}${hex(e.g, e.n)}${hex(e.b, e.n)} (${e.n}px)`),
);

const trimmed = await sharp(src).trim({ threshold: 10 }).metadata();
console.log('trim utan:', trimmed.width, 'x', trimmed.height);
