import type { APIRoute } from 'astro';

export const prerender = false;

/** Keep the public profile URL short while retaining first-touch campaign labels. */
export const GET: APIRoute = () => new Response(null, {
  status: 302,
  headers: {
    location: '/booking?utm_source=instagram&utm_medium=organic_social&utm_campaign=profil&utm_content=booking',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  },
});
