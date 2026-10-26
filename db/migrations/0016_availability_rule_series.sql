ALTER TABLE availability_rules
  ADD COLUMN IF NOT EXISTS series_id uuid;

CREATE INDEX IF NOT EXISTS availability_rules_series_idx
  ON availability_rules (series_id);
