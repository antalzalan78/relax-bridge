import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => new Response(null, {
  status: 302,
  headers: {
    location: '/vragenlijst?utm_source=instagram&utm_medium=organic_social&utm_campaign=profil&utm_content=questionnaire',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  },
});
