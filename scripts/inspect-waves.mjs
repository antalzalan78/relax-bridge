/**
 * A logo lila tartalmanak profilozasa soronkent.
 *
 * Az uj logoban harom lila hullamvonal van, es lila a "balanCe" felirat is —
 * ez a szkript megmutatja, melyik sortartomany tartozik a hullamokhoz.
 *
 * Futtatas: node scripts/inspect-waves.mjs
 */
import sharp from 'sharp';

const { data, info } = await sharp('src/assets/logo-source.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

console.log('forras:', info.width, 'x', info.height, '\n');

const px = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
};

const isPurple = (r, g, b) => b > 110 && b - g > 30 && r - g > 15;
const isGreen = (r, g, b) => g > 90 && g - r > 25 && g - b > 25;
const isOrange = (r, g, b) => r > 150 && r - b > 60 && g - b > 25 && r - g > 25;

const rows = [];
for (let y = 0; y < info.height; y++) {
  let purple = 0, green = 0, orange = 0, pMin = info.width, pMax = 0;
  for (let x = 0; x < info.width; x++) {
    const [r, g, b] = px(x, y);
    if (isPurple(r, g, b)) {
      purple++;
      if (x < pMin) pMin = x;
      if (x > pMax) pMax = x;
    } else if (isGreen(r, g, b)) green++;
    else if (isOrange(r, g, b)) orange++;
  }
  rows.push({ y, purple, green, orange, pMin, pMax });
}

// Osszefuggo lila savok keresese.
const bands = [];
let cur = null;
for (const r of rows) {
  if (r.purple > 0) {
    if (!cur) cur = { from: r.y, to: r.y, maxPurple: 0, xMin: info.width, xMax: 0 };
    cur.to = r.y;
    cur.maxPurple = Math.max(cur.maxPurple, r.purple);
    cur.xMin = Math.min(cur.xMin, r.pMin);
    cur.xMax = Math.max(cur.xMax, r.pMax);
  } else if (cur) {
    bands.push(cur);
    cur = null;
  }
}
if (cur) bands.push(cur);

console.log('osszefuggo lila savok:');
for (const b of bands) {
  console.log(
    `  y ${b.from}-${b.to} (${b.to - b.from + 1} sor), x ${b.xMin}-${b.xMax}, max ${b.maxPurple} px/sor`,
  );
}

console.log('\nzold es narancs sorok hatarai:');
const gRows = rows.filter((r) => r.green > 0);
const oRows = rows.filter((r) => r.orange > 0);
console.log('  zold:   y', gRows[0]?.y, '-', gRows[gRows.length - 1]?.y);
console.log('  narancs: y', oRows[0]?.y, '-', oRows[oRows.length - 1]?.y);
