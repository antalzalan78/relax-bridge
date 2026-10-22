import { randomUUID } from 'node:crypto';
import type { Locale } from '../../data/site';
import { getDatabase, type Database } from './db';
import { readBlogJsonArray, readBlogJsonObject } from './blog-json';
import schema from '../../../db/migrations/0010_blog.sql?raw';
import topicCoverSchema from '../../../db/migrations/0011_blog_topic_covers.sql?raw';
import orderAndTrashSchema from '../../../db/migrations/0012_blog_order_and_trash.sql?raw';

type JsonParameter = Parameters<Database['json']>[0];

export type BlogTopic = { id: string; names: Record<Locale, string>; descriptions: Record<Locale, string>; cover_image_id: string | null; display_order: number };
const starterTopicCovers: Record<string, string> = {
  'massage-history': '/blog/topics/massage-history.jpg',
  'everyday-rest': '/blog/topics/everyday-rest.jpg',
  'preparing-for-massage': '/blog/topics/preparing-for-massage.jpg',
};
export const topicCoverUrl = (topic: BlogTopic): string | undefined =>
  topic.cover_image_id ? `/api/blog/media/${topic.cover_image_id}` : starterTopicCovers[topic.id];
const starterTopicDescriptions: Record<string, Record<Locale, string>> = {
  'massage-history': {
    hu: 'Régi ábrázolások, írott emlékek és érdekes történetek nyomán fedezzük fel a masszázs múltját. Ismerd meg, mit mesélnek a fennmaradt források!',
    nl: 'Aan de hand van oude afbeeldingen, geschreven bronnen en bijzondere verhalen ontdekken we de geschiedenis van massage. Lees wat bewaard gebleven bronnen ons vertellen.',
    en: 'Explore the history of massage through ancient images, written records and fascinating stories. Discover what the surviving sources tell us.',
  },
  'everyday-rest': {
    hu: 'Zene, illatok és apró szokások, amelyek helyet adhatnak a pihenésnek. Kutatási érdekességek és ötletek a nyugodtabb hétköznapokhoz.',
    nl: 'Muziek, geuren en kleine gewoontes die ruimte kunnen maken voor rust. Interessante inzichten uit onderzoek en ideeën voor ontspannen dagen.',
    en: 'Music, scents and small habits that can make room for rest. Research insights and ideas for calmer everyday life.',
  },
  'preparing-for-massage': {
    hu: 'Egyszerű tudnivalók a kezelés kiválasztásától az érkezésig. Hasznos tanácsok, hogy felkészülten és nyugodtan érkezhess a masszázsra.',
    nl: 'Van het kiezen van een behandeling tot je aankomst: eenvoudige informatie en praktische tips om goed voorbereid en ontspannen naar je massage te komen.',
    en: 'From choosing a treatment to arriving for your appointment: simple information and practical tips to help you feel prepared and at ease.',
  },
};
export const topicDescription = (topic: BlogTopic, locale: Locale): string =>
  topic.descriptions[locale] || starterTopicDescriptions[topic.id]?.[locale] || '';
export type BlogImage = { id: string; alt: string; caption: string; credit: string };
export type BlogSource = { title: string; url: string };
export type BlogPost = {
  id: string; topic_id: string; series_key: string | null; series_order: number | null; display_order?: number;
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
      const check = await db`
        SELECT to_regclass('public.blog_topics') AS existing,
          EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'blog_topics' AND column_name = 'cover_image_id') AS has_cover,
          EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'deleted_at') AS has_trash,
          EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'blog_posts' AND column_name = 'display_order') AS has_order
      `;
      if (check[0]?.existing && check[0]?.has_cover && check[0]?.has_trash && check[0]?.has_order) return;
      await db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(793431036)`;
        const second = await tx`SELECT to_regclass('public.blog_topics') AS existing`;
        if (!second[0]?.existing) await tx.unsafe(schema);
        await tx.unsafe(topicCoverSchema);
        await tx.unsafe(orderAndTrashSchema);
      });
    })().catch((error) => { initialized = undefined; throw error; });
  }
  return initialized;
}

const castTopic = (row: any): BlogTopic => ({
  id: row.id,
  names: readBlogJsonObject<Record<Locale, string>>(row.names),
  descriptions: readBlogJsonObject<Record<Locale, string>>(row.descriptions),
  cover_image_id: row.cover_image_id || null,
  display_order: Number(row.display_order),
});
const castPost = (row: any): BlogPost => ({
  ...row,
  images: readBlogJsonArray<BlogImage>(row.images),
  sources: readBlogJsonArray<BlogSource>(row.sources),
});

export async function listTopics(): Promise<BlogTopic[]> {
  await ensureBlogSchema();
  return (await getDatabase()`SELECT * FROM blog_topics ORDER BY display_order, id`).map(castTopic);
}

export async function listAdminPosts(): Promise<BlogPost[]> {
  await ensureBlogSchema();
  return (await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, p.display_order, t.*, p.updated_at AS post_updated_at
    FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
    WHERE p.deleted_at IS NULL AND t.deleted_at IS NULL
    ORDER BY p.updated_at DESC, t.locale
  `).map(castPost);
}

