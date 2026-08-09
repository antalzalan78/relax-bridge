CREATE TABLE IF NOT EXISTS booking_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  time_zone text NOT NULL DEFAULT 'Europe/Amsterdam',
  slot_interval_minutes smallint NOT NULL DEFAULT 15 CHECK (slot_interval_minutes BETWEEN 5 AND 60),
  min_notice_hours smallint NOT NULL DEFAULT 12 CHECK (min_notice_hours BETWEEN 0 AND 336),
  booking_horizon_days smallint NOT NULL DEFAULT 60 CHECK (booking_horizon_days BETWEEN 1 AND 365),
  studio_buffer_before_minutes smallint NOT NULL DEFAULT 0 CHECK (studio_buffer_before_minutes BETWEEN 0 AND 180),
  studio_buffer_after_minutes smallint NOT NULL DEFAULT 15 CHECK (studio_buffer_after_minutes BETWEEN 0 AND 180),
  home_buffer_before_minutes smallint NOT NULL DEFAULT 30 CHECK (home_buffer_before_minutes BETWEEN 0 AND 180),
  home_buffer_after_minutes smallint NOT NULL DEFAULT 30 CHECK (home_buffer_after_minutes BETWEEN 0 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO booking_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS availability_rules (
  id uuid PRIMARY KEY,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  valid_from date,
  valid_until date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_time < end_time),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_from <= valid_until)
);

CREATE INDEX IF NOT EXISTS availability_rules_weekday_idx
  ON availability_rules (weekday, active);

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id uuid PRIMARY KEY,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('open', 'blocked')),
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX IF NOT EXISTS availability_exceptions_day_idx
  ON availability_exceptions (day);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  service_key text NOT NULL CHECK (service_key IN ('relax', 'neck-shoulder-back', 'facial', 'foot')),
  service_category text NOT NULL CHECK (service_category IN ('studio', 'home')),
  service_title text NOT NULL,
  duration_minutes smallint NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  price_eur numeric(8, 2) NOT NULL CHECK (price_eur >= 0),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  home_address text,
  notes text,
  locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  busy_starts_at timestamptz NOT NULL,
  busy_ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (starts_at < ends_at),
  CHECK (busy_starts_at <= starts_at),
  CHECK (ends_at <= busy_ends_at),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS bookings_starts_at_idx
  ON bookings (starts_at);

CREATE TABLE IF NOT EXISTS booking_email_deliveries (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('customer_confirmation', 'owner_notification')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (booking_id, kind)
);

CREATE INDEX IF NOT EXISTS booking_email_deliveries_pending_idx
  ON booking_email_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'sending', 'failed');

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_no_confirmed_overlap;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_confirmed_overlap
  EXCLUDE USING gist (
    tstzrange(busy_starts_at, busy_ends_at, '[)') WITH &&
  )
  WHERE (status = 'confirmed');

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
  ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);
