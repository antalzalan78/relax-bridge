import { Temporal } from '@js-temporal/polyfill';
import {
  summarizeWebsiteTraffic,
  type TrafficAggregateRow,
  type TrafficLocale,
  type TrafficSummary,
} from '../analytics/model';
import {
  summarizeJourneySessions,
  type JourneyEventType,
  type JourneySessionRow,
  type JourneySummary,
} from '../analytics/journey';
import { getDatabase } from './db';
import { ensureWebsiteAnalyticsSchema } from './website-analytics-schema';

const timeZone = process.env.BOOKING_TIME_ZONE || 'Europe/Amsterdam';

async function deleteExpiredTraffic(): Promise<void> {
  await getDatabase()`
    DELETE FROM website_traffic_daily
    WHERE day < (timezone(${timeZone}, now())::date - interval '13 months')
  `;
}

export async function recordWebsiteVisit(input: {
  source: string;
  countryCode: string;
  entryPath: string;
  locale: TrafficLocale;
}): Promise<void> {
  await ensureWebsiteAnalyticsSchema();
  const database = getDatabase();
  await database.begin(async (transaction) => {
    await transaction`
      DELETE FROM website_traffic_daily
      WHERE day < (timezone(${timeZone}, now())::date - interval '13 months')
    `;
    await transaction`
      INSERT INTO website_traffic_daily (
        day, source, country_code, entry_path, locale, visits, updated_at
      )
      VALUES (
        timezone(${timeZone}, now())::date,
        ${input.source},
        ${input.countryCode},
        ${input.entryPath},
        ${input.locale},
        1,
        now()
      )
      ON CONFLICT (day, source, country_code, entry_path, locale)
      DO UPDATE SET
        visits = website_traffic_daily.visits + 1,
        updated_at = now()
    `;
  });
}

export async function getWebsiteTrafficSummary(): Promise<TrafficSummary> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredTraffic();
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  const start = today.subtract({ days: 29 }).toString();
  const rows = await getDatabase()<TrafficAggregateRow[]>`
    SELECT
      day::text AS day,
      source,
      country_code,
      entry_path,
      locale,
      visits
    FROM website_traffic_daily
    WHERE day BETWEEN ${start}::date AND ${today.toString()}::date
    ORDER BY day, source, country_code, entry_path, locale
  `;
  return summarizeWebsiteTraffic(rows, today.toString());
}

async function deleteExpiredJourneyEvents(): Promise<void> {
  await getDatabase()`
    DELETE FROM website_journey_events
    WHERE occurred_at < now() - interval '45 days'
  `;
}

export async function recordWebsiteJourneyEvent(input: {
  sessionId: string;
  eventType: Exclude<JourneyEventType, 'booking_success'>;
  pageKey: string;
  source: string;
}): Promise<void> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredJourneyEvents();
  await getDatabase()`
    INSERT INTO website_journey_events (session_id, event_type, page_key, source)
    VALUES (${input.sessionId}::uuid, ${input.eventType}, ${input.pageKey}, ${input.source})
  `;
}

/** Called only after a booking is actually saved, never from a public tracking request. */
export async function recordBookingJourneySuccess(sessionId: string): Promise<void> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredJourneyEvents();
  await getDatabase()`
    INSERT INTO website_journey_events (session_id, event_type, page_key, source)
    VALUES (
      ${sessionId}::uuid,
      'booking_success',
      'booking',
      COALESCE((
        SELECT source FROM website_journey_events
        WHERE session_id = ${sessionId}::uuid
        ORDER BY occurred_at, id
        LIMIT 1
      ), 'direct')
    )
  `;
}

export async function getWebsiteJourneySummary(): Promise<JourneySummary> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredJourneyEvents();
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  const firstDay = today.subtract({ days: 29 });
  const from = firstDay.toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const to = today.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const rows = await getDatabase()<JourneySessionRow[]>`
    SELECT
      (array_agg(source ORDER BY occurred_at, id))[1] AS source,
      array_agg(page_key ORDER BY occurred_at, id) FILTER (WHERE event_type = 'page_view') AS pages,
      count(*) FILTER (WHERE event_type = 'page_view') AS page_views,
      count(*) FILTER (WHERE event_type = 'booking_click') AS booking_clicks,
      count(*) FILTER (WHERE event_type = 'booking_success') AS bookings
    FROM website_journey_events
    WHERE occurred_at >= ${from}::timestamptz
      AND occurred_at < ${to}::timestamptz
    GROUP BY session_id
  `;
  return summarizeJourneySessions(rows);
}

/** The authoritative booking count is independent of optional visitor tracking. */
export async function getConfirmedBookingCountLast30Days(): Promise<number> {
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  const from = today.subtract({ days: 29 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const to = today.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const rows = await getDatabase()<Array<{ count: number | string }>>`
    SELECT count(*) AS count
    FROM bookings
    WHERE status = 'confirmed'
      AND created_at >= ${from}::timestamptz
      AND created_at < ${to}::timestamptz
  `;
  return Number(rows[0]?.count ?? 0);
}
