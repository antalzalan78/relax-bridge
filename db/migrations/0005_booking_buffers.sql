UPDATE booking_settings
SET
  studio_buffer_before_minutes = 30,
  studio_buffer_after_minutes = 0,
  home_buffer_before_minutes = 120,
  home_buffer_after_minutes = 0,
  updated_at = now()
WHERE id = 1;
