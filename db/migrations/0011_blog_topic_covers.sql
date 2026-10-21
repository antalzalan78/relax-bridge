ALTER TABLE blog_topics
  ADD COLUMN IF NOT EXISTS cover_image_id text REFERENCES blog_media(id) ON DELETE SET NULL;
