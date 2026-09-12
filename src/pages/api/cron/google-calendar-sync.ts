import { createHash, timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';
import { Temporal } from '@js-temporal/polyfill';
import { localDayInstantRange } from '../../../lib/booking/availability';
import { getBookingSettings } from '../../../lib/server/booking-repository';
import {
  refreshGoogleCalendarBusy,
  syncAllToGoogleCalendar,
} from '../../../lib/server/google-calendar';

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
    await syncAllToGoogleCalendar();
    const settings = await getBookingSettings();
    const today = Temporal.Now.zonedDateTimeISO(settings.timeZone).toPlainDate();
    const lastDay = today.add({ days: settings.bookingHorizonDays });
    await refreshGoogleCalendarBusy({
      start: localDayInstantRange(today.toString(), settings.timeZone).start,
      end: localDayInstantRange(lastDay.toString(), settings.timeZone).end,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Google Calendar scheduled sync failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
