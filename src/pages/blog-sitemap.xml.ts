import type { APIRoute } from 'astro';
import { blogArticlePath, blogPath, blogTopicPath, locales, site } from '../data/site';
import { listPublished, listTopics } from '../lib/server/blog';
export const prerender = false;
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export const GET: APIRoute = async () => {
  const topics = await listTopics();
  const paths = new Set<string>();
  for (const locale of locales) {
    const posts = await listPublished(locale, undefined, 10000);
    if (!posts.length) continue;
    paths.add(blogPath(locale));
    for (const post of posts) paths.add(blogArticlePath(locale, post.slug));
    for (const topic of topics) if (topic.names[locale] && posts.some((post) => post.topic_id === topic.id)) paths.add(blogTopicPath(locale, topic.id));
  }
  const entries = [...paths].map((path) => `<url><loc>${escape(new URL(path, site.url).href)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
};
