ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS service_details jsonb;
