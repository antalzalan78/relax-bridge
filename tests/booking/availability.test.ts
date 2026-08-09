import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAvailableSlots,
  localDayInstantRange,
} from '../../src/lib/booking/availability.ts';

const base = {
  date: '2026-08-10',
  timeZone: 'Europe/Amsterdam',
  openWindows: [{ start: '09:00', end: '12:00' }],
  blockedWindows: [],
  busyWindows: [],
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
  stepMinutes: 15,
};

test('creates slots on the configured grid and keeps the after-buffer inside opening hours', () => {
  const slots = buildAvailableSlots(base);
  assert.deepEqual(
    slots.map((slot) => slot.label),
    ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45'],
  );
  assert.equal(slots.at(-1)?.busyEnd, '2026-08-10T10:00:00Z');
});

test('does not offer slots whose service or buffer overlaps an existing booking', () => {
  const slots = buildAvailableSlots({
    ...base,
    durationMinutes: 30,
    busyWindows: [{ start: '2026-08-10T08:00:00Z', end: '2026-08-10T09:00:00Z' }],
  });
  assert.deepEqual(
    slots.map((slot) => slot.label),
    ['09:00', '09:15', '11:00', '11:15'],
  );
});

test('reserves travel time before and after home appointments', () => {
  const slots = buildAvailableSlots({
    ...base,
    openWindows: [{ start: '09:00', end: '13:00' }],
    bufferBeforeMinutes: 30,
    bufferAfterMinutes: 30,
  });
  assert.equal(slots[0].label, '09:30');
  assert.equal(slots[0].busyStart, '2026-08-10T07:00:00Z');
  assert.equal(slots.at(-1)?.label, '11:30');
  assert.equal(slots.at(-1)?.busyEnd, '2026-08-10T11:00:00Z');
});

test('honours partial blocked periods and the minimum notice instant', () => {
  const slots = buildAvailableSlots({
    ...base,
    blockedWindows: [{ start: '2026-08-10T07:45:00Z', end: '2026-08-10T08:30:00Z' }],
    minStart: '2026-08-10T07:30:00Z',
  });
  assert.deepEqual(slots.map((slot) => slot.label), ['10:30', '10:45']);
});

test('uses real local-day duration across daylight-saving changes', () => {
  const spring = localDayInstantRange('2026-03-29', 'Europe/Amsterdam');
  const autumn = localDayInstantRange('2026-10-25', 'Europe/Amsterdam');
  assert.equal(
    new Date(spring.end).getTime() - new Date(spring.start).getTime(),
    23 * 60 * 60 * 1000,
  );
  assert.equal(
    new Date(autumn.end).getTime() - new Date(autumn.start).getTime(),
    25 * 60 * 60 * 1000,
  );
});
