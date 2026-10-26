import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { Temporal } from '@js-temporal/polyfill';
import ts from 'typescript';
import * as availability from '../../src/lib/booking/availability.ts';
import * as bookingWindow from '../../src/lib/booking/booking-window.ts';
import * as buffers from '../../src/lib/booking/buffers.ts';
import * as manualBlocks from '../../src/lib/booking/manual-blocks.ts';

function loadRepository(database: unknown): Record<string, (...args: any[]) => Promise<any>> {
  const source = readFileSync(new URL('../../src/lib/server/booking-repository.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    'node:crypto': crypto,
    '@js-temporal/polyfill': { Temporal },
    '../booking/availability': availability,
    '../booking/booking-window': bookingWindow,
    '../booking/manual-blocks': manualBlocks,
    '../booking/buffers': buffers,
    './booking-email-schema': { ensureBookingEmailDeliverySchema: async () => {} },
    './db': { getDatabase: () => database },
    './google-calendar-schema': { ensureGoogleCalendarSchema: async () => {} },
    './manual-blocks-schema': { ensureManualBlocksSchema: async () => {} },
  };
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test('weekly hours apply only to selected year-months and legacy rules remain continuous', async () => {
  const pg = new PGlite();
  try {
    for (const migration of [
      '0001_booking.sql', '0004_google_calendar.sql', '0005_booking_buffers.sql',
      '0014_manual_calendar_blocks.sql', '0015_manual_blocks_booking_logic.sql',
      '0016_availability_rule_series.sql',
    ]) {
      await pg.exec(readFileSync(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await pg.exec(readFileSync(new URL('../../db/migrations/0016_availability_rule_series.sql', import.meta.url), 'utf8'));
    await pg.query("UPDATE booking_settings SET booking_horizon_days = 365 WHERE id = 1");
    await pg.query(`INSERT INTO availability_rules (id, weekday, start_time, end_time)
      VALUES ('00000000-0000-4000-8000-000000000001', 3, '10:00', '12:00')`);
    const query = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
      return (await pg.query(sql, values)).rows;
    };
    const database = Object.assign(query, {
      begin: async (callback: (transaction: typeof query) => Promise<unknown>) => {
        await pg.exec('BEGIN');
        try { const result = await callback(query); await pg.exec('COMMIT'); return result; }
        catch (error) { await pg.exec('ROLLBACK'); throw error; }
      },
    });
    const repository = loadRepository(database);
    const [novemberId, januaryId] = await repository.addAvailabilityRule({
      weekday: 1, startTime: '10:00', endTime: '12:00',
      months: ['2026-11', '2027-01'],
    });
    const rows = await pg.query<{ id: string; series_id: string; valid_from: string; valid_until: string }>(`
      SELECT id, series_id, valid_from::text, valid_until::text FROM availability_rules
      WHERE weekday = 1 ORDER BY valid_from
    `);
    assert.deepEqual(rows.rows.map((row) => [row.valid_from, row.valid_until]), [
      ['2026-11-01', '2026-11-30'], ['2027-01-01', '2027-01-31'],
    ]);
    assert.equal(rows.rows[0].series_id, rows.rows[1].series_id);
    assert.equal((await repository.listAvailabilityRules()).length, 3);

    const now = '2026-10-26T00:00:00Z';
    const hasSlot = async (date: string) => (await repository.getAvailableSlots({
      date, category: 'studio', durationMinutes: 60, now,
    })).some((slot: { label: string }) => slot.label === '10:00');
    assert.equal(await hasSlot('2026-11-02'), true);
    assert.equal(await hasSlot('2026-12-07'), false);
    assert.equal(await hasSlot('2027-01-04'), true);
    assert.equal(await hasSlot('2026-12-09'), true); // existing unscoped Wednesday
    const legacyRuleId = '00000000-0000-4000-8000-000000000001';
    await repository.updateAvailabilityRuleMonths(legacyRuleId, ['2026-11', '2027-01']);
    const legacySeries = await pg.query<{ series_id: string }>(
      "SELECT series_id FROM availability_rules WHERE weekday = 3 ORDER BY valid_from",
    );
    assert.equal(legacySeries.rows.length, 2);
    assert.equal(legacySeries.rows[0].series_id, legacySeries.rows[1].series_id);
    assert.equal(await hasSlot('2026-12-09'), false);
    await repository.updateAvailabilityRuleMonths(legacyRuleId, []);
    assert.equal(await hasSlot('2026-12-09'), true);
    const decemberDates = await repository.getAvailableDates({
      from: '2026-12-07', to: '2026-12-07', category: 'studio', durationMinutes: 60, now,
    });
    assert.deepEqual(Array.from(decemberDates.dates), []);

    const updated = await repository.updateAvailabilityRuleMonths(novemberId, ['2026-12']);
    assert.deepEqual(Array.from(updated.syncIds), [novemberId]);
    assert.deepEqual(Array.from(updated.removedIds), [januaryId]);
    assert.equal(await hasSlot('2026-11-02'), false);
    assert.equal(await hasSlot('2026-12-07'), true);
    assert.equal(await hasSlot('2027-01-04'), false);

    const always = await repository.updateAvailabilityRuleMonths(novemberId, []);
    assert.deepEqual(Array.from(always.syncIds), [novemberId]);
    assert.equal(await hasSlot('2026-11-02'), true);
    assert.equal(await hasSlot('2027-01-04'), true);
    assert.deepEqual(Array.from(await repository.deleteAvailabilityRule(novemberId)), [novemberId]);
    assert.equal(await hasSlot('2026-11-02'), false);
    assert.equal(await hasSlot('2026-12-09'), true);
    const groupedIds = await repository.addAvailabilityRule({
      weekday: 1, startTime: '10:00', endTime: '12:00',
      months: ['2027-02', '2027-04'],
    });
    assert.deepEqual(
      Array.from(await repository.deleteAvailabilityRule(groupedIds[0])).sort(),
      Array.from(groupedIds).sort(),
    );
    await assert.rejects(repository.addAvailabilityRule({
      weekday: 1, startTime: '10:00', endTime: '12:00', months: ['2026-13'],
    }), /Érvénytelen hónap/);
  } finally { await pg.close(); }
});
