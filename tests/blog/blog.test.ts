import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { parseBlogBody, readingMinutes, youtubeEmbed } from '../../src/lib/blog.ts';

test('blog migration creates three unpublished title drafts and remains idempotent', async () => {
  const db = new PGlite();
  try {
    const migration = await readFile(new URL('../../db/migrations/0010_blog.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
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
