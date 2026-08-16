/**
 * A harom lila hullamvonal kimerese az uj logobol.
 *
 * Oszloponkent megkeressuk a fuggoleges lila futasokat, es palyakba rendezzuk
 * oket. Ebbol jon ki mindharom vonal kozepvonala, kiterjedese, amplitudoja es
 * hullamhossza — ezekkel rajzolhato ujra SVG-ben.
 *
 * Futtatas: node scripts/measure-wave.mjs
 */
import sharp from 'sharp';

const BAND_TOP = 498;
const BAND_BOTTOM = 564;

const { data, info } = await sharp('src/assets/logo-source.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const px = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
};

const isPurple = (r, g, b) => b > 110 && b - g > 30 && r - g > 15;

/** Egy oszlop lila futasainak kozeppontjai. */
function runsAt(x) {
  const runs = [];
  let start = null;
  for (let y = BAND_TOP; y <= BAND_BOTTOM + 1; y++) {
    const on = y <= BAND_BOTTOM && isPurple(...px(x, y));
    if (on && start === null) start = y;
    if (!on && start !== null) {
      runs.push({ centre: (start + y - 1) / 2, thickness: y - start });
      start = null;
    }
  }
  return runs;
}

const histogram = new Map();
const columns = [];
for (let x = 0; x < info.width; x++) {
  const runs = runsAt(x);
  if (!runs.length) continue;
  columns.push({ x, runs });
  histogram.set(runs.length, (histogram.get(runs.length) ?? 0) + 1);
}

console.log('lila oszlopok:', columns.length, `(x ${columns[0].x} - ${columns[columns.length - 1].x})`);
console.log('futasok szama oszloponkent:', [...histogram.entries()].sort((a, b) => a[0] - b[0]));

const thick = columns.flatMap((c) => c.runs.map((r) => r.thickness)).sort((a, b) => a - b);
console.log('vonalvastagsag median:', thick[Math.floor(thick.length / 2)], 'px');

/*
 * A harom hullam folyton keresztezi egymast, ezert egyenkent nem kovethetok.
 * A felso es also burkologorbe viszont tiszta jel: ezekbol jon a hullamhossz
 * es a kilenges, amivel harom, ugyanilyen jellegu hullam ujrarajzolhato.
 */
const envelope = { top: [], bottom: [] };
for (const { x, runs } of columns) {
  envelope.top.push({ x, y: runs[0].centre });
  envelope.bottom.push({ x, y: runs[runs.length - 1].centre });
}

const smooth = (pts, w = 9) =>
  pts.map((p, i, arr) => {
    const win = arr.slice(Math.max(0, i - w), i + w + 1);
    return { x: p.x, y: win.reduce((a, b) => a + b.y, 0) / win.length };
  });

function analyse(name, pts) {
  const s = smooth(pts);
  const ys = s.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);

  const extremes = [];
  for (let i = 1; i < s.length - 1; i++) {
    const [a, b, c] = [s[i - 1].y, s[i].y, s[i + 1].y];
    if ((b <= a && b < c) || (b >= a && b > c)) {
      const last = extremes[extremes.length - 1];
      if (!last || s[i].x - last.x > 30) extremes.push({ x: s[i].x, y: b });
    }
  }

  const gaps = extremes.slice(1).map((e, i) => e.x - extremes[i].x);
  const halfWave = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

  console.log(`\n${name}:`);
  console.log(`  kozepvonal y: ${((min + max) / 2).toFixed(1)}`);
  console.log(`  kilenges: ±${((max - min) / 2).toFixed(1)} px`);
  console.log(`  szelsoertekek: ${extremes.map((e) => e.x).join(', ')}`);
  if (halfWave) console.log(`  hullamhossz: ${(halfWave * 2).toFixed(0)} px`);
}

analyse('felso burkolo', envelope.top);
analyse('also burkolo', envelope.bottom);

const allY = columns.flatMap((c) => c.runs.map((r) => r.centre));
console.log('\nsav egeszben: y', Math.min(...allY).toFixed(1), '-', Math.max(...allY).toFixed(1));
