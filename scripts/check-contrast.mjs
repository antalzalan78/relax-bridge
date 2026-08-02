/**
 * A Csendes hid paletta kontrasztellenorzese.
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

const backgrounds = { papir: '#f6f1e8', fenyo: '#193c34' };

const candidates = {
  'zoldes grafit (szoveg)': '#1f2d28',
  'meleg szurke (halvany szoveg)': '#625f56',
  'fenyozold (marka)': '#285247',
  'sotet fenyo': '#193c34',
  'terrakotta (CTA)': '#a85030',
  'sotet terrakotta': '#873d24',
  'tortfeher': '#fffdfa',
  'feher': '#ffffff',
  'homok (dekoracio)': '#cdbb9d',
  'logo narancs': '#fdaa38',
  'logo zold': '#56b44a',
  'logo lila': '#8755b6',
};

for (const [bgName, bg] of Object.entries(backgrounds)) {
  console.log(`\n--- ${bgName} hatter (${bg}) ---`);
  for (const [name, hex] of Object.entries(candidates)) {
    const r = ratio(hex, bg);
    const verdict = r >= 4.5 ? 'OK szoveghez' : r >= 3 ? 'csak nagy szoveg / keret' : 'csak dekoracio';
    console.log(`${hex}  ${r.toFixed(2)}:1  ${verdict.padEnd(24)} ${name}`);
  }
}
