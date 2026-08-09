import { getDatabase } from './db';

let schemaPromise: Promise<void> | undefined;

async function createBookingEmailDeliverySchema(): Promise<void> {
  const database = getDatabase();
  await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(734052025)`;
    await transaction`
      CREATE TABLE IF NOT EXISTS booking_email_deliveries (
        id uuid PRIMARY KEY,
        booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('customer_confirmation', 'owner_notification')),
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
        attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        claimed_at timestamptz,
        provider_message_id text,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        UNIQUE (booking_id, kind)
      )
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS booking_email_deliveries_pending_idx
      ON booking_email_deliveries (next_attempt_at, created_at)
      WHERE status IN ('pending', 'sending', 'failed')
    `;
  });
}

export function ensureBookingEmailDeliverySchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createBookingEmailDeliverySchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
