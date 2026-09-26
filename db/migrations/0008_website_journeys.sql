CREATE TABLE IF NOT EXISTS website_journey_events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'booking_click', 'booking_success')),
  page_key text NOT NULL CHECK (char_length(page_key) BETWEEN 1 AND 60),
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 100),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_journey_events_time_idx
  ON website_journey_events (occurred_at, session_id);

CREATE INDEX IF NOT EXISTS website_journey_events_session_idx
  ON website_journey_events (session_id, occurred_at);
