import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAvailableSlots,
  localDayInstantRange,
  resolveOpenWindows,
} from '../../src/lib/booking/availability.ts';
import {
  homeServiceBufferMinutes,
  studioVisitBufferMinutes,
} from '../../src/lib/booking/buffers.ts';

const base = {
  date: '2026-08-10',
  timeZone: 'Europe/Amsterdam',
  openWindows: [{ start: '09:00', end: '12:00' }],
  blockedWindows: [],
  busyWindows: [],
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  stepMinutes: 15,
};

test('offers the complete opening window when there is no earlier treatment', () => {
  const slots = buildAvailableSlots(base);
  assert.deepEqual(
    slots.map((slot) => slot.label),
    ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00'],
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
    ['09:00', '09:15', '09:30', '11:00', '11:15', '11:30'],
  );
});

test('does not delay the first Home Service in an opening window', () => {
  const slots = buildAvailableSlots({
    ...base,
    openWindows: [{ start: '09:00', end: '14:00' }],
    bufferBeforeMinutes: homeServiceBufferMinutes,
  });
  assert.equal(slots[0].label, '09:00');
  assert.equal(slots[0].busyStart, '2026-08-10T05:00:00Z');
  assert.equal(slots.at(-1)?.label, '13:00');
  assert.equal(slots.at(-1)?.busyEnd, '2026-08-10T12:00:00Z');
});

test('requires two hours before a Home Service when a treatment precedes it', () => {
  const slots = buildAvailableSlots({
    ...base,
    openWindows: [{ start: '09:00', end: '17:00' }],
    busyWindows: [{ start: '2026-08-10T07:00:00Z', end: '2026-08-10T08:00:00Z' }],
    bufferBeforeMinutes: homeServiceBufferMinutes,
  });

  assert.equal(slots[0].label, '12:00');
});

test('requires 30 minutes before a Studio Visit when a treatment precedes it', () => {
  const slots = buildAvailableSlots({
    ...base,
    openWindows: [{ start: '09:00', end: '17:00' }],
    busyWindows: [{ start: '2026-08-10T07:00:00Z', end: '2026-08-10T08:00:00Z' }],
    bufferBeforeMinutes: studioVisitBufferMinutes,
  });

  assert.equal(slots[0].label, '10:30');
});

test('does not treat a manually blocked period as a preceding treatment', () => {
  const slots = buildAvailableSlots({
    ...base,
    openWindows: [{ start: '09:00', end: '14:00' }],
    blockedWindows: [{ start: '2026-08-10T07:00:00Z', end: '2026-08-10T08:00:00Z' }],
    bufferBeforeMinutes: homeServiceBufferMinutes,
  });

  assert.equal(slots[0].label, '10:00');
});

test('honours partial blocked periods and the minimum notice instant', () => {
  const slots = buildAvailableSlots({
    ...base,
    blockedWindows: [{ start: '2026-08-10T07:45:00Z', end: '2026-08-10T08:30:00Z' }],
    minStart: '2026-08-10T07:30:00Z',
  });
  assert.deepEqual(slots.map((slot) => slot.label), ['10:30', '10:45', '11:00']);
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

test('resolves visible admin opening windows with additions and partial closures', () => {
  assert.deepEqual(
    resolveOpenWindows({
      baseWindows: [{ start: '09:00', end: '12:00' }],
      additionalOpenWindows: [{ start: '13:00', end: '17:00' }],
      blockedWindows: [
        { start: '10:00', end: '10:30' },
        { start: '15:00', end: '16:00' },
      ],
    }),
    [
      { start: '09:00', end: '10:00' },
      { start: '10:30', end: '12:00' },
      { start: '13:00', end: '15:00' },
      { start: '16:00', end: '17:00' },
    ],
  );
});

test('hides opening windows on a fully blocked day', () => {
  assert.deepEqual(
    resolveOpenWindows({
      baseWindows: [{ start: '09:00', end: '17:00' }],
      blockAllDay: true,
    }),
    [],
  );
});
