-- Additive and compatible with older clients; historical campaign values stay unknown.
ALTER TABLE website_journey_events
  ADD COLUMN IF NOT EXISTS utm_source text NOT NULL DEFAULT '' CHECK (char_length(utm_source) <= 100),
  ADD COLUMN IF NOT EXISTS utm_medium text NOT NULL DEFAULT '' CHECK (char_length(utm_medium) <= 100),
  ADD COLUMN IF NOT EXISTS utm_campaign text NOT NULL DEFAULT '' CHECK (char_length(utm_campaign) <= 100),
  ADD COLUMN IF NOT EXISTS utm_content text NOT NULL DEFAULT '' CHECK (char_length(utm_content) <= 100);
