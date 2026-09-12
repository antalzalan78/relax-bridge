import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../../lib/server/admin-auth';
import {
  createGoogleAuthorization,
  isGoogleCalendarConfigured,
} from '../../../../lib/server/google-calendar';

export const prerender = false;

const STATE_COOKIE = 'rb_google_calendar_state';

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const session = await getAdminSession(cookies);
  if (!session) return redirect('/admin/login', 303);
  if (!isGoogleCalendarConfigured()) {
    return redirect('/admin?google=not-configured', 303);
  }

  const authorization = await createGoogleAuthorization({
    adminEmail: session.email,
  });
  cookies.set(STATE_COOKIE, authorization.state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/admin/google-calendar',
    maxAge: 10 * 60,
  });
  return redirect(authorization.url, 303);
};
