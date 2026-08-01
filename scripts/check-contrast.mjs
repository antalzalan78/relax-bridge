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

const backgrounds = { vilagos: '#fdf8f2', sotet: '#1c1714' };

const candidates = {
  // meleg szovegszinek
  'meleg sotetbarna (szoveg)': '#332822',
  'meleg szurkesbarna (halvany szoveg)': '#6f6154',
  // terrakotta / agyag — fo interaktiv szin
  'terrakotta': '#c2673a',
  'terrakotta -1': '#b05c31',
  'terrakotta -2': '#9c4f28',
  'terrakotta -3': '#8a4522',
  // meleg borostyan / mez
  'borostyan': '#e0973f',
  'borostyan -2': '#b9761f',
  'borostyan -3': '#9c6210',
  // a logo sajat szinei
  'logo narancs': '#fdaa38',
  'logo zold': '#56b44a',
  'logo lila': '#8755b6',
  // sotet temara szant vilagos, meleg arnyalatok
  'homok (sotet temara)': '#f2c9a0',
  'barack (sotet temara)': '#eda877',
  'halvany terrakotta (sotet temara)': '#e59468',
};

for (const [bgName, bg] of Object.entries(backgrounds)) {
  console.log(`\n--- ${bgName} hatter (${bg}) ---`);
  for (const [name, hex] of Object.entries(candidates)) {
    const r = ratio(hex, bg);
    const verdict = r >= 4.5 ? 'OK szoveghez' : r >= 3 ? 'csak nagy szoveg / keret' : 'csak dekoracio';
    console.log(`${hex}  ${r.toFixed(2)}:1  ${verdict.padEnd(24)} ${name}`);
  }
}
