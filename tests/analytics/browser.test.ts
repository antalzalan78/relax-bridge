import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as journey from '../../src/lib/analytics/journey.ts';
import * as attribution from '../../src/lib/analytics/attribution.ts';

const code = ts.transpileModule(readFileSync(new URL('../../src/scripts/website-analytics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storageKey = 'relax-bridge-journey-v1';
let id = 0;
async function page(url: string, storage = new Map<string, string>(), options: { dnt?: string; gpc?: boolean; blocked?: boolean } = {}) {
  const events: Array<Record<string, string>> = [];
  const exports: { getAnalyticsSessionId?: () => string | undefined } = {};
  const handlers: Record<string, (event: { target: unknown }) => void> = {};
  class Element {
    href = '';
    language = false;
    closest() { return this; }
    hasAttribute() { return this.language; }
  }
  runInNewContext(code, {
    exports, URL, URLSearchParams, Date, Element,
    require: (name: string) => name.endsWith('/journey') ? journey : attribution,
    navigator: { doNotTrack: options.dnt || '0', globalPrivacyControl: options.gpc || false },
    document: { referrer: '', documentElement: { lang: 'nl' }, addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler; } },
    window: {
      location: new URL(url), crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` },
      sessionStorage: {
        getItem: (key: string) => { if (options.blocked) throw Error('blocked'); return storage.get(key) ?? null; },
        setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
      },
    },
    fetch: async (endpoint: string, options: { body: string }) => { events.push({ endpoint, ...JSON.parse(options.body) }); return { ok: true }; },
  });
  await Promise.resolve();
  await Promise.resolve();
  return {
    events, storage, session: exports.getAnalyticsSessionId?.(),
    click: (href: string, language = false) => { const element = new Element(); element.href = href; element.language = language; handlers.click?.({ target: element }); },
  };
}

const tagged = 'https://www.relaxbridge.nl/?utm_source=google&utm_medium=organic&utm_campaign=gbp&utm_content=website';
const expected = { utmSource: 'google', utmMedium: 'organic', utmCampaign: 'gbp', utmContent: 'website' };
test('all four campaign fields reach booking across navigation and language changes, without recounting a visit', async () => {
  const first = await page(tagged);
  for (const url of ['https://www.relaxbridge.nl/prijzen', 'https://www.relaxbridge.nl/en/booking']) {
    const next = await page(url, first.storage);
    assert.equal(next.session, first.session);
    assert.equal(next.events.length, 1);
    for (const [key, value] of Object.entries(expected)) assert.equal(next.events[0][key], value);
  }
  first.click('https://www.relaxbridge.nl/booking');
  first.click('https://www.relaxbridge.nl/en/booking', true);
  const clicks = first.events.filter((event) => event.eventType === 'booking_click');
  assert.equal(clicks.length, 1);
  for (const [key, value] of Object.entries(expected)) assert.equal(clicks[0][key], value);
});

test('first-touch attribution is stable; legacy sessions stay unknown rather than borrowing a later campaign', async () => {
  const first = await page('https://www.relaxbridge.nl/');
  const saved = JSON.parse(first.storage.get(storageKey)!);
  delete saved.utmMedium; delete saved.utmCampaign; delete saved.utmContent;
  first.storage.set(storageKey, JSON.stringify(saved));
  const next = await page(tagged, first.storage);
  assert.equal(next.session, first.session);
  for (const field of Object.keys(expected)) assert.equal(next.events[0][field], '');
  saved.createdAt = Date.now() - 25 * 60 * 60 * 1000;
  first.storage.set(storageKey, JSON.stringify(saved));
  const renewed = await page(tagged, first.storage);
  assert.notEqual(renewed.session, first.session);
  for (const [key, value] of Object.entries(expected)) assert.equal(renewed.events[0][key], value);
});

test('privacy controls, blocked storage and preview domains produce no tracking', async () => {
  for (const options of [{ dnt: '1' }, { gpc: true }, { blocked: true }]) {
    const result = await page(tagged, new Map(), options);
    assert.equal(result.events.length, 0);
    assert.equal(result.session, undefined);
  }
  assert.equal((await page('https://preview.example/')).events.length, 0);
});

test('overlong campaign fields are bounded before they can reject the entire analytics request', async () => {
  const result = await page(`https://www.relaxbridge.nl/?utm_campaign=${'a'.repeat(300)}&utm_content=Website%20Link`);
  assert.equal(result.events[0].utmCampaign.length, 100);
  assert.equal(result.events[0].utmContent, 'website-link');
});