export async function getAdminPost(id: string, locale: Locale): Promise<BlogPost | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, p.display_order, t.*,
      topic.names ->> ${locale} AS topic_name
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    JOIN blog_topics topic ON topic.id = p.topic_id
    WHERE p.id = ${id} AND t.locale = ${locale}
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
  `;
  return rows[0] ? castPost(rows[0]) : null;
}

export async function getPostMeta(id: string) {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT id, topic_id, series_key, series_order, display_order FROM blog_posts WHERE id = ${id} AND deleted_at IS NULL`;
  return rows[0] || null;
}

export async function listPublished(locale: Locale, topicId?: string, limit = 1000): Promise<BlogPost[]> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, p.display_order, t.*,
      topic.names ->> ${locale} AS topic_name
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    JOIN blog_topics topic ON topic.id = p.topic_id
    WHERE t.locale = ${locale} AND t.status = 'published'
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
      AND t.published_at <= now()
      AND (${topicId || null}::text IS NULL OR p.topic_id = ${topicId || null})
    ORDER BY CASE WHEN ${topicId || null}::text IS NOT NULL THEN p.display_order END ASC,
      t.published_at DESC, p.id
    LIMIT ${limit}
  `;
  return rows.map(castPost);
}

export async function getPublished(locale: Locale, slug: string): Promise<BlogPost | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id, p.topic_id, p.series_key, p.series_order, p.display_order, t.*,
      topic.names ->> ${locale} AS topic_name
    FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    JOIN blog_topics topic ON topic.id = p.topic_id
    WHERE t.locale = ${locale} AND t.slug = ${slug} AND t.status = 'published'
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
      AND t.published_at <= now()
  `;
  return rows[0] ? castPost(rows[0]) : null;
}

/** Resolve a public URL to a stable article ID without loading its body or media. */
export async function getPublishedArticleId(locale: Locale, slug: string): Promise<string | null> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT p.id FROM blog_posts p
    JOIN blog_translations t ON t.post_id = p.id
    WHERE t.locale = ${locale} AND t.slug = ${slug} AND t.status = 'published'
      AND t.published_at <= now() AND p.deleted_at IS NULL AND t.deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.id as string || null;
}

export async function getPublishedAlternates(id: string): Promise<Partial<Record<Locale, string>>> {
  await ensureBlogSchema();
  const rows = await getDatabase()`
    SELECT t.locale, t.slug FROM blog_translations t JOIN blog_posts p ON p.id = t.post_id
    WHERE t.post_id = ${id} AND t.status = 'published' AND t.published_at <= now()
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
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
    SELECT p.id, p.topic_id, p.series_key, p.series_order, p.display_order, t.*
    FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
    WHERE p.series_key = ${post.series_key} AND t.locale = ${post.locale}
      AND t.status = 'published' AND t.published_at <= now()
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
    ORDER BY p.series_order, t.published_at
  `;
  return rows.map(castPost);
}

