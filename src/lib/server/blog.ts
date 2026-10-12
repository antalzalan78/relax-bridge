import { randomUUID } from 'node:crypto';
import type { Locale } from '../../data/site';
import { getDatabase } from './db';
import schema from '../../../db/migrations/0010_blog.sql?raw';

export type BlogTopic = { id: string; names: Record<Locale, string>; descriptions: Record<Locale, string> };
export type BlogImage = { id: string; alt: string; caption: string; credit: string };
export type BlogSource = { title: string; url: string };
export type BlogPost = {
  id: string; topic_id: string; series_key: string | null; series_order: number | null;
  locale: Locale; slug: string; title: string; intro: string; body: string; author: string;
  status: 'draft' | 'published'; published_at: Date | null; seo_title: string; seo_description: string;
  hero_image_id: string | null; images: BlogImage[]; sources: BlogSource[];
  music_text: string; music_url: string; video_url: string; series_name: string;
  cta_label: string; cta_url: string; updated_at: Date;
  topic_name?: string;
};

let initialized: Promise<void> | undefined;
export function ensureBlogSchema(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      const db = getDatabase();
      const check = await db`SELECT to_regclass('public.blog_topics') AS existing`;
      if (check[0]?.existing) return;
      await db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(793431036)`;
        const second = await tx`SELECT to_regclass('public.blog_topics') AS existing`;
        if (!second[0]?.existing) await tx.unsafe(schema);
      });
    })().catch((error) => { initialized = undefined; throw error; });
  }
  return initialized;
}

const castTopic = (row: any): BlogTopic => ({
  id: row.id, names: row.names || {}, descriptions: row.descriptions || {},
});
const castPost = (row: any): BlogPost => ({
  ...row, images: row.images || [], sources: row.sources || [],
});

export async function listTopics(): Promise<BlogTopic[]> {
  await ensureBlogSchema();
  return (await getDatabase()`SELECT * FROM blog_topics ORDER BY created_at, id`).map(castTopic);
}

export async function listAdminPosts(): Promise<BlogPost[]> {
  await ensureBlogSchema();
  return (await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, t.*, p.updated_at AS post_updated_at
    FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
    ORDER BY p.updated_at DESC, t.locale
  `).map(castPost);
}

export async function getAdminPost(id: string, locale: Locale): Promise<BlogPost | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, t.*
    FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
    WHERE p.id = ${id} AND t.locale = ${locale}
  `;
  return rows[0] ? castPost(rows[0]) : null;
}

export async function getPostMeta(id: string) {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT id, topic_id, series_key, series_order FROM blog_posts WHERE id = ${id}`;
  return rows[0] || null;
}

export async function listPublished(locale: Locale, topicId?: string, limit = 1000): Promise<BlogPost[]> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, t.*,
      topic.names ->> ${locale} AS topic_name
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    JOIN blog_topics topic ON topic.id = p.topic_id
    WHERE t.locale = ${locale} AND t.status = 'published'
      AND t.published_at <= now()
      AND (${topicId || null}::text IS NULL OR p.topic_id = ${topicId || null})
    ORDER BY t.published_at DESC, p.id
    LIMIT ${limit}
  `;
  return rows.map(castPost);
}

export async function getPublished(locale: Locale, slug: string): Promise<BlogPost | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, t.*,
      topic.names ->> ${locale} AS topic_name
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    JOIN blog_topics topic ON topic.id = p.topic_id
    WHERE t.locale = ${locale} AND t.slug = ${slug} AND t.status = 'published'
      AND t.published_at <= now()
  `;
  return rows[0] ? castPost(rows[0]) : null;
}

