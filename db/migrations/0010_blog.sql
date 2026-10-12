CREATE TABLE IF NOT EXISTS blog_topics (
  id text PRIMARY KEY,
  names jsonb NOT NULL DEFAULT '{}'::jsonb,
  descriptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id text PRIMARY KEY,
  topic_id text NOT NULL REFERENCES blog_topics(id),
  series_key text,
  series_order integer CHECK (series_order IS NULL OR series_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_translations (
  post_id text NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT 'Brigitta',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  hero_image_id text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  music_text text NOT NULL DEFAULT '',
  music_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  series_name text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT '',
  cta_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, locale),
  UNIQUE (locale, slug)
);

CREATE INDEX IF NOT EXISTS blog_translations_public_idx ON blog_translations (locale, published_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS blog_media (
  id text PRIMARY KEY,
  mime_type text NOT NULL,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO blog_topics (id, names) VALUES
  ('massage-history', '{"hu":"Masszázstörténet"}'::jsonb),
  ('preparing-for-massage', '{"hu":"Masszázsra készülök"}'::jsonb),
  ('everyday-rest', '{"hu":"Pihenés a hétköznapokban"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_posts (id, topic_id) VALUES
  ('seed-massage-history', 'massage-history'),
  ('seed-first-massage', 'preparing-for-massage'),
  ('seed-music-or-silence', 'everyday-rest')
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_translations (post_id, locale, slug, title) VALUES
  ('seed-massage-history', 'hu', 'ki-talalta-fel-a-masszazst', 'Ki találta fel a masszázst? – A kezdetek nyomában'),
  ('seed-first-massage', 'hu', 'az-elso-masszazsod', 'Az első masszázsod: mire számíthatsz nálam?'),
  ('seed-music-or-silence', 'hu', 'zene-vagy-csend', 'Zene vagy csend? Így teheted személyesebbé a masszázsodat')
ON CONFLICT (post_id, locale) DO NOTHING;
