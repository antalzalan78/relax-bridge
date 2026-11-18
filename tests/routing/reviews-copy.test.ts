import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Agustina’s complete English review and faithful translations appear in guest reviews', async () => {
  const reviews = await readFile(new URL('../../src/components/Reviews.astro', import.meta.url), 'utf8');

  assert.match(reviews, /I had a wonderful massage experience! Brigitta was very professional, attentive, and made me feel comfortable and relaxed throughout the session\. I really enjoyed it and would definitely recommend her!/);
  assert.match(reviews, /Ik heb een heerlijke massage gehad! Brigitta was heel professioneel en attent\./);
  assert.match(reviews, /Csodálatos masszázsélményben volt részem! Brigitta nagyon profi és figyelmes volt/);
  assert.match(reviews, /<span>\{quote\.note\}<\/span>/);
  assert.equal((reviews.match(/name: 'Marilisa'/g) ?? []).length, 3);
  assert.doesNotMatch(reviews, /Marilisa Pimentel/);
});
