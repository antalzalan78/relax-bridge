import { Temporal } from '@js-temporal/polyfill';
import type { BookingCategory, BookingSettings } from './types';

type NoticeSettings = Pick<
  BookingSettings,
  'timeZone' | 'slotIntervalMinutes' | 'minNoticeHours'
>;

/** The earliest permitted start for a date/category, or null when that day cannot be booked. */
export function bookingMinimumStart(input: {
  date: string;
  category: BookingCategory;
  now: Temporal.Instant | string;
  settings: NoticeSettings;
}): string | null {
  const now = typeof input.now === 'string'
    ? Temporal.Instant.from(input.now)
    : input.now;
  const requestedDay = Temporal.PlainDate.from(input.date);
  const today = now.toZonedDateTimeISO(input.settings.timeZone).toPlainDate();
  const dayComparison = Temporal.PlainDate.compare(requestedDay, today);

  if (dayComparison < 0) return null;
  if (dayComparison > 0) {
    return now.add({ hours: input.settings.minNoticeHours }).toString();
  }
  if (input.category === 'home') return null;

  // Same-day Studio Visit starts at least an hour from now, rounded up to
  // the next booking interval in the studio's local time zone.
  const earliest = now.add({ hours: 1 }).round({
    smallestUnit: 'millisecond',
    roundingMode: 'ceil',
  });
  const local = earliest.toZonedDateTimeISO(input.settings.timeZone);
  const intervalMilliseconds = input.settings.slotIntervalMinutes * 60_000;
  const localMilliseconds = (
    ((local.hour * 60 + local.minute) * 60 + local.second) * 1_000
    + local.millisecond
  );
  const remainder = localMilliseconds % intervalMilliseconds;
  return earliest.add({ milliseconds: remainder === 0 ? 0 : intervalMilliseconds - remainder })
    .toString();
}
