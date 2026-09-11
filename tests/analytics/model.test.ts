import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCountryCode,
  normalizeEntryPath,
  normalizeTrafficSource,
  summarizeWebsiteTraffic,
  type TrafficAggregateRow,
} from '../../src/lib/analytics/model.ts';

test('normalizes campaigns and common referrer hosts without retaining full URLs', () => {
  assert.equal(normalizeTrafficSource({ utmSource: 'Summer Offer!' }), 'utm:summer-offer');
  assert.equal(normalizeTrafficSource({ referrerHost: 'www.google.nl' }), 'google');
  assert.equal(normalizeTrafficSource({ referrerHost: 'l.instagram.com' }), 'instagram');
  assert.equal(normalizeTrafficSource({ referrerHost: 'www.relaxbridge.nl', siteHost: 'relaxbridge.nl' }), 'internal');
  assert.equal(normalizeTrafficSource({}), 'direct');
  assert.equal(normalizeTrafficSource({ referrerHost: 'https://example.org/private/page?x=1' }), 'example.org');
});

test('keeps only a bounded page path and a valid country code', () => {
  assert.equal(normalizeEntryPath('/hu/booking?category=studio#time'), '/hu/booking');
  assert.equal(normalizeEntryPath('not-a-path'), '/');
  assert.equal(normalizeCountryCode('nl'), 'NL');
  assert.equal(normalizeCountryCode('unknown'), '??');
});

test('summarizes the rolling 7 and 30 day windows at the correct grain', () => {
  const rows: TrafficAggregateRow[] = [
    { day: '2026-09-11', source: 'direct', country_code: 'NL', entry_path: '/', locale: 'nl', visits: 3 },
    { day: '2026-09-11', source: 'google', country_code: 'BE', entry_path: '/en', locale: 'en', visits: '2' },
    { day: '2026-09-05', source: 'instagram', country_code: 'NL', entry_path: '/hu', locale: 'hu', visits: 4 },
    { day: '2026-08-23', source: 'google', country_code: 'DE', entry_path: '/', locale: 'nl', visits: 1 },
    { day: '2026-08-12', source: 'direct', country_code: 'NL', entry_path: '/', locale: 'nl', visits: 20 },
  ];

  const summary = summarizeWebsiteTraffic(rows, '2026-09-11');
  assert.equal(summary.today, 5);
  assert.equal(summary.last7Days, 9);
  assert.equal(summary.last30Days, 10);
  assert.equal(summary.daily.length, 30);
  assert.deepEqual(summary.sources.slice(0, 3), [
    { key: 'instagram', count: 4 },
    { key: 'direct', count: 3 },
    { key: 'google', count: 3 },
  ]);
  assert.deepEqual(summary.locales, { nl: 4, en: 2, hu: 4 });
});
