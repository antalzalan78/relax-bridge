import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('retired Home Service is not promoted on public entry pages', async () => {
  for (const path of [
    'src/components/HomePage.astro',
    'src/components/Footer.astro',
    'src/components/PricesPage.astro',
  ]) {
    const page = await source(path);
    assert.doesNotMatch(page, /getServices\(locale, 'home'\)|d\.options\.homeService|d\.nav\.homeService/);
  }
  assert.doesNotMatch(await source('src/components/BookingPage.astro'), /<(?:a|div) class="booking-choice-card[^"]*booking-choice-card--home/);
  assert.doesNotMatch(await source('src/components/QuestionnairePage.astro'), /data-required-group="homeService"/);
  const admin = await source('src/pages/admin/index.astro');
  assert.match(admin, /category: z\.literal\('studio'\)/);
  assert.doesNotMatch(admin, /<option value="home"/);
});

test('former public treatment URLs redirect to active studio treatments', async () => {
  const config = JSON.parse(await source('vercel.json')) as {
    redirects: Array<{ source: string; destination: string; permanent: boolean }>;
  };
  const expected: Record<string, string> = {
    '/home-service/relaxmassage': '/massage/relaxmassage',
    '/home-service/nek-schouder-rugmassage': '/massage/nek-schouder-rugmassage',
    '/en/home-service/relax-massage': '/en/massage/relax-massage',
    '/en/home-service/neck-shoulder-back-massage': '/en/massage/neck-shoulder-back-massage',
    '/hu/hazhoz/relaxmasszazs': '/hu/masszazs/relaxmasszazs',
    '/hu/hazhoz/nyak-vall-hatmasszazs': '/hu/masszazs/nyak-vall-hatmasszazs',
  };
  for (const [oldPath, newPath] of Object.entries(expected)) {
    assert.ok(config.redirects.some((rule) =>
      rule.source === oldPath && rule.destination === newPath && rule.permanent));
  }
  assert.match(await source('src/pages/[category]/[slug].astro'), /s\.data\.category === 'studio'/);
  assert.match(await source('src/pages/[lang]/[category]/[slug].astro'), /s\.data\.category === 'studio'/);
});
