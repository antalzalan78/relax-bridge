import { randomBytes, randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import {
  buildAvailableSlots,
  localDayInstantRange,
  localTimeWindowInstantRange,
} from '../booking/availability';
import { bookingMinimumStart } from '../booking/booking-window';
import { homeToManualStudioBufferMinutes, manualBlockWindows } from '../booking/manual-blocks';
import {
  homeServiceBufferMinutes,
  studioVisitBufferMinutes,
} from '../booking/buffers';
import type {
  AvailableSlot,
  BookingCategory,
  BookingLocale,
  BookingOption,
  BookingServiceDetails,
  BookingSettings,
  InstantWindow,
  LocalTimeWindow,
} from '../booking/types';
import { ensureBookingEmailDeliverySchema } from './booking-email-schema';
import { getDatabase } from './db';
import { ensureGoogleCalendarSchema } from './google-calendar-schema';
import { ensureManualBlocksSchema } from './manual-blocks-schema';

type Queryable = any;

export class SlotUnavailableError extends Error {
  constructor() {
    super('The selected appointment is no longer available.');
  }
}

export class ManualBlockConflictError extends Error {
  constructor() {
    super('Az időpont a foglalási szabályok szerint nem elérhető: ellenőrizd a nyitvatartást, az előfoglalási határidőt és a többi foglalást.');
  }
}

export interface ConfirmedBookingInput {
  option: BookingOption;
  locale: BookingLocale;
  start: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  homeAddress?: string;
  homePostalCode?: string;
  notes?: string;
  serviceDetails?: BookingServiceDetails;
}

function shortTime(value: unknown): string {
  return String(value).slice(0, 5);
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

export async function getBookingSettings(
  query: Queryable = getDatabase(),
): Promise<BookingSettings> {
  const [row] = await query`
    SELECT
      time_zone,
      slot_interval_minutes,
      min_notice_hours,
      booking_horizon_days
    FROM booking_settings
    WHERE id = 1
  `;

  if (!row) throw new Error('Booking settings are missing. Run the database migration.');

  return {
    timeZone: String(row.time_zone),
    slotIntervalMinutes: numberValue(row.slot_interval_minutes),
    minNoticeHours: numberValue(row.min_notice_hours),
    bookingHorizonDays: numberValue(row.booking_horizon_days),
    studioBufferBeforeMinutes: studioVisitBufferMinutes,
    studioBufferAfterMinutes: 0,
    homeBufferBeforeMinutes: homeServiceBufferMinutes,
    homeBufferAfterMinutes: 0,
  };
}

function busyWindowFromRow(
  row: any,
  settings: BookingSettings,
): InstantWindow {
  const start = Temporal.Instant.from(new Date(row.starts_at).toISOString());
  const end = Temporal.Instant.from(new Date(row.ends_at).toISOString());
  const category = row.service_category as BookingCategory | null;
  if (!category) return { start: start.toString(), end: end.toString() };

  const isHome = category === 'home';
  const bufferBeforeMinutes = isHome
    ? settings.homeBufferBeforeMinutes
    : settings.studioBufferBeforeMinutes;
  const bufferAfterMinutes = isHome
    ? settings.homeBufferAfterMinutes
    : settings.studioBufferAfterMinutes;

  return {
    start: start.subtract({ minutes: bufferBeforeMinutes }).toString(),
    end: end.add({ minutes: bufferAfterMinutes }).toString(),
  };
}

function expandedBookingQueryRange(
  range: InstantWindow,
  settings: BookingSettings,
): InstantWindow {
  const maximumBefore = Math.max(
    settings.studioBufferBeforeMinutes,
    settings.homeBufferBeforeMinutes,
  );
  const maximumAfter = Math.max(
    settings.studioBufferAfterMinutes,
    settings.homeBufferAfterMinutes,
  );
  return {
    start: Temporal.Instant.from(range.start)
      .subtract({ minutes: maximumAfter })
      .toString(),
    end: Temporal.Instant.from(range.end)
      .add({ minutes: maximumBefore })
      .toString(),
  };
}

async function getManualBlockRows(query: Queryable, range: InstantWindow) {
  await ensureManualBlocksSchema();
  return query`
    SELECT starts_at, ends_at, service_category, buffer_minutes
    FROM manual_calendar_blocks
    WHERE cancelled_at IS NULL
      AND starts_at < ${range.end}::timestamptz + interval '3 hours'
      AND ends_at > ${range.start}::timestamptz - interval '3 hours'
  `;
}

async function getOpenAndBlockedWindows(
  query: Queryable,
  date: string,
  settings: BookingSettings,
): Promise<{ open: LocalTimeWindow[]; blocked: InstantWindow[] }> {
  const day = Temporal.PlainDate.from(date);
  const rules = await query`
    SELECT start_time::text AS start_time, end_time::text AS end_time
    FROM availability_rules
    WHERE active = true
      AND weekday = ${day.dayOfWeek}
      AND (valid_from IS NULL OR valid_from <= ${date}::date)
      AND (valid_until IS NULL OR valid_until >= ${date}::date)
    ORDER BY start_time
  `;
  const exceptions = await query`
    SELECT kind, start_time::text AS start_time, end_time::text AS end_time
    FROM availability_exceptions
    WHERE day = ${date}::date
    ORDER BY start_time NULLS FIRST
  `;

  const open: LocalTimeWindow[] = rules.map((row: any) => ({
    start: shortTime(row.start_time),
    end: shortTime(row.end_time),
  }));
  const blocked: InstantWindow[] = [];

  for (const exception of exceptions) {
    if (exception.kind === 'open' && exception.start_time && exception.end_time) {
      open.push({
        start: shortTime(exception.start_time),
        end: shortTime(exception.end_time),
      });
      continue;
    }

    if (exception.kind === 'blocked') {
      blocked.push(
        exception.start_time && exception.end_time
          ? localTimeWindowInstantRange(date, settings.timeZone, {
              start: shortTime(exception.start_time),
              end: shortTime(exception.end_time),
            })
          : localDayInstantRange(date, settings.timeZone),
      );
    }
  }

  const manual = manualBlockWindows(await getManualBlockRows(
    query, localDayInstantRange(date, settings.timeZone),
  ));
  blocked.push(...manual.blocked);

  return { open, blocked };
}

async function getBusyWindows(
  query: Queryable,
  date: string,
  settings: BookingSettings,
  category: BookingCategory,
): Promise<InstantWindow[]> {
  await ensureGoogleCalendarSchema();
  const range = localDayInstantRange(date, settings.timeZone);
  const bookingRange = expandedBookingQueryRange(range, settings);
  const rows = await query`
    SELECT starts_at, ends_at, service_category
    FROM bookings
    WHERE status = 'confirmed'
      AND starts_at < ${bookingRange.end}::timestamptz
      AND ends_at > ${bookingRange.start}::timestamptz
    UNION ALL
    SELECT starts_at, ends_at, NULL::text AS service_category
    FROM google_calendar_busy
    WHERE starts_at < ${range.end}::timestamptz
      AND ends_at > ${range.start}::timestamptz
  `;

  const manual = manualBlockWindows(await getManualBlockRows(query, range), category);
  return [...rows.map((row: any) => busyWindowFromRow(row, settings)), ...manual.busy];
}

async function getSlotChoicesWithQuery(input: {
  query: Queryable;
  date: string;
  category: BookingCategory;
  durationMinutes: number;
  settings?: BookingSettings;
  now?: string;
}): Promise<{ available: AvailableSlot[]; unavailable: AvailableSlot[] }> {
  const settings = input.settings ?? (await getBookingSettings(input.query));
  const minimumStart = bookingMinimumStart({
    date: input.date,
    category: input.category,
    now: input.now ?? Temporal.Now.instant(),
    settings,
  });
  if (!minimumStart) return { available: [], unavailable: [] };
  const { open, blocked } = await getOpenAndBlockedWindows(
    input.query,
    input.date,
    settings,
  );
  const busy = await getBusyWindows(input.query, input.date, settings, input.category);
  const isHome = input.category === 'home';

  const candidateInput = {
    date: input.date,
    timeZone: settings.timeZone,
    openWindows: open,
    durationMinutes: input.durationMinutes,
    bufferBeforeMinutes: isHome
      ? settings.homeBufferBeforeMinutes
      : settings.studioBufferBeforeMinutes,
    bufferAfterMinutes: isHome
      ? settings.homeBufferAfterMinutes
      : settings.studioBufferAfterMinutes,
    stepMinutes: settings.slotIntervalMinutes,
    minStart: minimumStart,
  };
  const available = buildAvailableSlots({
    ...candidateInput,
    blockedWindows: blocked,
    busyWindows: busy,
  });
  const availableStarts = new Set(available.map((slot) => slot.start));
  const unavailable = buildAvailableSlots({
    ...candidateInput,
    blockedWindows: [],
    busyWindows: [],
  }).filter((slot) => !availableStarts.has(slot.start));
  return { available, unavailable };
}

async function getAvailableSlotsWithQuery(input: Parameters<typeof getSlotChoicesWithQuery>[0]): Promise<AvailableSlot[]> {
  return (await getSlotChoicesWithQuery(input)).available;
}

export async function getAvailableSlots(input: {
  date: string;
  category: BookingCategory;
  durationMinutes: number;
  now?: string;
}): Promise<AvailableSlot[]> {
  return getAvailableSlotsWithQuery({
    query: getDatabase(),
    ...input,
  });
}

export async function getDaySlotChoices(input: {
  date: string;
  category: BookingCategory;
  durationMinutes: number;
  now?: string;
}): Promise<{ available: AvailableSlot[]; unavailable: AvailableSlot[] }> {
  return getSlotChoicesWithQuery({ query: getDatabase(), ...input });
}

export async function getAvailableDates(input: {
  from: string;
  to: string;
  category: BookingCategory;
  durationMinutes: number;
  now?: string;
}): Promise<{
  dates: string[];
  today: string;
  lastDay: string;
  timeZone: string;
}> {
  await Promise.all([ensureGoogleCalendarSchema(), ensureManualBlocksSchema()]);
  const query = getDatabase();
  const settings = await getBookingSettings(query);
  const now = Temporal.Instant.from(
    input.now ?? Temporal.Now.instant().toString(),
  );
  const today = now.toZonedDateTimeISO(settings.timeZone).toPlainDate();
  const bookingLastDay = today.add({ days: settings.bookingHorizonDays });
  const requestedFirstDay = Temporal.PlainDate.from(input.from);
  const requestedLastDay = Temporal.PlainDate.from(input.to);
  const firstDay = Temporal.PlainDate.compare(requestedFirstDay, today) < 0
    ? today
    : requestedFirstDay;
  const lastDay = Temporal.PlainDate.compare(requestedLastDay, bookingLastDay) > 0
    ? bookingLastDay
    : requestedLastDay;

  if (Temporal.PlainDate.compare(firstDay, lastDay) > 0) {
    return {
      dates: [],
      today: today.toString(),
      lastDay: bookingLastDay.toString(),
      timeZone: settings.timeZone,
    };
  }

  const firstDate = firstDay.toString();
  const lastDate = lastDay.toString();
  const rangeStart = localDayInstantRange(firstDate, settings.timeZone).start;
  const rangeEnd = localDayInstantRange(lastDate, settings.timeZone).end;
  const bookingRange = expandedBookingQueryRange(
    { start: rangeStart, end: rangeEnd },
    settings,
  );
  const [rules, exceptions, busyRows, manualRows] = await Promise.all([
    query`
      SELECT weekday, start_time::text AS start_time, end_time::text AS end_time,
        valid_from::text AS valid_from, valid_until::text AS valid_until
      FROM availability_rules
      WHERE active = true
        AND (valid_from IS NULL OR valid_from <= ${lastDate}::date)
        AND (valid_until IS NULL OR valid_until >= ${firstDate}::date)
      ORDER BY weekday, start_time
    `,
    query`
      SELECT day::text AS day, kind,
        start_time::text AS start_time, end_time::text AS end_time
      FROM availability_exceptions
      WHERE day BETWEEN ${firstDate}::date AND ${lastDate}::date
      ORDER BY day, start_time NULLS FIRST
    `,
    query`
      SELECT starts_at, ends_at, service_category
      FROM bookings
      WHERE status = 'confirmed'
        AND starts_at < ${bookingRange.end}::timestamptz
        AND ends_at > ${bookingRange.start}::timestamptz
      UNION ALL
      SELECT starts_at, ends_at, NULL::text AS service_category
      FROM google_calendar_busy
      WHERE starts_at < ${rangeEnd}::timestamptz
        AND ends_at > ${rangeStart}::timestamptz
    `,
    getManualBlockRows(query, { start: rangeStart, end: rangeEnd }),
  ]);

  const exceptionsByDay = new Map<string, any[]>();
  for (const exception of exceptions) {
    const day = String(exception.day);
    const current = exceptionsByDay.get(day) ?? [];
    current.push(exception);
    exceptionsByDay.set(day, current);
  }

  const manual = manualBlockWindows(manualRows, input.category);
  const busyWindows: InstantWindow[] = [
    ...busyRows.map((row: any) => busyWindowFromRow(row, settings)),
    ...manual.busy,
  ];
  const dates: string[] = [];

  for (
    let day = firstDay;
    Temporal.PlainDate.compare(day, lastDay) <= 0;
    day = day.add({ days: 1 })
  ) {
    const date = day.toString();
    const minimumStart = bookingMinimumStart({
      date,
      category: input.category,
      now,
      settings,
    });
    if (!minimumStart) continue;
    const open: LocalTimeWindow[] = rules
      .filter(
        (rule: any) =>
          numberValue(rule.weekday) === day.dayOfWeek &&
          (!rule.valid_from || String(rule.valid_from) <= date) &&
          (!rule.valid_until || String(rule.valid_until) >= date),
      )
      .map((rule: any) => ({
        start: shortTime(rule.start_time),
        end: shortTime(rule.end_time),
      }));
    const blocked: InstantWindow[] = [...manual.blocked];

    for (const exception of exceptionsByDay.get(date) ?? []) {
      if (exception.kind === 'open' && exception.start_time && exception.end_time) {
        open.push({
          start: shortTime(exception.start_time),
          end: shortTime(exception.end_time),
        });
      } else if (exception.kind === 'blocked') {
        blocked.push(
          exception.start_time && exception.end_time
            ? localTimeWindowInstantRange(date, settings.timeZone, {
                start: shortTime(exception.start_time),
                end: shortTime(exception.end_time),
              })
            : localDayInstantRange(date, settings.timeZone),
        );
      }
    }

    const isHome = input.category === 'home';
    const slots = buildAvailableSlots({
      date,
      timeZone: settings.timeZone,
      openWindows: open,
      blockedWindows: blocked,
      busyWindows,
      durationMinutes: input.durationMinutes,
      bufferBeforeMinutes: isHome
        ? settings.homeBufferBeforeMinutes
        : settings.studioBufferBeforeMinutes,
      bufferAfterMinutes: isHome
        ? settings.homeBufferAfterMinutes
        : settings.studioBufferAfterMinutes,
      stepMinutes: settings.slotIntervalMinutes,
      minStart: minimumStart,
    });

    if (slots.length > 0) dates.push(date);
  }

  return {
    dates,
    today: today.toString(),
    lastDay: bookingLastDay.toString(),
    timeZone: settings.timeZone,
  };
}

export async function getNextAvailableSlot(input: {
  candidates: Array<{
    category: BookingCategory;
    durationMinutes: number;
  }>;
  now?: string;
}): Promise<{
  date: string;
  start: string;
  timeZone: string;
  category: BookingCategory;
} | null> {
  await Promise.all([ensureGoogleCalendarSchema(), ensureManualBlocksSchema()]);
  const query = getDatabase();
  const settings = await getBookingSettings(query);
  const now = Temporal.Instant.from(
    input.now ?? Temporal.Now.instant().toString(),
  );
  const today = now.toZonedDateTimeISO(settings.timeZone).toPlainDate();
  const lastDay = today.add({ days: settings.bookingHorizonDays });
  const firstDate = today.toString();
  const lastDate = lastDay.toString();
  const rangeStart = localDayInstantRange(firstDate, settings.timeZone).start;
  const rangeEnd = localDayInstantRange(lastDate, settings.timeZone).end;
  const bookingRange = expandedBookingQueryRange(
    { start: rangeStart, end: rangeEnd },
    settings,
  );

  const [rules, exceptions, busyRows, manualRows] = await Promise.all([
    query`
      SELECT weekday, start_time::text AS start_time, end_time::text AS end_time,
        valid_from::text AS valid_from, valid_until::text AS valid_until
      FROM availability_rules
      WHERE active = true
        AND (valid_from IS NULL OR valid_from <= ${lastDate}::date)
        AND (valid_until IS NULL OR valid_until >= ${firstDate}::date)
      ORDER BY weekday, start_time
    `,
    query`
      SELECT day::text AS day, kind,
        start_time::text AS start_time, end_time::text AS end_time
      FROM availability_exceptions
      WHERE day BETWEEN ${firstDate}::date AND ${lastDate}::date
      ORDER BY day, start_time NULLS FIRST
    `,
    query`
      SELECT starts_at, ends_at, service_category
      FROM bookings
      WHERE status = 'confirmed'
        AND starts_at < ${bookingRange.end}::timestamptz
        AND ends_at > ${bookingRange.start}::timestamptz
      UNION ALL
      SELECT starts_at, ends_at, NULL::text AS service_category
      FROM google_calendar_busy
      WHERE starts_at < ${rangeEnd}::timestamptz
        AND ends_at > ${rangeStart}::timestamptz
    `,
    getManualBlockRows(query, { start: rangeStart, end: rangeEnd }),
  ]);

  const exceptionsByDay = new Map<string, any[]>();
  for (const exception of exceptions) {
    const day = String(exception.day);
    const current = exceptionsByDay.get(day) ?? [];
    current.push(exception);
    exceptionsByDay.set(day, current);
  }

  const manual = manualBlockWindows(manualRows);
  const busyWindows: InstantWindow[] = [
    ...busyRows.map((row: any) => busyWindowFromRow(row, settings)),
  ];
  const manualBusyByCategory = {
    studio: manual.busy,
    home: manualBlockWindows(manualRows, 'home').busy,
  };
  for (let offset = 0; offset <= settings.bookingHorizonDays; offset += 1) {
    const day = today.add({ days: offset });
    const date = day.toString();
    const open: LocalTimeWindow[] = rules
      .filter(
        (rule: any) =>
          numberValue(rule.weekday) === day.dayOfWeek &&
          (!rule.valid_from || String(rule.valid_from) <= date) &&
          (!rule.valid_until || String(rule.valid_until) >= date),
      )
      .map((rule: any) => ({
        start: shortTime(rule.start_time),
        end: shortTime(rule.end_time),
      }));
    const blocked: InstantWindow[] = [...manual.blocked];

    for (const exception of exceptionsByDay.get(date) ?? []) {
      if (exception.kind === 'open' && exception.start_time && exception.end_time) {
        open.push({
          start: shortTime(exception.start_time),
          end: shortTime(exception.end_time),
        });
      } else if (exception.kind === 'blocked') {
        blocked.push(
          exception.start_time && exception.end_time
            ? localTimeWindowInstantRange(date, settings.timeZone, {
                start: shortTime(exception.start_time),
                end: shortTime(exception.end_time),
              })
            : localDayInstantRange(date, settings.timeZone),
        );
      }
    }

    const available = input.candidates.flatMap((candidate) => {
      const minimumStart = bookingMinimumStart({
        date,
        category: candidate.category,
        now,
        settings,
      });
      if (!minimumStart) return [];
      const isHome = candidate.category === 'home';
      const [slot] = buildAvailableSlots({
        date,
        timeZone: settings.timeZone,
        openWindows: open,
        blockedWindows: blocked,
        busyWindows: [...busyWindows, ...manualBusyByCategory[candidate.category]],
        durationMinutes: candidate.durationMinutes,
        bufferBeforeMinutes: isHome
          ? settings.homeBufferBeforeMinutes
          : settings.studioBufferBeforeMinutes,
        bufferAfterMinutes: isHome
          ? settings.homeBufferAfterMinutes
          : settings.studioBufferAfterMinutes,
        stepMinutes: settings.slotIntervalMinutes,
        minStart: minimumStart,
      });

      return slot ? [{ ...slot, category: candidate.category }] : [];
    });
    available.sort(
      (a, b) =>
        Temporal.Instant.from(a.start).epochMilliseconds -
        Temporal.Instant.from(b.start).epochMilliseconds,
    );

    if (available[0]) {
      return {
        date,
        start: available[0].start,
        timeZone: settings.timeZone,
        category: available[0].category,
      };
    }
  }

  return null;
}

function referenceFor(start: string, timeZone: string): string {
  const localDate = Temporal.Instant.from(start)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString()
    .replaceAll('-', '');
  return `RB-${localDate}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function createConfirmedBooking(
  input: ConfirmedBookingInput,
): Promise<{ id: string; reference: string; start: string; end: string }> {
  await ensureBookingEmailDeliverySchema();
  await ensureManualBlocksSchema();
  const database = getDatabase();

  try {
    return await database.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(734052024)`;
      const settings = await getBookingSettings(transaction);
      const requested = Temporal.Instant.from(input.start);
      const localDate = requested
        .toZonedDateTimeISO(settings.timeZone)
        .toPlainDate()
        .toString();
      const slots = await getAvailableSlotsWithQuery({
        query: transaction,
        date: localDate,
        category: input.option.category,
        durationMinutes: input.option.reservedMinutes ?? input.option.minutes,
        settings,
      });
      const selected = slots.find(
        (slot) =>
          Temporal.Instant.from(slot.start).epochMilliseconds ===
          requested.epochMilliseconds,
      );

      if (!selected) throw new SlotUnavailableError();

      const id = randomUUID();
      const reference = referenceFor(selected.start, settings.timeZone);
      const customerEmailDeliveryId = randomUUID();
      const ownerEmailDeliveryId = randomUUID();
      await transaction`
        INSERT INTO bookings (
          id, reference, service_key, service_category, service_title,
          duration_minutes, price_eur, customer_name, customer_email,
          customer_phone, home_address, home_postal_code, notes, service_details, locale, starts_at, ends_at,
          busy_starts_at, busy_ends_at, status
        ) VALUES (
          ${id}, ${reference}, ${input.option.key}, ${input.option.category},
          ${input.option.title}, ${input.option.minutes}, ${input.option.priceEur},
          ${input.customerName}, ${input.customerEmail.toLowerCase()},
          ${input.customerPhone}, ${input.homeAddress || null}, ${input.homePostalCode || null}, ${input.notes || null},
          ${input.serviceDetails ? JSON.stringify(input.serviceDetails) : null}::jsonb,
          ${input.locale}, ${selected.start}::timestamptz, ${selected.end}::timestamptz,
          ${selected.busyStart}::timestamptz, ${selected.busyEnd}::timestamptz,
          'confirmed'
        )
      `;

      await transaction`
        INSERT INTO booking_email_deliveries (id, booking_id, kind)
        VALUES
          (${customerEmailDeliveryId}, ${id}, 'customer_confirmation'),
          (${ownerEmailDeliveryId}, ${id}, 'owner_notification')
      `;

      return { id, reference, start: selected.start, end: selected.end };
    });
  } catch (error: any) {
    if (error instanceof SlotUnavailableError || error?.code === '23P01') {
      throw new SlotUnavailableError();
    }
    throw error;
  }
}

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const database = getDatabase();
  const [row] = await database`
    INSERT INTO rate_limits (key, attempts, window_started_at)
    VALUES (${input.key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN rate_limits.window_started_at < now() - (${input.windowSeconds} * interval '1 second')
          THEN 1
        ELSE rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN rate_limits.window_started_at < now() - (${input.windowSeconds} * interval '1 second')
          THEN now()
        ELSE rate_limits.window_started_at
      END
    RETURNING attempts
  `;
  return numberValue(row.attempts) <= input.limit;
}

