import { Temporal } from '@js-temporal/polyfill';
import type { Locale } from '../../data/site';
import type { CampaignAttribution } from '../analytics/attribution';
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
import { ensureBlogSchema } from './blog';
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

export async function recordWebsiteJourneyEvent(input: CampaignAttribution & {
  sessionId: string;
  eventType: Exclude<JourneyEventType, 'booking_success'>;
  pageKey: string;
  source: string;
  articleId?: string | null;
  articleLocale?: Locale | null;
}): Promise<void> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredJourneyEvents();
  await getDatabase()`
    INSERT INTO website_journey_events (
      session_id, event_type, page_key, source, utm_source, utm_medium, utm_campaign, utm_content,
      article_id, article_locale
    )
    VALUES (
      ${input.sessionId}::uuid, ${input.eventType}, ${input.pageKey}, ${input.source},
      ${input.utmSource}, ${input.utmMedium}, ${input.utmCampaign}, ${input.utmContent},
      ${input.articleId || null}, ${input.articleLocale || null}
    )
  `;
}

export interface BlogArticleTraffic {
  id: string;
  title: string;
  editorLocale: Locale;
  pageViews30: number;
  sessions30: number;
  pageViews7: number;
  locales: Record<Locale, number>;
}

/** Counts article page views, not visits to the blog index or topic pages. */
export async function getBlogArticleTrafficSummary(): Promise<BlogArticleTraffic[]> {
  await Promise.all([ensureBlogSchema(), ensureWebsiteAnalyticsSchema()]);
  await deleteExpiredJourneyEvents();
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  const from30 = today.subtract({ days: 29 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const from7 = today.subtract({ days: 6 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const to = today.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: '00:00' }).toInstant().toString();
  const rows = await getDatabase()<Array<{
    id: string; title: string; editor_locale: Locale;
    page_views_30: number; sessions_30: number; page_views_7: number;
    nl_views: number; en_views: number; hu_views: number;
  }>>`
    WITH article_views AS (
      SELECT article_id,
        count(*)::integer AS page_views_30,
        count(DISTINCT session_id)::integer AS sessions_30,
        count(*) FILTER (WHERE occurred_at >= ${from7}::timestamptz)::integer AS page_views_7,
        count(*) FILTER (WHERE article_locale = 'nl')::integer AS nl_views,
        count(*) FILTER (WHERE article_locale = 'en')::integer AS en_views,
        count(*) FILTER (WHERE article_locale = 'hu')::integer AS hu_views
      FROM website_journey_events
      WHERE event_type = 'page_view' AND article_id IS NOT NULL
        AND occurred_at >= ${from30}::timestamptz AND occurred_at < ${to}::timestamptz
      GROUP BY article_id
    )
    SELECT p.id,
      COALESCE(
        max(t.title) FILTER (WHERE t.locale = 'hu' AND t.title <> ''),
        max(t.title) FILTER (WHERE t.locale = 'nl' AND t.title <> ''),
        max(t.title) FILTER (WHERE t.locale = 'en' AND t.title <> ''), p.id
      ) AS title,
      CASE WHEN count(*) FILTER (WHERE t.locale = 'hu') > 0 THEN 'hu'
        WHEN count(*) FILTER (WHERE t.locale = 'nl') > 0 THEN 'nl' ELSE 'en' END AS editor_locale,
      COALESCE(v.page_views_30, 0)::integer AS page_views_30,
      COALESCE(v.sessions_30, 0)::integer AS sessions_30,
      COALESCE(v.page_views_7, 0)::integer AS page_views_7,
      COALESCE(v.nl_views, 0)::integer AS nl_views,
      COALESCE(v.en_views, 0)::integer AS en_views,
      COALESCE(v.hu_views, 0)::integer AS hu_views
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id AND t.deleted_at IS NULL
    LEFT JOIN article_views v ON v.article_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id, v.page_views_30, v.sessions_30, v.page_views_7, v.nl_views, v.en_views, v.hu_views
    ORDER BY page_views_30 DESC, title, p.id
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    editorLocale: row.editor_locale,
    pageViews30: Number(row.page_views_30),
    sessions30: Number(row.sessions_30),
    pageViews7: Number(row.page_views_7),
    locales: { nl: Number(row.nl_views), en: Number(row.en_views), hu: Number(row.hu_views) },
  }));
}

/** Called only after a booking is actually saved, never from a public tracking request. */
export async function recordBookingJourneySuccess(sessionId: string): Promise<void> {
  await ensureWebsiteAnalyticsSchema();
  await deleteExpiredJourneyEvents();
  await getDatabase()`
    INSERT INTO website_journey_events (
      session_id, event_type, page_key, source, utm_source, utm_medium, utm_campaign, utm_content
    )
    SELECT
      ${sessionId}::uuid,
      'booking_success',
      'booking',
      COALESCE(first_event.source, 'direct'),
      COALESCE(first_event.utm_source, ''),
      COALESCE(first_event.utm_medium, ''),
      COALESCE(first_event.utm_campaign, ''),
      COALESCE(first_event.utm_content, '')
    FROM (SELECT 1) AS fallback
    LEFT JOIN LATERAL (
      SELECT source, utm_source, utm_medium, utm_campaign, utm_content
      FROM website_journey_events
      WHERE session_id = ${sessionId}::uuid
      ORDER BY occurred_at, id
      LIMIT 1
    ) AS first_event ON true
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
      (array_agg(utm_source ORDER BY occurred_at, id))[1] AS utm_source,
      (array_agg(utm_medium ORDER BY occurred_at, id))[1] AS utm_medium,
      (array_agg(utm_campaign ORDER BY occurred_at, id))[1] AS utm_campaign,
      (array_agg(utm_content ORDER BY occurred_at, id))[1] AS utm_content,
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
