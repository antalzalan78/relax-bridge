import type { APIRoute } from 'astro';
import { endAdminSession } from '../../lib/server/admin-auth';
import { assertSameOrigin } from '../../lib/server/security';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  try {
    assertSameOrigin(request);
    await endAdminSession(cookies);
    return redirect('/admin/login', 303);
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Logout failed.', { status: 500 });
  }
};