export async function saveTopic(id: string | null, newKey: string, names: Record<Locale, string>, descriptions: Record<Locale, string>, coverImageId: string | null) {
  await ensureBlogSchema();
  const topicId = id || newKey;
  const db = getDatabase();
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    if (!id && (await tx`SELECT 1 FROM blog_topic_redirects WHERE old_id = ${topicId}`).length)
      throw new Error('Ez a témacím korábbi átirányításhoz tartozik. Válassz másik webcímet.');
    if (id) {
      const updated = await tx`UPDATE blog_topics SET names = ${tx.json(names as JsonParameter)},
        descriptions = ${tx.json(descriptions as JsonParameter)}, cover_image_id = ${coverImageId},
        updated_at = now() WHERE id = ${id} RETURNING id`;
      if (!updated.length) throw new Error('A téma nem található.');
    } else {
      const order = await tx`SELECT COALESCE(max(display_order), -1) + 1 AS next FROM blog_topics`;
      await tx`INSERT INTO blog_topics (id, names, descriptions, cover_image_id, display_order)
        VALUES (${topicId}, ${tx.json(names as JsonParameter)}, ${tx.json(descriptions as JsonParameter)}, ${coverImageId}, ${order[0].next})`;
    }
  });
  return topicId;
}

export async function savePost(post: BlogPost): Promise<void> {
  await ensureBlogSchema();
  const db = getDatabase();
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    const existing = await tx`SELECT topic_id, deleted_at FROM blog_posts WHERE id = ${post.id}`;
    if (existing[0]?.deleted_at) throw new Error('Ez a cikk a lomtárban van. Előbb állítsd vissza.');
    const oldTranslation = await tx`SELECT deleted_at FROM blog_translations WHERE post_id = ${post.id} AND locale = ${post.locale}`;
    if (oldTranslation[0]?.deleted_at) throw new Error('Ez a fordítás a lomtárban van. Előbb állítsd vissza.');
    if (!existing.length || existing[0].topic_id !== post.topic_id) {
      const first = await tx`SELECT COALESCE(min(display_order), 1) - 1 AS position FROM blog_posts
        WHERE topic_id = ${post.topic_id} AND deleted_at IS NULL`;
      if (!existing.length) await tx`INSERT INTO blog_posts (id, topic_id, series_key, series_order, display_order)
        VALUES (${post.id}, ${post.topic_id}, ${post.series_key}, ${post.series_order}, ${first[0].position})`;
      else await tx`UPDATE blog_posts SET topic_id = ${post.topic_id}, series_key = ${post.series_key},
        series_order = ${post.series_order}, display_order = ${first[0].position}, updated_at = now()
        WHERE id = ${post.id}`;
    } else await tx`UPDATE blog_posts SET series_key = ${post.series_key}, series_order = ${post.series_order},
      updated_at = now() WHERE id = ${post.id}`;
    await tx`
      INSERT INTO blog_translations (
        post_id, locale, slug, title, intro, body, author, status, published_at,
        seo_title, seo_description, hero_image_id, images, sources,
        music_text, music_url, video_url, series_name, cta_label, cta_url
      ) VALUES (
        ${post.id}, ${post.locale}, ${post.slug}, ${post.title}, ${post.intro}, ${post.body},
        ${post.author}, ${post.status}, ${post.published_at}, ${post.seo_title}, ${post.seo_description},
        ${post.hero_image_id}, ${tx.json(post.images as JsonParameter)},
        ${tx.json(post.sources as JsonParameter)}, ${post.music_text}, ${post.music_url},
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

type Direction = 'up' | 'down';
export async function moveTopic(id: string, direction: Direction): Promise<void> {
  await ensureBlogSchema();
  await getDatabase().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    const rows = await tx`SELECT id FROM blog_topics ORDER BY display_order, id`;
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error('A téma nem található.');
    const other = index + (direction === 'up' ? -1 : 1);
    if (other < 0 || other >= rows.length) return;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    for (const [position, row] of rows.entries()) await tx`UPDATE blog_topics SET display_order = ${position} WHERE id = ${row.id}`;
  });
}

export type TopicPostSummary = { id: string; title: string; locales: string[]; display_order: number };
export async function listTopicPosts(topicId: string): Promise<TopicPostSummary[]> {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT p.id, p.display_order,
    COALESCE(max(t.title) FILTER (WHERE t.locale = 'hu'), max(t.title) FILTER (WHERE t.locale = 'nl'),
      max(t.title) FILTER (WHERE t.locale = 'en'), p.id) AS title,
    COALESCE(array_agg(t.locale ORDER BY t.locale) FILTER (WHERE t.locale IS NOT NULL), ARRAY[]::text[]) AS locales
    FROM blog_posts p LEFT JOIN blog_translations t ON t.post_id = p.id AND t.deleted_at IS NULL
    WHERE p.topic_id = ${topicId} AND p.deleted_at IS NULL
    GROUP BY p.id ORDER BY p.display_order, p.id`;
  return rows.map((row) => ({ id: row.id as string, title: row.title as string,
    locales: row.locales as string[], display_order: Number(row.display_order) }));
}

