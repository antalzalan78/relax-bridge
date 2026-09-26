import { getDatabase } from './db';

let schemaPromise: Promise<void> | undefined;

async function createWebsiteAnalyticsSchema(): Promise<void> {
  const database = getDatabase();
  await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(734052028)`;
    await transaction`
      CREATE TABLE IF NOT EXISTS website_traffic_daily (
        day date NOT NULL,
        source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 100),
        country_code text NOT NULL CHECK (country_code = '??' OR country_code ~ '^[A-Z]{2}$'),
        entry_path text NOT NULL CHECK (char_length(entry_path) BETWEEN 1 AND 180),
        locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
        visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (day, source, country_code, entry_path, locale)
      )
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS website_traffic_daily_day_idx
      ON website_traffic_daily (day DESC)
    `;
    await transaction`
      CREATE TABLE IF NOT EXISTS website_journey_events (
        id bigserial PRIMARY KEY,
        session_id uuid NOT NULL,
        event_type text NOT NULL CHECK (event_type IN ('page_view', 'booking_click', 'booking_success')),
        page_key text NOT NULL CHECK (char_length(page_key) BETWEEN 1 AND 60),
        source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 100),
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS website_journey_events_time_idx
      ON website_journey_events (occurred_at, session_id)
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS website_journey_events_session_idx
      ON website_journey_events (session_id, occurred_at)
    `;
  });
}

export function ensureWebsiteAnalyticsSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createWebsiteAnalyticsSchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
