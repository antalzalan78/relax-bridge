ALTER TABLE blog_topics ADD COLUMN IF NOT EXISTS display_order bigint;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS display_order bigint;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE blog_translations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

WITH ranked AS (
  SELECT id, row_number() OVER (
    ORDER BY CASE id
      WHEN 'massage-history' THEN 0
      WHEN 'everyday-rest' THEN 1
      WHEN 'preparing-for-massage' THEN 2
      ELSE 3 END, created_at, id
  ) - 1 AS position FROM blog_topics
)
UPDATE blog_topics AS topic SET display_order = ranked.position
FROM ranked WHERE topic.id = ranked.id AND topic.display_order IS NULL;

WITH ranked AS (
  SELECT p.id, row_number() OVER (
    PARTITION BY p.topic_id
    ORDER BY max(t.published_at) DESC NULLS LAST, p.created_at DESC, p.id
  ) - 1 AS position
  FROM blog_posts p LEFT JOIN blog_translations t ON t.post_id = p.id
  GROUP BY p.id
)
UPDATE blog_posts AS post SET display_order = ranked.position
FROM ranked WHERE post.id = ranked.id AND post.display_order IS NULL;

ALTER TABLE blog_topics ALTER COLUMN display_order SET NOT NULL;
ALTER TABLE blog_posts ALTER COLUMN display_order SET NOT NULL;

CREATE TABLE IF NOT EXISTS blog_topic_redirects (
  old_id text PRIMARY KEY,
  successor_id text REFERENCES blog_topics(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_topics_display_order_idx ON blog_topics (display_order, id);
CREATE INDEX IF NOT EXISTS blog_posts_topic_order_idx ON blog_posts (topic_id, display_order, id)
  WHERE deleted_at IS NULL;
