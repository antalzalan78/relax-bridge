import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import ts from 'typescript';

function availabilityRoute() {
  const source = readFileSync(new URL('../../src/pages/api/availability.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = { settings: 0, refresh: 0, calendar: 0, day: 0 };
  const dependencies: Record<string, unknown> = {
    '@js-temporal/polyfill': { Temporal },
    zod: { z },
    '../../lib/server/booking-repository': {
      getBookingSettings: async () => { calls.settings += 1; return { timeZone: 'Europe/Amsterdam', bookingHorizonDays: 60 }; },
      getAvailableDates: async () => { calls.calendar += 1; return { dates: ['2026-11-12'], today: '2026-11-10', lastDay: '2027-01-09', timeZone: 'Europe/Amsterdam' }; },
      getDaySlotChoices: async () => { calls.day += 1; return { available: [], unavailable: [] }; },
    },
    '../../lib/booking/availability': {
      localDayInstantRange: () => ({ start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }),
      todayInTimeZone: () => '2026-11-10',
    },
    '../../lib/server/google-calendar': {
      safelyRefreshGoogleCalendarBusy: async () => { calls.refresh += 1; },
    },
    '../../lib/booking/public-service-availability': {
      isPublicBookingCategoryEnabled: (category: string) => category === 'studio',
    },
  };
  const exports: Record<string, any> = {};
  runInNewContext(code, {
    exports,
    Response,
    console,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return { GET: exports.GET as (input: { url: URL }) => Promise<Response>, calls };
}

test('quick month lookup uses cached busy data without waiting for Google', async () => {
  const { GET, calls } = availabilityRoute();
  const response = await GET({ url: new URL('https://example.test/api/availability?from=2026-11-01&to=2026-11-30&category=studio&minutes=60&quick=1') });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provisional, true);
  assert.deepEqual(calls, { settings: 0, refresh: 0, calendar: 1, day: 0 });
});

test('normal month lookup still refreshes Google before returning final dates', async () => {
  const { GET, calls } = availabilityRoute();
  const response = await GET({ url: new URL('https://example.test/api/availability?from=2026-11-01&to=2026-11-30&category=studio&minutes=60') });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provisional, false);
  assert.deepEqual(calls, { settings: 1, refresh: 1, calendar: 1, day: 0 });
});

test('day lookup always refreshes Google, even if quick is requested', async () => {
  const { GET, calls } = availabilityRoute();
  const response = await GET({ url: new URL('https://example.test/api/availability?date=2026-11-12&category=studio&minutes=60&quick=1') });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, { settings: 1, refresh: 1, calendar: 0, day: 1 });
});
