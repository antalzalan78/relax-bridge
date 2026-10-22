ALTER TABLE website_journey_events
  ADD COLUMN IF NOT EXISTS article_id text,
  ADD COLUMN IF NOT EXISTS article_locale text;

CREATE INDEX IF NOT EXISTS website_journey_events_article_idx
  ON website_journey_events (article_id, occurred_at)
  WHERE article_id IS NOT NULL AND event_type = 'page_view';
