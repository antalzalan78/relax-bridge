import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { aboutPath, bookingChoicePath, treatmentsPath } from '../../src/data/site.ts';

test('general booking actions lead to the local treatment choice, not the old intermediary', () => {
  assert.equal(bookingChoicePath('nl'), '/#choice');
  assert.equal(bookingChoicePath('en'), '/en#choice');
  assert.equal(bookingChoicePath('hu'), '/hu#choice');
});

test('the about page exists in each language', async () => {
  assert.deepEqual(['nl', 'en', 'hu'].map((locale) => aboutPath(locale as 'nl' | 'en' | 'hu')), [
    '/over-mij', '/en/about', '/hu/rolam',
  ]);
  for (const page of ['over-mij.astro', 'en/about.astro', 'hu/rolam.astro']) {
    const source = await readFile(new URL(`../../src/pages/${page}`, import.meta.url), 'utf8');
    assert.match(source, /AboutPage/);
  }
});

test('each locale has a treatment overview and the menu points to it', async () => {
  assert.deepEqual(['nl', 'en', 'hu'].map((locale) => treatmentsPath(locale as 'nl' | 'en' | 'hu')), [
    '/behandelingen', '/en/treatments', '/hu/kezelesek',
  ]);
  for (const page of ['behandelingen.astro', 'en/treatments.astro', 'hu/kezelesek.astro']) {
    assert.match(await readFile(new URL(`../../src/pages/${page}`, import.meta.url), 'utf8'), /TreatmentsPage/);
  }
  const header = await readFile(new URL('../../src/components/Header.astro', import.meta.url), 'utf8');
  assert.match(header, /href=\{treatmentsPath\(locale\)\}/);
});

test('the brand introduction comes before the two treatment choices', async () => {
  const home = await readFile(new URL('../../src/components/HomePage.astro', import.meta.url), 'utf8');
  assert.ok(home.indexOf('class="homepage-introduction"') < home.indexOf('class="wrap treatment-choice"'));
  assert.ok(home.indexOf('class="wrap treatment-choice"') < home.indexOf('class="studio-offer-group"'));
  assert.ok(home.indexOf('class="treatment-choice__card--creator"') < home.indexOf('d.choice.readyTitle'));
});
