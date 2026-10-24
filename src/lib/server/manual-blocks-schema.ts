import { getDatabase } from './db';
import { ensureGoogleCalendarSchema } from './google-calendar-schema';

let schemaPromise: Promise<void> | undefined;

async function createManualBlocksSchema(): Promise<void> {
  await ensureGoogleCalendarSchema();
  const database = getDatabase();
  await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(734052029)`;
    await transaction`
      CREATE TABLE IF NOT EXISTS manual_calendar_blocks (
        id uuid PRIMARY KEY,
        service_category text NOT NULL CHECK (service_category IN ('studio', 'home')),
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        occupied_starts_at timestamptz NOT NULL,
        occupied_ends_at timestamptz NOT NULL,
        duration_minutes smallint NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
        buffer_minutes smallint NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 180),
        guest_name text,
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        cancelled_at timestamptz,
        CHECK (starts_at < ends_at),
        CHECK (occupied_starts_at <= starts_at AND ends_at <= occupied_ends_at)
      )
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS manual_calendar_blocks_time_idx
      ON manual_calendar_blocks (starts_at, occupied_ends_at)
      WHERE cancelled_at IS NULL
    `;
    const [overlap] = await transaction`
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'manual_calendar_blocks'::regclass
        AND conname = 'manual_calendar_blocks_no_overlap'
    `;
    if (!overlap) await transaction`
      ALTER TABLE manual_calendar_blocks
      ADD CONSTRAINT manual_calendar_blocks_no_overlap
      EXCLUDE USING gist (tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&)
      WHERE (cancelled_at IS NULL)
    `;
    const [linkConstraint] = await transaction`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = 'google_calendar_event_links'::regclass
        AND conname = 'google_calendar_event_links_entity_type_check'
    `;
    if (!String(linkConstraint?.definition || '').includes('manual_block')) {
      await transaction`
        ALTER TABLE google_calendar_event_links
        DROP CONSTRAINT IF EXISTS google_calendar_event_links_entity_type_check
      `;
      await transaction`
        ALTER TABLE google_calendar_event_links
        ADD CONSTRAINT google_calendar_event_links_entity_type_check
        CHECK (entity_type IN ('booking', 'availability_rule', 'availability_exception', 'manual_block'))
      `;
    }
  });
}

export function ensureManualBlocksSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createManualBlocksSchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
