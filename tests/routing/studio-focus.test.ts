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

  const titles = [
    ['nl', 'Jouw massage. Jouw moment.'],
    ['hu', 'A te masszázsod. A te pillanatod.'],
    ['en', 'Your massage. Your moment.'],
  ];
  for (const [locale, title] of titles) {
    assert.ok((await source(`src/i18n/${locale}.ts`)).includes(title));
  }
});

test('Massage Creator and ready-made treatments are both bookable, with Creator shown first', async () => {
  const choice = await source('src/components/StudioVisitBookingPage.astro');
  assert.ok(choice.indexOf('id="massage-creator"') < choice.indexOf('id="ready-treatments"'));
  assert.match(choice, /href=\{creatorHref\}/);
  assert.match(choice, /href=\{readyBookingHref\}/);

  const prices = await source('src/components/PricesPage.astro');
  assert.ok(prices.indexOf('id="creator"') < prices.indexOf('id="studio"'));
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
