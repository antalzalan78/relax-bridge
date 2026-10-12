import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../../lib/server/admin-auth';
import { getImage, isImagePublic } from '../../../../lib/server/blog';
export const prerender = false;
export const GET: APIRoute = async ({ params, cookies }) => {
  const id = params.id || '';
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const isPublic = await isImagePublic(id);
  if (!isPublic && !(await getAdminSession(cookies))) return new Response('Not found', { status: 404 });
  const image = await getImage(id);
  if (!image) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.mime_type,
      'Cache-Control': isPublic ? 'public, max-age=3600' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
