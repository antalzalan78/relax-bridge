import assert from 'node:assert/strict';
import test from 'node:test';
import { publicTopicId, publicTopicName, publicTopics, postsForPublicTopic, orderPublicTopicPosts } from '../../src/lib/blog-public.ts';
import type { BlogPost, BlogTopic } from '../../src/lib/server/blog.ts';

const topic = (id: string): BlogTopic => ({
  id, names: { nl: id, en: id, hu: id }, descriptions: { nl: '', en: '', hu: '' },
  cover_image_id: null, display_order: 0,
});
const post = (id: string, topic_id: string, display_order = 0): BlogPost => ({
  id, topic_id, display_order, locale: 'hu', slug: id, title: id, intro: '', body: '', author: 'Brigitta',
  status: 'published', published_at: null, updated_at: new Date(), seo_title: '', seo_description: '',
  hero_image_id: null, images: [], sources: [], series_key: null, series_order: null, music_text: '',
  music_url: '', video_url: '', series_name: '', cta_label: '', cta_url: '',
});

test('public blog presents the three approved topics without changing CMS records', () => {
  const original = [topic('massage-history'), topic('preparing-for-massage'), topic('everyday-rest')];
  const display = publicTopics(original);
  assert.deepEqual(display.map((item) => item.id), ['everyday-rest', 'relax-bridge-philosophy', 'massage-history']);
  assert.equal(display[0].names.hu, 'Masszázs a Relax Bridge-nél');
  assert.equal(original[1].id, 'preparing-for-massage');
  assert.equal(publicTopicId('preparing-for-massage'), 'everyday-rest');
  assert.equal(publicTopicName('hu', 'preparing-for-massage', ''), 'Masszázs a Relax Bridge-nél');
});

test('preparation articles remain available under the merged public topic', () => {
  const posts = [post('first', 'preparing-for-massage', 1), post('music', 'everyday-rest', 0), post('history', 'massage-history')];
  assert.deepEqual(postsForPublicTopic(posts, 'everyday-rest').map((item) => item.id), ['first', 'music']);
  assert.deepEqual(orderPublicTopicPosts(postsForPublicTopic(posts, 'everyday-rest'), 'everyday-rest').map((item) => item.id), ['music', 'first']);
  assert.equal(posts.length, 3);
});
