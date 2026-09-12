CREATE TABLE IF NOT EXISTS google_calendar_connection (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  calendar_id text,
  calendar_summary text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz,
  granted_scope text,
  connected_by text NOT NULL,
  last_busy_sync_at timestamptz,
  busy_sync_from timestamptz,
  busy_sync_to timestamptz,
  last_outbound_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_calendar_oauth_states (
  token_hash text PRIMARY KEY,
  admin_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_calendar_oauth_states_expires_idx
  ON google_calendar_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS google_calendar_event_links (
  entity_type text NOT NULL CHECK (
    entity_type IN ('booking', 'availability_rule', 'availability_exception')
  ),
  entity_id uuid NOT NULL,
  calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_event_links_event_idx
  ON google_calendar_event_links (calendar_id, google_event_id);

CREATE TABLE IF NOT EXISTS google_calendar_busy (
  id uuid PRIMARY KEY,
  calendar_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS google_calendar_busy_range_idx
  ON google_calendar_busy (starts_at, ends_at);
