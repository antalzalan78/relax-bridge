import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { parseBlogBody, readingMinutes, youtubeEmbed } from '../../src/lib/blog.ts';
import { readBlogJsonArray, readBlogJsonObject } from '../../src/lib/server/blog-json.ts';

test('blog JSON reader restores legacy encoded metadata without silently dropping it', () => {
  const images = [{ id: 'image-1', alt: 'History', caption: '', credit: '' }];
  const sources = [{ title: 'Museum', url: 'https://example.com' }];
  assert.deepEqual(readBlogJsonArray(images), images);
  assert.deepEqual(readBlogJsonArray(JSON.stringify(images)), images);
  assert.deepEqual(readBlogJsonArray(JSON.stringify(JSON.stringify(sources))), sources);
  assert.deepEqual(readBlogJsonObject(JSON.stringify({ hu: 'Masszázstörténet' })), { hu: 'Masszázstörténet' });
  assert.throws(() => readBlogJsonArray('{bad json'), /Invalid stored blog JSON/);
  assert.throws(() => readBlogJsonArray('{}'), /Invalid stored blog list/);
});

test('blog migration creates three unpublished title drafts and remains idempotent', async () => {
  const db = new PGlite();
  try {
    const migration = await readFile(new URL('../../db/migrations/0010_blog.sql', import.meta.url), 'utf8');
    const coversMigration = await readFile(new URL('../../db/migrations/0011_blog_topic_covers.sql', import.meta.url), 'utf8');
    const orderMigration = await readFile(new URL('../../db/migrations/0012_blog_order_and_trash.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(coversMigration);
    await db.exec(orderMigration);
    await db.exec(orderMigration);
    const orderedTopics = await db.query<{ id: string }>('SELECT id FROM blog_topics ORDER BY display_order');
    assert.deepEqual(orderedTopics.rows.map((row) => row.id), ['massage-history', 'everyday-rest', 'preparing-for-massage']);
    const orderedPosts = await db.query<{ display_order: string }>("SELECT display_order FROM blog_posts WHERE id = 'seed-massage-history'");
    assert.equal(Number(orderedPosts.rows[0]?.display_order), 0);
    await db.exec(coversMigration);
    const covers = await db.query<{ cover_image_id: string | null }>("SELECT cover_image_id FROM blog_topics WHERE id = 'massage-history'");
    assert.equal(covers.rows[0]?.cover_image_id, null);
    const posts = await db.query<{ status: string; locale: string; title: string }>('SELECT status, locale, title FROM blog_translations ORDER BY post_id');
    assert.equal(posts.rows.length, 3);
    assert.ok(posts.rows.every((row) => row.status === 'draft' && row.locale === 'hu'));
    const publicPosts = await db.query("SELECT * FROM blog_translations WHERE status = 'published' AND published_at <= now()");
    assert.equal(publicPosts.rows.length, 0);

    await db.exec("UPDATE blog_topics SET names = '{\"hu\":\"Masszázstörténet\",\"nl\":\"Massagegeschiedenis\"}'::jsonb WHERE id = 'massage-history'");
    await db.exec("INSERT INTO blog_translations (post_id, locale, slug, title, intro, body, status, published_at) VALUES ('seed-massage-history', 'nl', 'massagegeschiedenis', 'Massagegeschiedenis', 'Inleiding', '## Begin\\nTekst', 'published', now())");
    const live = await db.query<{ locale: string; title: string }>("SELECT locale, title FROM blog_translations WHERE status = 'published' AND published_at <= now()");
    assert.deepEqual(live.rows, [{ locale: 'nl', title: 'Massagegeschiedenis' }]);
    await db.exec("UPDATE blog_translations SET status = 'draft' WHERE post_id = 'seed-massage-history' AND locale = 'nl'");
    const hiddenAgain = await db.query("SELECT 1 FROM blog_translations WHERE status = 'published' AND published_at <= now()");
    assert.equal(hiddenAgain.rows.length, 0);
  } finally { await db.close(); }
});

test('blog trash and topic redirects preserve translation slugs and images', async () => {
  const db = new PGlite();
  try {
    for (const name of ['0010_blog.sql', '0011_blog_topic_covers.sql', '0012_blog_order_and_trash.sql']) {
      await db.exec(await readFile(new URL(`../../db/migrations/${name}`, import.meta.url), 'utf8'));
    }
    await db.exec("UPDATE blog_translations SET hero_image_id = 'test-image', images = '[{\"id\":\"test-image\"}]'::jsonb WHERE post_id = 'seed-massage-history'");
    await db.exec("UPDATE blog_translations SET deleted_at = now() WHERE post_id = 'seed-massage-history' AND locale = 'hu'");
    const hidden = await db.query("SELECT 1 FROM blog_translations WHERE post_id = 'seed-massage-history' AND deleted_at IS NULL");
    assert.equal(hidden.rows.length, 0);
    await db.exec("UPDATE blog_translations SET deleted_at = NULL WHERE post_id = 'seed-massage-history' AND locale = 'hu'");
    await db.exec("UPDATE blog_posts SET topic_id = 'everyday-rest' WHERE id = 'seed-massage-history'");
    await db.exec("INSERT INTO blog_topic_redirects (old_id, successor_id) VALUES ('massage-history', 'everyday-rest')");
    await db.exec("DELETE FROM blog_topics WHERE id = 'massage-history'");
    const kept = await db.query<{ topic_id: string; slug: string; hero_image_id: string; images: { id: string }[] }>("SELECT p.topic_id, t.slug, t.hero_image_id, t.images FROM blog_posts p JOIN blog_translations t ON t.post_id = p.id WHERE p.id = 'seed-massage-history'");
    assert.equal(kept.rows[0]?.topic_id, 'everyday-rest');
    assert.equal(kept.rows[0]?.slug, 'ki-talalta-fel-a-masszazst');
    assert.equal(kept.rows[0]?.hero_image_id, 'test-image');
    assert.deepEqual(kept.rows[0]?.images, [{ id: 'test-image' }]);
  } finally { await db.close(); }
});

test('article body supports headings and paragraphs without interpreting HTML', () => {
  const blocks = parseBlogBody('## Első rész\n\nSzöveg <script>alert(1)</script>\n\n- egyik\n- másik');
  assert.deepEqual(blocks.map((block) => block.kind), ['h2', 'paragraph', 'list']);
  assert.match(blocks[1].text || '', /<script>/);
  assert.equal(readingMinutes('egy kettő három'), 1);
});

test('only valid YouTube video IDs generate an embed URL', () => {
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=34Dls7B6yTw'), 'https://www.youtube-nocookie.com/embed/34Dls7B6yTw');
  assert.equal(youtubeEmbed('https://evil.example/watch?v=34Dls7B6yTw'), null);
  assert.equal(youtubeEmbed('javascript:alert(1)'), null);
});
