import { createHash, timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';
import { dispatchPendingBookingEmails } from '../../../lib/server/booking-email';

export const prerender = false;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const value = request.headers.get('authorization');
  if (!secret || !value) return false;
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(value).digest();
  return timingSafeEqual(expected, actual);
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await dispatchPendingBookingEmails({ limit: 25 });
    return Response.json(result);
  } catch (error) {
    console.error('Booking email retry failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