export async function listAvailabilityRules() {
  return getDatabase()`
    SELECT id, weekday, start_time::text AS start_time,
      end_time::text AS end_time, valid_from, valid_until, active
    FROM availability_rules
    ORDER BY weekday, start_time
  `;
}

export async function listAvailabilityExceptions(from: string, to: string) {
  return getDatabase()`
    SELECT id, day, kind, start_time::text AS start_time,
      end_time::text AS end_time, reason
    FROM availability_exceptions
    WHERE day BETWEEN ${from}::date AND ${to}::date
    ORDER BY day, start_time NULLS FIRST
  `;
}

export async function listBookings(from: string, to: string) {
  await ensureBookingEmailDeliverySchema();
  return getDatabase()`
    SELECT booking.id, booking.reference, booking.service_title,
      booking.service_category, booking.duration_minutes, booking.price_eur,
      booking.customer_name, booking.customer_email, booking.customer_phone,
      booking.home_address, booking.home_postal_code, booking.notes, booking.locale, booking.starts_at,
      booking.ends_at, booking.status, booking.created_at,
      customer_delivery.status AS customer_email_status,
      owner_delivery.status AS owner_email_status,
      cancellation_delivery.status AS cancellation_email_status
    FROM bookings AS booking
    LEFT JOIN booking_email_deliveries AS customer_delivery
      ON customer_delivery.booking_id = booking.id
      AND customer_delivery.kind = 'customer_confirmation'
    LEFT JOIN booking_email_deliveries AS owner_delivery
      ON owner_delivery.booking_id = booking.id
      AND owner_delivery.kind = 'owner_notification'
    LEFT JOIN booking_email_deliveries AS cancellation_delivery
      ON cancellation_delivery.booking_id = booking.id
      AND cancellation_delivery.kind = 'customer_cancellation'
    WHERE booking.starts_at >= ${from}::timestamptz
      AND booking.starts_at < ${to}::timestamptz
    ORDER BY booking.starts_at
  `;
}

