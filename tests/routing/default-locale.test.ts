import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import config from '../../astro.config.mjs';
import { defaultLocale, pathFor } from '../../src/data/site.ts';

test('the unprefixed site always uses Dutch as its default language', async () => {
  const routing = config.i18n?.routing;

  assert.equal(config.i18n?.defaultLocale, 'nl');
  assert.notEqual(routing, undefined);
  assert.notEqual(routing, 'manual');
  if (!routing || routing === 'manual') return;
  assert.equal(routing.prefixDefaultLocale, false);
  assert.equal(routing.redirectToDefaultLocale, false);
  assert.equal(defaultLocale, 'nl');
  assert.equal(pathFor('nl'), '/');
  assert.equal(pathFor('en'), '/en');
  assert.equal(pathFor('hu'), '/hu');

  const rootPage = await readFile(new URL('../../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(rootPage, /<HomePage locale="nl"\s*\/>/);
});

test('an explicit /nl URL is canonicalized to the unprefixed Dutch route', async () => {
  const vercelConfig = JSON.parse(
    await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'),
  ) as { redirects: Array<{ source: string; destination: string; permanent: boolean }> };

  assert.deepEqual(vercelConfig.redirects.slice(0, 2), [
    { source: '/nl', destination: '/', permanent: true },
    { source: '/nl/:path*', destination: '/:path*', permanent: true },
  ]);
});
