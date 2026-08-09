import { randomBytes, randomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import {
  buildAvailableSlots,
  localDayInstantRange,
  localTimeWindowInstantRange,
} from '../booking/availability';
import type {
  AvailableSlot,
  BookingCategory,
  BookingLocale,
  BookingOption,
  BookingSettings,
  InstantWindow,
  LocalTimeWindow,
} from '../booking/types';
import { ensureBookingEmailDeliverySchema } from './booking-email-schema';
import { getDatabase } from './db';

type Queryable = any;

export class SlotUnavailableError extends Error {
  constructor() {
    super('The selected appointment is no longer available.');
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
  notes?: string;
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
      booking_horizon_days,
      studio_buffer_before_minutes,
      studio_buffer_after_minutes,
      home_buffer_before_minutes,
      home_buffer_after_minutes
    FROM booking_settings
    WHERE id = 1
  `;

  if (!row) throw new Error('Booking settings are missing. Run the database migration.');

  return {
    timeZone: String(row.time_zone),
    slotIntervalMinutes: numberValue(row.slot_interval_minutes),
    minNoticeHours: numberValue(row.min_notice_hours),
    bookingHorizonDays: numberValue(row.booking_horizon_days),
    studioBufferBeforeMinutes: numberValue(row.studio_buffer_before_minutes),
    studioBufferAfterMinutes: numberValue(row.studio_buffer_after_minutes),
    homeBufferBeforeMinutes: numberValue(row.home_buffer_before_minutes),
    homeBufferAfterMinutes: numberValue(row.home_buffer_after_minutes),
  };
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

  return { open, blocked };
}

async function getBusyWindows(
  query: Queryable,
  date: string,
  settings: BookingSettings,
): Promise<InstantWindow[]> {
  const range = localDayInstantRange(date, settings.timeZone);
  const rows = await query`
    SELECT busy_starts_at, busy_ends_at
    FROM bookings
    WHERE status = 'confirmed'
      AND busy_starts_at < ${range.end}::timestamptz
      AND busy_ends_at > ${range.start}::timestamptz
  `;

  return rows.map((row: any) => ({
    start: new Date(row.busy_starts_at).toISOString(),
    end: new Date(row.busy_ends_at).toISOString(),
  }));
}

async function getAvailableSlotsWithQuery(input: {
  query: Queryable;
  date: string;
  category: BookingCategory;
  durationMinutes: number;
  settings?: BookingSettings;
  now?: string;
}): Promise<AvailableSlot[]> {
  const settings = input.settings ?? (await getBookingSettings(input.query));
  const { open, blocked } = await getOpenAndBlockedWindows(
    input.query,
    input.date,
    settings,
  );
  const busy = await getBusyWindows(input.query, input.date, settings);
  const minimumStart = Temporal.Instant.from(
    input.now ?? Temporal.Now.instant().toString(),
  )
    .add({ hours: settings.minNoticeHours })
    .toString();
  const isHome = input.category === 'home';

  return buildAvailableSlots({
    date: input.date,
    timeZone: settings.timeZone,
    openWindows: open,
    blockedWindows: blocked,
    busyWindows: busy,
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
        durationMinutes: input.option.minutes,
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
          customer_phone, home_address, notes, locale, starts_at, ends_at,
          busy_starts_at, busy_ends_at, status
        ) VALUES (
          ${id}, ${reference}, ${input.option.key}, ${input.option.category},
          ${input.option.title}, ${input.option.minutes}, ${input.option.priceEur},
          ${input.customerName}, ${input.customerEmail.toLowerCase()},
          ${input.customerPhone}, ${input.homeAddress || null}, ${input.notes || null},
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
      booking.home_address, booking.notes, booking.locale, booking.starts_at,
      booking.ends_at, booking.status, booking.created_at,
      customer_delivery.status AS customer_email_status,
      owner_delivery.status AS owner_email_status
    FROM bookings AS booking
    LEFT JOIN booking_email_deliveries AS customer_delivery
      ON customer_delivery.booking_id = booking.id
      AND customer_delivery.kind = 'customer_confirmation'
    LEFT JOIN booking_email_deliveries AS owner_delivery
      ON owner_delivery.booking_id = booking.id
      AND owner_delivery.kind = 'owner_notification'
    WHERE booking.starts_at >= ${from}::timestamptz
      AND booking.starts_at < ${to}::timestamptz
    ORDER BY booking.starts_at
  `;
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

export async function cancelBooking(id: string) {
  await getDatabase()`
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = ${id} AND status = 'confirmed'
  `;
}
