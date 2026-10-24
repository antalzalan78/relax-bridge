-- Earlier manual blocks stored the before- and after-buffer in one occupied
-- range. Two adjacent manual appointments therefore counted the gap twice.
-- Match confirmed bookings: reserve the treatment and its before-buffer only.
UPDATE manual_calendar_blocks
SET occupied_ends_at = ends_at
WHERE buffer_minutes > 0 AND occupied_ends_at > ends_at;

-- Exact blocks have no buffer. Only treatment cores are mutually exclusive;
-- category-aware gaps are checked with the normal availability calculation.
ALTER TABLE manual_calendar_blocks
  DROP CONSTRAINT IF EXISTS manual_calendar_blocks_no_overlap;
ALTER TABLE manual_calendar_blocks
  ADD CONSTRAINT manual_calendar_blocks_no_overlap
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (cancelled_at IS NULL);

CREATE INDEX IF NOT EXISTS manual_calendar_blocks_core_time_idx
  ON manual_calendar_blocks (starts_at, ends_at)
  WHERE cancelled_at IS NULL;