export async function listManualCalendarBlocks(from: string, to: string) {
  await ensureManualBlocksSchema();
  return getDatabase()`
    SELECT id, service_category, starts_at, ends_at, occupied_starts_at,
      occupied_ends_at, duration_minutes, buffer_minutes, guest_name, note
    FROM manual_calendar_blocks
    WHERE cancelled_at IS NULL
      AND starts_at < ${to}::timestamptz
      AND ends_at > ${from}::timestamptz
    ORDER BY starts_at
  `;
}

export async function addManualCalendarBlock(input: {
  day: string;
  startTime: string;
  durationMinutes: number;
  category: BookingCategory;
  guestName?: string;
  note?: string;
  applyStandardBuffer: boolean;
  now?: string;
}): Promise<string> {
  await ensureManualBlocksSchema();
  try {
    return await getDatabase().begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(734052024)`;
      const settings = await getBookingSettings(transaction);
      const day = Temporal.PlainDate.from(input.day);
      const time = Temporal.PlainTime.from(input.startTime);
      if (
        !['studio', 'home'].includes(input.category) ||
        !Number.isInteger(input.durationMinutes) ||
        input.durationMinutes < 15 || input.durationMinutes > 240 ||
        input.durationMinutes % settings.slotIntervalMinutes !== 0 ||
        time.minute % settings.slotIntervalMinutes !== 0 ||
        time.second !== 0
      ) throw new Error('A kezdés és az időtartam a foglalási időközhöz igazodjon.');

      const start = day.toZonedDateTime({ timeZone: settings.timeZone, plainTime: time }).toInstant();
      const now = Temporal.Instant.from(input.now ?? Temporal.Now.instant().toString());
      if (Temporal.Instant.compare(start, now) <= 0) throw new Error('Múltbeli időpont nem rögzíthető.');
      const selected = input.applyStandardBuffer
        ? (await getAvailableSlotsWithQuery({
          query: transaction,
          date: input.day,
          category: input.category,
          durationMinutes: input.durationMinutes,
          settings,
          now: now.toString(),
        })).find((slot) => Temporal.Instant.compare(Temporal.Instant.from(slot.start), start) === 0)
        : null;
      if (input.applyStandardBuffer && !selected) throw new ManualBlockConflictError();
      if (input.applyStandardBuffer && input.category === 'studio') {
        const earliestHomeEnd = start.subtract({ minutes: homeToManualStudioBufferMinutes });
        const [precedingHome] = await transaction`
          SELECT 1 FROM (
            SELECT ends_at FROM bookings
            WHERE status = 'confirmed' AND service_category = 'home'
            UNION ALL
            SELECT ends_at FROM manual_calendar_blocks
            WHERE cancelled_at IS NULL AND service_category = 'home' AND buffer_minutes > 0
          ) AS home_appointments
          WHERE ends_at > ${earliestHomeEnd.toString()}::timestamptz
            AND ends_at <= ${start.toString()}::timestamptz
          LIMIT 1
        `;
        if (precedingHome) throw new ManualBlockConflictError();
      }
      const end = selected
        ? Temporal.Instant.from(selected.end)
        : start.add({ minutes: input.durationMinutes });
      const bufferMinutes = input.applyStandardBuffer
        ? input.category === 'home' ? settings.homeBufferBeforeMinutes : settings.studioBufferBeforeMinutes
        : 0;
      const occupiedStart = selected ? Temporal.Instant.from(selected.busyStart) : start;
      const occupiedEnd = selected ? Temporal.Instant.from(selected.busyEnd) : end;
      if (!input.applyStandardBuffer) {
        const [bookingConflict] = await transaction`
          SELECT 1 FROM bookings
          WHERE status = 'confirmed'
            AND starts_at < ${end.toString()}::timestamptz
            AND ends_at > ${start.toString()}::timestamptz
          LIMIT 1
        `;
        const [googleConflict] = await transaction`
          SELECT 1 FROM google_calendar_busy
          WHERE starts_at < ${end.toString()}::timestamptz
            AND ends_at > ${start.toString()}::timestamptz
          LIMIT 1
        `;
        const [manualConflict] = await transaction`
          SELECT 1 FROM manual_calendar_blocks
          WHERE cancelled_at IS NULL
            AND starts_at < ${end.toString()}::timestamptz
            AND ends_at > ${start.toString()}::timestamptz
          LIMIT 1
        `;
        if (bookingConflict || googleConflict || manualConflict) throw new ManualBlockConflictError();
      }

      const id = randomUUID();
      await transaction`
        INSERT INTO manual_calendar_blocks (
          id, service_category, starts_at, ends_at, occupied_starts_at,
          occupied_ends_at, duration_minutes, buffer_minutes, guest_name, note
        ) VALUES (
          ${id}, ${input.category}, ${start.toString()}::timestamptz,
          ${end.toString()}::timestamptz, ${occupiedStart.toString()}::timestamptz,
          ${occupiedEnd.toString()}::timestamptz, ${input.durationMinutes},
          ${bufferMinutes}, ${input.guestName?.trim() || null}, ${input.note?.trim() || null}
        )
      `;
      return id;
    });
  } catch (error: any) {
    if (error instanceof ManualBlockConflictError || error?.code === '23P01') {
      throw new ManualBlockConflictError();
    }
    throw error;
  }
}

export async function cancelManualCalendarBlock(id: string): Promise<boolean> {
  await ensureManualBlocksSchema();
  const [row] = await getDatabase()`
    UPDATE manual_calendar_blocks SET cancelled_at = now()
    WHERE id = ${id}::uuid AND cancelled_at IS NULL
    RETURNING id
  `;
  return Boolean(row);
}

export async function addAvailabilityRule(input: {
  weekday: number;
  startTime: string;
  endTime: string;
}) {
  const id = randomUUID();
  await getDatabase()`
    INSERT INTO availability_rules (id, weekday, start_time, end_time)
    VALUES (${id}, ${input.weekday}, ${input.startTime}::time, ${input.endTime}::time)
  `;
  return id;
}

export async function deleteAvailabilityRule(id: string) {
  await getDatabase()`DELETE FROM availability_rules WHERE id = ${id}`;
}

export async function addAvailabilityException(input: {
  day: string;
  kind: 'open' | 'blocked';
  startTime?: string;
  endTime?: string;
  reason?: string;
}) {
  const id = randomUUID();
  await getDatabase()`
    INSERT INTO availability_exceptions (
      id, day, kind, start_time, end_time, reason
    ) VALUES (
      ${id}, ${input.day}::date, ${input.kind},
      ${input.startTime || null}::time, ${input.endTime || null}::time,
      ${input.reason || null}
    )
  `;
  return id;
}

export async function deleteAvailabilityException(id: string) {
  await getDatabase()`DELETE FROM availability_exceptions WHERE id = ${id}`;
}

export async function cancelBooking(id: string): Promise<boolean> {
  await ensureBookingEmailDeliverySchema();
  return getDatabase().begin(async (transaction) => {
    const [cancelled] = await transaction`
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = now()
      WHERE id = ${id} AND status = 'confirmed'
      RETURNING id
    `;
    if (!cancelled) return false;

    await transaction`
      UPDATE booking_email_deliveries
      SET status = 'suppressed', claimed_at = NULL, updated_at = now()
      WHERE booking_id = ${id}
        AND kind IN ('customer_confirmation', 'owner_notification')
        AND status IN ('pending', 'failed', 'sending')
    `;
    await transaction`
      INSERT INTO booking_email_deliveries (id, booking_id, kind)
      VALUES (${randomUUID()}, ${id}, 'customer_cancellation')
      ON CONFLICT (booking_id, kind) DO NOTHING
    `;
    return true;
  });
}
