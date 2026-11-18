import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const source = async (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the homepage introduces Relax Bridge before the featured Massage Creator and ready-made treatments', async () => {
  const homepage = await source('src/components/HomePage.astro');
  assert.ok(homepage.indexOf('homepage-introduction') < homepage.indexOf('services-heading'));
  assert.ok(homepage.indexOf('services-heading') < homepage.indexOf('creator-spotlight'));
  assert.ok(homepage.indexOf('creator-spotlight') < homepage.indexOf('studio-offer-group__heading'));
  assert.match(homepage, /id=\{anchors\.services\}/);
  assert.match(homepage, /href=\{creatorHref\}/);

  const introductoryLabels = [
    ['nl', 'De filosofie van Relax Bridge'],
    ['hu', 'A Relax Bridge filozófiája'],
    ['en', 'The Relax Bridge philosophy'],
  ];
  for (const [locale, label] of introductoryLabels) {
    assert.ok((await source(`src/i18n/${locale}.ts`)).includes(label));
  }
});

test('the design handoff copy stays localized without turning card headlines into navigation labels', async () => {
  const expected = [
    ['hu', 'Figyelem, választás, egy kis idő magadra.', 'Válassz úgy, ahogy neked jólesik'],
    ['nl', 'Aandacht, keuze, een moment voor jezelf.', 'Kies wat voor jou goed voelt'],
    ['en', 'Attention, choice, a moment for yourself.', 'Choose what feels right for you'],
  ];
  for (const [locale, hero, choice] of expected) {
    const copy = await source(`src/i18n/${locale}.ts`);
    assert.ok(copy.includes(hero));
    assert.ok(copy.includes(choice));
    assert.match(copy, /sharedNote:/);
  }
  assert.match(await source('src/components/HomePage.astro'), /\{d\.choice\.sharedNote\}/);
  assert.match(await source('src/components/Header.astro'), /\{d\.choice\.readyLabel\}/);
  assert.match(await source('src/components/Footer.astro'), /\{d\.choice\.readyLabel\}/);
});

test('Dutch guest-facing copy consistently names fixed treatments', async () => {
  assert.match(await source('src/i18n/nl.ts'), /readyLabel: 'Vaste behandelingen'/);
  assert.match(await source('src/components/TreatmentsPage.astro'), /title: 'Vaste behandelingen'/);
  assert.match(await source('src/i18n/massage-creator.ts'), /readyPrompt: 'Liever een vaste behandeling kiezen\?'/);
});

test('Massage Creator and ready-made treatments are both bookable, with Creator shown first', async () => {
  const choice = await source('src/components/StudioVisitBookingPage.astro');
  assert.ok(choice.indexOf('id="massage-creator"') < choice.indexOf('id="ready-treatments"'));
  assert.match(choice, /href=\{creatorHref\}/);
  assert.match(choice, /href=\{readyBookingHref\}/);

  const prices = await source('src/components/PricesPage.astro');
  assert.ok(prices.indexOf('id="creator"') < prices.indexOf('id="studio"'));
});

test('the retired Studio Visit label is absent from guest-facing copy', async () => {
  for (const path of [
    'src/components/HomePage.astro',
    'src/components/Footer.astro',
    'src/components/PricesPage.astro',
    'src/components/StudioVisitBookingPage.astro',
    'src/components/MassageCreatorPage.astro',
    'src/i18n/nl.ts',
    'src/i18n/en.ts',
    'src/i18n/hu.ts',
    'src/i18n/booking.ts',
    'src/i18n/studio-booking.ts',
    'src/i18n/massage-creator.ts',
    'src/i18n/prices.ts',
    'src/pages/api/bookings.ts',
  ]) {
    assert.doesNotMatch(await source(path), /Studio Visit/, path);
  }
});

test('retired Home Service has no public service content or booking form fields', async () => {
  for (const locale of ['nl', 'en', 'hu']) {
    const files = await readdir(new URL(`../../src/content/services/${locale}/`, import.meta.url));
    assert.ok(files.every((name) => !name.startsWith('home-')));
  }
  const booking = await source('src/components/BookingPage.astro');
  assert.doesNotMatch(booking, /home-builder|home-address|home-postal-code|data-home-options|home:custom/);
  const footer = await source('src/components/Footer.astro');
  assert.match(footer, /massageCreatorPath\(locale\)/);
  assert.doesNotMatch(footer, /homeService|Home Service/);
});
