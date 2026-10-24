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

test('buffered manual appointments use the same busy window as regular bookings', () => {
  const start = '2026-11-02T09:15:00Z';
  const end = '2026-11-02T10:15:00Z';
  const buffered = manualBlocks.manualBlockWindows([{
    starts_at: start, ends_at: end, service_category: 'studio', buffer_minutes: 30,
  }]);
  assert.equal(buffered.busy[0].start, '2026-11-02T08:45:00Z');
  assert.equal(buffered.busy[0].end, end);
  assert.equal(buffered.blocked.length, 0);

  const exact = manualBlocks.manualBlockWindows([{
    starts_at: start, ends_at: end, service_category: 'studio', buffer_minutes: 0,
  }]);
  assert.equal(exact.busy.length, 0);
  assert.equal(exact.blocked[0].start, start);
  assert.equal(exact.blocked[0].end, end);
});

test('lazy schema upgrades legacy manual occupancy without deleting appointments', async () => {
  const pg = new PGlite();
  try {
    for (const migration of [
      '0001_booking.sql', '0004_google_calendar.sql', '0005_booking_buffers.sql',
      '0014_manual_calendar_blocks.sql',
    ]) {
      await pg.exec(readFileSync(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await pg.exec(`ALTER TABLE google_calendar_event_links
      DROP CONSTRAINT google_calendar_event_links_entity_type_check;
      ALTER TABLE google_calendar_event_links
      ADD CONSTRAINT google_calendar_event_links_entity_type_check
      CHECK (entity_type IN ('booking', 'availability_rule', 'availability_exception'))`);
    await pg.exec(`ALTER TABLE manual_calendar_blocks
      DROP CONSTRAINT manual_calendar_blocks_no_overlap;
      ALTER TABLE manual_calendar_blocks
      ADD CONSTRAINT manual_calendar_blocks_no_overlap
      EXCLUDE USING gist (tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&)
      WHERE (cancelled_at IS NULL)`);
    await pg.query(`INSERT INTO manual_calendar_blocks (
      id, service_category, starts_at, ends_at, occupied_starts_at,
      occupied_ends_at, duration_minutes, buffer_minutes
    ) VALUES (
      '00000000-0000-4000-8000-000000000098', 'studio',
      '2026-11-02T09:15:00Z', '2026-11-02T10:15:00Z',
      '2026-11-02T08:45:00Z', '2026-11-02T10:45:00Z', 60, 30
    )`);
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
    const upgraded = await pg.query<{ occupied_ends_at: Date }>(
      "SELECT occupied_ends_at FROM manual_calendar_blocks WHERE id = '00000000-0000-4000-8000-000000000098'",
    );
    assert.equal(new Date(upgraded.rows[0].occupied_ends_at).toISOString(), '2026-11-02T10:15:00.000Z');
    const overlap = await pg.query<{ definition: string }>(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'manual_calendar_blocks'::regclass
      AND conname = 'manual_calendar_blocks_no_overlap'`);
    assert.match(overlap.rows[0].definition, /tstzrange\(starts_at, ends_at/);
  } finally { await pg.close(); }
});

test('manual blocks affect public slots, reject collisions and can be released', async () => {
  const pg = new PGlite();
  try {
    for (const migration of [
      '0001_booking.sql', '0004_google_calendar.sql', '0005_booking_buffers.sql',
      '0014_manual_calendar_blocks.sql', '0015_manual_blocks_booking_logic.sql',
    ]) {
      await pg.exec(readFileSync(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await pg.exec(readFileSync(new URL('../../db/migrations/0015_manual_blocks_booking_logic.sql', import.meta.url), 'utf8'));
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
    await assert.rejects(repository.addManualCalendarBlock({
      ...input, now: '2026-11-02T08:30:00Z',
    }), /nem elérhető/);
    await assert.rejects(repository.addManualCalendarBlock({
      ...input, day: '2026-11-03',
    }), /nem elérhető/);
    const exactClosedDay = await repository.addManualCalendarBlock({
      ...input, day: '2026-11-03', applyStandardBuffer: false,
    });
    await repository.cancelManualCalendarBlock(exactClosedDay);
    const id = await repository.addManualCalendarBlock(input);
    const rows = await pg.query<{ guest_name: string | null; buffer_minutes: number; occupied_ends_at: string }>(
      'SELECT guest_name, buffer_minutes, occupied_ends_at FROM manual_calendar_blocks WHERE id = $1', [id],
    );
    assert.equal(rows.rows[0].guest_name, null);
    assert.equal(rows.rows[0].buffer_minutes, 30);
    assert.equal(new Date(rows.rows[0].occupied_ends_at).toISOString(), '2026-11-02T10:15:00.000Z');

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
    await assert.rejects(repository.addManualCalendarBlock({ ...input, startTime: '11:30' }), /nem elérhető/);
    const secondId = await repository.addManualCalendarBlock({ ...input, startTime: '11:45' });
    assert.equal(await repository.cancelManualCalendarBlock(id), true);
    assert.equal(await repository.cancelManualCalendarBlock(id), false);
    const reopened = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(reopened.some((slot: { label: string }) => slot.label === '10:15'), true);
    await repository.cancelManualCalendarBlock(secondId);

    const exactId = await repository.addManualCalendarBlock({ ...input, applyStandardBuffer: false });
    const exact = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(exact.some((slot: { label: string }) => slot.label === '11:15'), true);
    const adjacentId = await repository.addManualCalendarBlock({ ...input, startTime: '11:15' });
    await pg.exec(readFileSync(new URL('../../db/migrations/0014_manual_calendar_blocks.sql', import.meta.url), 'utf8'));
    await pg.exec(readFileSync(new URL('../../db/migrations/0015_manual_blocks_booking_logic.sql', import.meta.url), 'utf8'));
    await repository.cancelManualCalendarBlock(exactId);
    await repository.cancelManualCalendarBlock(adjacentId);

    const homeId = await repository.addManualCalendarBlock({ ...input, category: 'home' });
    const afterHome = await repository.getAvailableSlots({
      date: input.day, category: 'studio', durationMinutes: 60, now,
    });
    assert.equal(afterHome.some((slot: { label: string }) => slot.label === '11:30'), false);
    assert.equal(afterHome.some((slot: { label: string }) => slot.label === '11:45'), true);
    await repository.cancelManualCalendarBlock(homeId);

    await pg.query(`INSERT INTO bookings (
      id, reference, service_key, service_category, service_title,
      duration_minutes, price_eur, customer_name, customer_email,
      customer_phone, locale, starts_at, ends_at, busy_starts_at, busy_ends_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000088', 'RB-TEST-STUDIO', 'relax', 'studio', 'Relaxmassage',
      60, 65, 'Existing guest', 'guest@example.com', '0000000000', 'nl',
      '2026-11-02T09:15:00Z', '2026-11-02T10:15:00Z',
      '2026-11-02T08:45:00Z', '2026-11-02T10:15:00Z'
    )`);
    await assert.rejects(repository.addManualCalendarBlock({ ...input, startTime: '11:30' }), /nem elérhető/);
    await repository.addManualCalendarBlock({ ...input, startTime: '11:45' });
  } finally { await pg.close(); }
});