export async function getTopicPostCount(topicId: string): Promise<number> {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT count(*)::integer AS total FROM blog_posts WHERE topic_id = ${topicId}`;
  return rows[0]?.total || 0;
}

export async function movePost(id: string, direction: Direction): Promise<string> {
  await ensureBlogSchema();
  return getDatabase().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    const target = await tx`SELECT topic_id FROM blog_posts WHERE id = ${id} AND deleted_at IS NULL`;
    if (!target.length) throw new Error('A cikk nem található.');
    const topicId = target[0].topic_id as string;
    const rows = await tx`SELECT id FROM blog_posts WHERE topic_id = ${topicId} AND deleted_at IS NULL
      ORDER BY display_order, id`;
    const index = rows.findIndex((row) => row.id === id);
    const other = index + (direction === 'up' ? -1 : 1);
    if (other < 0 || other >= rows.length) return topicId;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    for (const [position, row] of rows.entries()) await tx`UPDATE blog_posts SET display_order = ${position} WHERE id = ${row.id}`;
    return topicId;
  });
}

export async function resolveTopicRedirect(id: string): Promise<string | null | undefined> {
  await ensureBlogSchema();
  const rows = await getDatabase()`SELECT successor_id FROM blog_topic_redirects WHERE old_id = ${id}`;
  return rows.length ? rows[0].successor_id as string | null : undefined;
}

export async function deleteTopic(id: string, successorId: string | null): Promise<void> {
  await ensureBlogSchema();
  await getDatabase().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    if (!(await tx`SELECT 1 FROM blog_topics WHERE id = ${id}`).length) throw new Error('A téma nem található.');
    const posts = await tx`SELECT id FROM blog_posts WHERE topic_id = ${id} ORDER BY display_order, id`;
    if (posts.length && !successorId) throw new Error('Ehhez a témához cikkek tartoznak. Válassz utódtémát.');
    if (successorId) {
      if (successorId === id) throw new Error('Másik utódtémát válassz.');
      const successors = await tx`SELECT names FROM blog_topics WHERE id = ${successorId}`;
      if (!successors.length) throw new Error('Az utódtéma nem található.');
      const languages = await tx`SELECT DISTINCT t.locale FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id
        WHERE p.topic_id = ${id}`;
      const names = readBlogJsonObject<Record<Locale, string>>(successors[0].names);
      const missing = languages.map((row) => row.locale as Locale).filter((lang) => !names[lang]);
      if (missing.length) throw new Error(`Az utódtéma neve hiányzik ezeken a nyelveken: ${missing.join(', ')}.`);
      const end = await tx`SELECT COALESCE(max(display_order), -1) AS position FROM blog_posts WHERE topic_id = ${successorId}`;
      for (const [index, post] of posts.entries()) await tx`UPDATE blog_posts SET topic_id = ${successorId},
        display_order = ${Number(end[0].position) + index + 1}, updated_at = now() WHERE id = ${post.id}`;
    }
    await tx`UPDATE blog_topic_redirects SET successor_id = ${successorId} WHERE successor_id = ${id}`;
    await tx`INSERT INTO blog_topic_redirects (old_id, successor_id) VALUES (${id}, ${successorId})
      ON CONFLICT (old_id) DO UPDATE SET successor_id = EXCLUDED.successor_id`;
    await tx`DELETE FROM blog_topics WHERE id = ${id}`;
  });
}

export type TrashedPost = { id: string; title: string; locales: string[]; deleted_at: Date };
export type TrashedTranslation = { post_id: string; locale: Locale; title: string; deleted_at: Date };
export async function listBlogTrash(): Promise<{ posts: TrashedPost[]; translations: TrashedTranslation[] }> {
  await ensureBlogSchema();
  const db = getDatabase();
  const posts = await db`SELECT p.id, p.deleted_at, COALESCE(max(t.title) FILTER (WHERE t.locale = 'hu'),
    max(t.title) FILTER (WHERE t.locale = 'nl'), max(t.title), p.id) AS title,
    COALESCE(array_agg(t.locale ORDER BY t.locale) FILTER (WHERE t.locale IS NOT NULL AND t.deleted_at IS NULL), ARRAY[]::text[]) AS locales
    FROM blog_posts p LEFT JOIN blog_translations t ON t.post_id = p.id
    WHERE p.deleted_at IS NOT NULL GROUP BY p.id ORDER BY p.deleted_at DESC`;
  const translations = await db`SELECT t.post_id, t.locale, t.title, t.deleted_at
    FROM blog_translations t JOIN blog_posts p ON p.id = t.post_id
    WHERE t.deleted_at IS NOT NULL AND p.deleted_at IS NULL ORDER BY t.deleted_at DESC`;
  return {
    posts: posts.map((row) => ({ id: row.id as string, title: row.title as string,
      locales: row.locales as string[], deleted_at: row.deleted_at as Date })),
    translations: translations.map((row) => ({ post_id: row.post_id as string, locale: row.locale as Locale,
      title: row.title as string, deleted_at: row.deleted_at as Date })),
  };
}

export async function trashPost(id: string, locale: Locale | 'all'): Promise<void> {
  await ensureBlogSchema();
  await getDatabase().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    if (locale === 'all') {
      const rows = await tx`UPDATE blog_posts SET deleted_at = now() WHERE id = ${id} AND deleted_at IS NULL RETURNING id`;
      if (!rows.length) throw new Error('A cikk nem található.');
    } else {
      const rows = await tx`UPDATE blog_translations SET deleted_at = now() WHERE post_id = ${id}
        AND locale = ${locale} AND deleted_at IS NULL AND EXISTS
          (SELECT 1 FROM blog_posts WHERE id = ${id} AND deleted_at IS NULL) RETURNING post_id`;
      if (!rows.length) throw new Error('A fordítás nem található.');
    }
  });
}

export async function restorePost(id: string, locale: Locale | 'all'): Promise<void> {
  await ensureBlogSchema();
  await getDatabase().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(793431037)`;
    if (locale === 'all') {
      const rows = await tx`SELECT topic_id FROM blog_posts WHERE id = ${id} AND deleted_at IS NOT NULL`;
      if (!rows.length) throw new Error('A cikk nincs a lomtárban.');
      const first = await tx`SELECT COALESCE(min(display_order), 1) - 1 AS position FROM blog_posts
        WHERE topic_id = ${rows[0].topic_id} AND deleted_at IS NULL`;
      await tx`UPDATE blog_posts SET deleted_at = NULL, display_order = ${first[0].position}
        WHERE id = ${id}`;
    } else {
      const rows = await tx`UPDATE blog_translations SET deleted_at = NULL WHERE post_id = ${id}
        AND locale = ${locale} AND deleted_at IS NOT NULL AND EXISTS
          (SELECT 1 FROM blog_posts WHERE id = ${id} AND deleted_at IS NULL) RETURNING post_id`;
      if (!rows.length) throw new Error('A fordítás nincs a lomtárban.');
    }
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
  const db = getDatabase();
  const topicRows = await db`
    SELECT 1 FROM blog_topics topic
    WHERE topic.cover_image_id = ${id} AND topic.names <> '{}'::jsonb
    LIMIT 1
  `;
  if (topicRows.length) return true;
  const rows = await db`
    SELECT 1 FROM blog_translations t JOIN blog_posts p ON p.id = t.post_id
    WHERE t.status = 'published' AND t.published_at <= now()
      AND p.deleted_at IS NULL AND t.deleted_at IS NULL
      AND (hero_image_id = ${id} OR
        (CASE WHEN jsonb_typeof(images) = 'string' THEN (images #>> '{}')::jsonb ELSE images END)
          @> ${db.json([{ id }])})
    LIMIT 1
  `;
  return rows.length > 0;
}
