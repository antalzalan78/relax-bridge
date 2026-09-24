import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingMinimumStart } from '../../src/lib/booking/booking-window.ts';
import { buildAvailableSlots } from '../../src/lib/booking/availability.ts';

const settings = {
  timeZone: 'Europe/Amsterdam',
  slotIntervalMinutes: 15,
  minNoticeHours: 12,
};

test('offers same-day Studio Visit one hour later, rounded up to the next 15-minute slot', () => {
  const minimumStart = bookingMinimumStart({
    date: '2026-09-24',
    category: 'studio',
    now: '2026-09-24T08:07:30Z', // 10:07:30 in Tilburg
    settings,
  });
  assert.equal(minimumStart, '2026-09-24T09:15:00Z');

  const slots = buildAvailableSlots({
    date: '2026-09-24',
    timeZone: settings.timeZone,
    openWindows: [{ start: '09:00', end: '13:00' }],
    blockedWindows: [],
    busyWindows: [],
    durationMinutes: 60,
    bufferBeforeMinutes: 30,
    bufferAfterMinutes: 0,
    stepMinutes: 15,
    minStart: minimumStart ?? undefined,
  });
  assert.equal(slots[0]?.label, '11:15');
});

test('keeps the exact one-hour boundary when it already matches a booking interval', () => {
  assert.equal(bookingMinimumStart({
    date: '2026-09-24',
    category: 'studio',
    now: '2026-09-24T08:00:00Z',
    settings,
  }), '2026-09-24T09:00:00Z');
});

test('never offers Home Service on the same local day', () => {
  assert.equal(bookingMinimumStart({
    date: '2026-09-24',
    category: 'home',
    now: '2026-09-24T08:00:00Z',
    settings,
  }), null);
});

test('preserves the existing notice period on later dates and rejects past dates', () => {
  const now = '2026-09-24T08:07:30Z';
  for (const category of ['studio', 'home'] as const) {
    assert.equal(bookingMinimumStart({
      date: '2026-09-25', category, now, settings,
    }), '2026-09-24T20:07:30Z');
    assert.equal(bookingMinimumStart({
      date: '2026-09-23', category, now, settings,
    }), null);
  }
});

test('rounds forward after the repeated hour on the autumn clock-change day', () => {
  assert.equal(bookingMinimumStart({
    date: '2026-10-25',
    category: 'studio',
    now: '2026-10-25T00:58:00Z',
    settings,
  }), '2026-10-25T02:00:00Z');
});
