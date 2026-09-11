CREATE TABLE IF NOT EXISTS website_traffic_daily (
  day date NOT NULL,
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 100),
  country_code text NOT NULL CHECK (country_code = '??' OR country_code ~ '^[A-Z]{2}$'),
  entry_path text NOT NULL CHECK (char_length(entry_path) BETWEEN 1 AND 180),
  locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
  visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, source, country_code, entry_path, locale)
);

CREATE INDEX IF NOT EXISTS website_traffic_daily_day_idx
  ON website_traffic_daily (day DESC);
