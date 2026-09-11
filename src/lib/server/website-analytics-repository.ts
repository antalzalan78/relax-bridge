import { Temporal } from '@js-temporal/polyfill';
import {
  summarizeWebsiteTraffic,
  type TrafficAggregateRow,
  type TrafficLocale,
  type TrafficSummary,
} from '../analytics/model';
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
