import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../../lib/server/admin-auth';
import {
  consumeGoogleAuthorizationState,
  exchangeGoogleAuthorizationCode,
} from '../../../../lib/server/google-calendar';

export const prerender = false;

const STATE_COOKIE = 'rb_google_calendar_state';

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
  const session = await getAdminSession(cookies);
  if (!session) return redirect('/admin/login', 303);

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const denied = url.searchParams.get('error');
  const cookieState = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: '/api/admin/google-calendar' });

  if (denied) return redirect('/admin?google=denied', 303);
  if (!state || !code || !cookieState || state !== cookieState) {
    return redirect('/admin?google=invalid-state', 303);
  }
  const valid = await consumeGoogleAuthorizationState({
    state,
    adminEmail: session.email,
  });
  if (!valid) return redirect('/admin?google=invalid-state', 303);

  try {
    await exchangeGoogleAuthorizationCode({
      code,
      adminEmail: session.email,
    });
    return redirect('/admin?google=connected', 303);
  } catch (error) {
    console.error('Google Calendar callback failed', error);
    return redirect('/admin?google=connection-failed', 303);
  }
};
