import { Temporal } from '@js-temporal/polyfill';
import type {
  AvailableSlot,
  InstantWindow,
  LocalTimeWindow,
} from './types';

interface BuildSlotsInput {
  date: string;
  timeZone: string;
  openWindows: LocalTimeWindow[];
  blockedWindows: InstantWindow[];
  busyWindows: InstantWindow[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  stepMinutes: number;
  minStart?: string;
}

interface EpochWindow {
  start: number;
  end: number;
}

interface ResolveOpenWindowsInput {
  baseWindows: LocalTimeWindow[];
  additionalOpenWindows?: LocalTimeWindow[];
  blockedWindows?: LocalTimeWindow[];
  blockAllDay?: boolean;
}

function localWindowToEpoch(
  date: Temporal.PlainDate,
  timeZone: string,
  window: LocalTimeWindow,
): EpochWindow {
  const start = date.toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from(window.start),
  });
  const end = date.toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from(window.end),
  });

  return {
    start: start.epochMilliseconds,
    end: end.epochMilliseconds,
  };
}

function instantWindowToEpoch(window: InstantWindow): EpochWindow {
  return {
    start: Temporal.Instant.from(window.start).epochMilliseconds,
    end: Temporal.Instant.from(window.end).epochMilliseconds,
  };
}

function overlaps(a: EpochWindow, b: EpochWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

function mergeWindows(windows: EpochWindow[]): EpochWindow[] {
  const sorted = windows
    .filter((window) => window.start < window.end)
    .sort((a, b) => a.start - b.start);
  const merged: EpochWindow[] = [];

  for (const window of sorted) {
    const previous = merged.at(-1);
    if (!previous || previous.end < window.start) {
      merged.push({ ...window });
      continue;
    }
    previous.end = Math.max(previous.end, window.end);
  }

  return merged;
}

function localTimeToMinutes(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToLocalTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

/** Resolves the effective opening windows shown in the admin calendar. */
export function resolveOpenWindows(input: ResolveOpenWindowsInput): LocalTimeWindow[] {
  if (input.blockAllDay) return [];

  let open = mergeWindows(
    [...input.baseWindows, ...(input.additionalOpenWindows ?? [])].map((window) => ({
      start: localTimeToMinutes(window.start),
      end: localTimeToMinutes(window.end),
    })),
  );

  const blocked = mergeWindows(
    (input.blockedWindows ?? []).map((window) => ({
      start: localTimeToMinutes(window.start),
      end: localTimeToMinutes(window.end),
    })),
  );

  for (const blockedWindow of blocked) {
    open = open.flatMap((window) => {
      if (!overlaps(window, blockedWindow)) return [window];

      const remaining: EpochWindow[] = [];
      if (window.start < blockedWindow.start) {
        remaining.push({ start: window.start, end: blockedWindow.start });
      }
      if (blockedWindow.end < window.end) {
        remaining.push({ start: blockedWindow.end, end: window.end });
      }
      return remaining;
    });
  }

  return open.map((window) => ({
    start: minutesToLocalTime(window.start),
    end: minutesToLocalTime(window.end),
  }));
}

function toIso(epochMilliseconds: number): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toString();
}

function labelFor(epochMilliseconds: number, timeZone: string): string {
  const zoned = Temporal.Instant.fromEpochMilliseconds(epochMilliseconds)
    .toZonedDateTimeISO(timeZone);
  return `${String(zoned.hour).padStart(2, '0')}:${String(zoned.minute).padStart(2, '0')}`;
}

export function buildAvailableSlots(input: BuildSlotsInput): AvailableSlot[] {
  const date = Temporal.PlainDate.from(input.date);
  const openWindows = mergeWindows(
    input.openWindows.map((window) =>
      localWindowToEpoch(date, input.timeZone, window),
    ),
  );
  const unavailable = [
    ...input.blockedWindows.map(instantWindowToEpoch),
    ...input.busyWindows.map(instantWindowToEpoch),
  ];
  const minimumStart = input.minStart
    ? Temporal.Instant.from(input.minStart).epochMilliseconds
    : Number.NEGATIVE_INFINITY;
  const minute = 60_000;
  const slots: AvailableSlot[] = [];

  for (const window of openWindows) {
    for (
      let serviceStart = window.start + input.bufferBeforeMinutes * minute;
      serviceStart +
        (input.durationMinutes + input.bufferAfterMinutes) * minute <=
      window.end;
      serviceStart += input.stepMinutes * minute
    ) {
      if (serviceStart < minimumStart) continue;

      const serviceEnd = serviceStart + input.durationMinutes * minute;
      const busyStart = serviceStart - input.bufferBeforeMinutes * minute;
      const busyEnd = serviceEnd + input.bufferAfterMinutes * minute;
      const occupied = { start: busyStart, end: busyEnd };

      if (unavailable.some((window) => overlaps(occupied, window))) continue;

      slots.push({
        start: toIso(serviceStart),
        end: toIso(serviceEnd),
        busyStart: toIso(busyStart),
        busyEnd: toIso(busyEnd),
        label: labelFor(serviceStart, input.timeZone),
      });
    }
  }

  return slots;
}

export function localDayInstantRange(
  date: string,
  timeZone: string,
): InstantWindow {
  const day = Temporal.PlainDate.from(date);
  const start = day.toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from('00:00'),
  });
  const end = day.add({ days: 1 }).toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from('00:00'),
  });
  return { start: start.toInstant().toString(), end: end.toInstant().toString() };
}

export function localTimeWindowInstantRange(
  date: string,
  timeZone: string,
  window: LocalTimeWindow,
): InstantWindow {
  const epoch = localWindowToEpoch(
    Temporal.PlainDate.from(date),
    timeZone,
    window,
  );
  return { start: toIso(epoch.start), end: toIso(epoch.end) };
}

export function addLocalDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function todayInTimeZone(timeZone: string): string {
  return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
}
