/**
 * Kontrasztellenorzes a logo szineire.
 * A szoveghez hasznalt szineknek el kell erniuk a WCAG AA 4.5:1 aranyt.
 * Futtatas: node scripts/check-contrast.mjs
 */

const lum = (hex) => {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const backgrounds = { vilagos: '#faf8f5', sotet: '#14171a' };

const candidates = {
  'logo zold': '#56b44a',
  'zold -1': '#3f8f38',
  'zold -2': '#35782c',
  'zold -3': '#2d6626',
  'logo lila': '#8755b6',
  'lila -1': '#7a49a8',
  'logo narancs': '#fdaa38',
  'narancs -2': '#b56f00',
  'vilagos zold (sotet temara)': '#7fd06f',
  'vilagos lila (sotet temara)': '#b98ee0',
};

for (const [bgName, bg] of Object.entries(backgrounds)) {
  console.log(`\n--- ${bgName} hatter (${bg}) ---`);
  for (const [name, hex] of Object.entries(candidates)) {
    const r = ratio(hex, bg);
    const verdict = r >= 4.5 ? 'OK szoveghez' : r >= 3 ? 'csak nagy szoveg / keret' : 'csak dekoracio';
    console.log(`${hex}  ${r.toFixed(2)}:1  ${verdict.padEnd(24)} ${name}`);
  }
}
