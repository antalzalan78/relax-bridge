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

function loadManualSchema(database: unknown): { ensureManualBlocksSchema: () => Promise<void> } {
  const source = readFileSync(new URL('../../src/lib/server/manual-blocks-schema.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name === './db') return { getDatabase: () => database };
      if (name === './google-calendar-schema') return { ensureGoogleCalendarSchema: async () => {} };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports as { ensureManualBlocksSchema: () => Promise<void> };
}

test('manual windows reserve the after-buffer once and exact blocks have no buffer', () => {
  const start = '2026-11-02T09:15:00Z';
  const end = '2026-11-02T10:15:00Z';
  const buffered = manualBlocks.manualBlockWindows([{
    starts_at: start, ends_at: end, service_category: 'studio', buffer_minutes: 30,
  }]);
  assert.equal(buffered.busy[0].start, '2026-11-02T08:45:00Z');
  assert.equal(buffered.busy[0].end, end);
  assert.equal(buffered.blocked[0].start, end);
  assert.equal(buffered.blocked[0].end, '2026-11-02T10:45:00Z');

  const exact = manualBlocks.manualBlockWindows([{
    starts_at: start, ends_at: end, service_category: 'studio', buffer_minutes: 0,
  }]);
  assert.equal(exact.busy.length, 0);
  assert.equal(exact.blocked[0].start, start);
  assert.equal(exact.blocked[0].end, end);
});

test('lazy schema upgrades an existing Google event-link constraint', async () => {
  const pg = new PGlite();
  try {
    for (const migration of ['0001_booking.sql', '0004_google_calendar.sql', '0005_booking_buffers.sql']) {
      await pg.exec(readFileSync(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
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
    const schema = loadManualSchema(database);
    await schema.ensureManualBlocksSchema();
    await schema.ensureManualBlocksSchema();
    await pg.query(`INSERT INTO google_calendar_event_links (entity_type, entity_id, calendar_id, google_event_id)
      VALUES ('manual_block', '00000000-0000-4000-8000-000000000099', 'calendar', 'test')`);
    const table = await pg.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'manual_calendar_blocks'");
    assert.equal(table.rows.length, 1);
  } finally { await pg.close(); }
});

test('manual blocks affect public slots, reject collisions and can be released', async () => {
  const pg = new PGlite();
  try {
    for (const migration of [
      '0001_booking.sql', '0004_google_calendar.sql', '0005_booking_buffers.sql',
      '0014_manual_calendar_blocks.sql',
    ]) {
      await pg.exec(readFileSync(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await pg.exec(readFileSync(new URL('../../db/migrations/0014_manual_calendar_blocks.sql', import.meta.url), 'utf8'));
    await pg.query("INSERT INTO availability_rules (id, weekday, start_time, end_time) VALUES ('00000000-0000-4000-8000-000000000001', 1, '09:00', '15:00')");
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
    const now = '2026-11-01T00:00:00Z';
    const input = {
      day: '2026-11-02', startTime: '10:15', durationMinutes: 60,
      category: 'studio', guestName: '', note: '', applyStandardBuffer: true, now,
    };
    const id = await repository.addManualCalendarBlock(input);
    const rows = await pg.query<{ guest_name: string | null; buffer_minutes: number; occupied_ends_at: string }>(
      'SELECT guest_name, buffer_minutes, occupied_ends_at FROM manual_calendar_blocks WHERE id = $1', [id],
    );
    assert.equal(rows.rows[0].guest_name, null);
    assert.equal(rows.rows[0].buffer_minutes, 30);
    assert.equal(new Date(rows.rows[0].occupied_ends_at).toISOString(), '2026-11-02T10:45:00.000Z');

    const slots = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(slots.some((slot: { label: string }) => slot.label === '10:15'), false);
    assert.equal(slots.some((slot: { label: string }) => slot.label === '11:30'), false);
    assert.equal(slots.some((slot: { label: string }) => slot.label === '11:45'), true);
    const choices = await repository.getDaySlotChoices({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(choices.unavailable.some((slot: { label: string }) => slot.label === '10:15'), true);
    assert.equal(choices.unavailable.some((slot: { label: string }) => slot.label === '11:45'), false);
    await assert.rejects(repository.addManualCalendarBlock({ ...input, startTime: '10:30' }), /ütközik/);
    assert.equal(await repository.cancelManualCalendarBlock(id), true);
    assert.equal(await repository.cancelManualCalendarBlock(id), false);
    const reopened = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(reopened.some((slot: { label: string }) => slot.label === '10:15'), true);

    await repository.addManualCalendarBlock({ ...input, applyStandardBuffer: false });
    const exact = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(exact.some((slot: { label: string }) => slot.label === '11:15'), true);
    const [exactRow] = (await pg.query<{ id: string }>(
      'SELECT id FROM manual_calendar_blocks WHERE cancelled_at IS NULL',
    )).rows;
    await repository.cancelManualCalendarBlock(exactRow.id);

    await repository.addManualCalendarBlock({ ...input, category: 'home' });
    const afterHome = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(afterHome.some((slot: { label: string }) => slot.label === '13:00'), false);
    assert.equal(afterHome.some((slot: { label: string }) => slot.label === '13:15'), true);
  } finally { await pg.close(); }
});