export async function getPublishedAlternates(id: string): Promise<Partial<Record<Locale, string>>> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT locale, slug FROM blog_translations
    WHERE post_id = ${id} AND status = 'published' AND published_at <= now()
  `;
  return Object.fromEntries(rows.map((row) => [row.locale, `/${row.locale === 'nl' ? '' : `${row.locale}/`}blog/${row.slug}`]));
}

export async function getRelated(post: BlogPost): Promise<BlogPost[]> {
  const all = await listPublished(post.locale, post.topic_id, 20);
  return all.filter((item) => item.id !== post.id).slice(0, 3);
}

export async function getSeries(post: BlogPost): Promise<BlogPost[]> {
  if (!post.series_key) return [];
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, t.*
    FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
    WHERE p.series_key = ${post.series_key} AND t.locale = ${post.locale}
      AND t.status = 'published' AND t.published_at <= now()
    ORDER BY p.series_order, t.published_at
  `;
  return rows.map(castPost);
}

export async function saveTopic(id: string | null, newKey: string, names: Record<Locale, string>, descriptions: Record<Locale, string>) {
  await ensureBlogSchema();
  const topicId = id || newKey;
  await getDatabase()`
    INSERT INTO blog_topics (id, names, descriptions) VALUES
      (${topicId}, ${JSON.stringify(names)}::jsonb, ${JSON.stringify(descriptions)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET names = EXCLUDED.names,
      descriptions = EXCLUDED.descriptions, updated_at = now()
  `;
  return topicId;
}

export async function savePost(post: BlogPost): Promise<void> {
  await ensureBlogSchema();
  const db = getDatabase();
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO blog_posts (id, topic_id, series_key, series_order)
      VALUES (${post.id}, ${post.topic_id}, ${post.series_key}, ${post.series_order})
      ON CONFLICT (id) DO UPDATE SET topic_id = EXCLUDED.topic_id,
        series_key = EXCLUDED.series_key, series_order = EXCLUDED.series_order, updated_at = now()
    `;
    await tx`
      INSERT INTO blog_translations (
        post_id, locale, slug, title, intro, body, author, status, published_at,
        seo_title, seo_description, hero_image_id, images, sources,
        music_text, music_url, video_url, series_name, cta_label, cta_url
      ) VALUES (
        ${post.id}, ${post.locale}, ${post.slug}, ${post.title}, ${post.intro}, ${post.body},
        ${post.author}, ${post.status}, ${post.published_at}, ${post.seo_title}, ${post.seo_description},
        ${post.hero_image_id}, ${JSON.stringify(post.images)}::jsonb,
        ${JSON.stringify(post.sources)}::jsonb, ${post.music_text}, ${post.music_url},
        ${post.video_url}, ${post.series_name}, ${post.cta_label}, ${post.cta_url}
      ) ON CONFLICT (post_id, locale) DO UPDATE SET
        slug = EXCLUDED.slug, title = EXCLUDED.title, intro = EXCLUDED.intro,
        body = EXCLUDED.body, author = EXCLUDED.author, status = EXCLUDED.status,
        published_at = EXCLUDED.published_at, seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description, hero_image_id = EXCLUDED.hero_image_id,
        images = EXCLUDED.images, sources = EXCLUDED.sources, music_text = EXCLUDED.music_text,
        music_url = EXCLUDED.music_url, video_url = EXCLUDED.video_url,
        series_name = EXCLUDED.series_name, cta_label = EXCLUDED.cta_label,
        cta_url = EXCLUDED.cta_url, updated_at = now()
    `;
  });
}

export async function saveImage(bytes: Uint8Array): Promise<string> {
  await ensureBlogSchema();
  const id = randomUUID();
  await getDatabase()`INSERT INTO blog_media (id, mime_type, bytes) VALUES (${id}, 'image/webp', ${Buffer.from(bytes)})`;
  return id;
}

export async function getImage(id: string): Promise<{ mime_type: string; bytes: Uint8Array } | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT mime_type, bytes FROM blog_media WHERE id = ${id}`;
  return rows[0] as { mime_type: string; bytes: Uint8Array } || null;
}

export async function isImagePublic(id: string): Promise<boolean> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT 1 FROM blog_translations
    WHERE status = 'published' AND published_at <= now()
      AND (hero_image_id = ${id} OR images @> ${JSON.stringify([{ id }])}::jsonb)
    LIMIT 1
  `;
  return rows.length > 0;
}
