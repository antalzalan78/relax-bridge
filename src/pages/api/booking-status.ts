import type { APIRoute } from 'astro';
import { Temporal } from '@js-temporal/polyfill';
import type { BookingCategory } from '../../lib/booking/types';
import {
  localDayInstantRange,
  todayInTimeZone,
} from '../../lib/booking/availability';
import { getBookingOptions } from '../../lib/booking/catalog';
import {
  getBookingSettings,
  getNextAvailableSlot,
} from '../../lib/server/booking-repository';
import { safelyRefreshGoogleCalendarBusy } from '../../lib/server/google-calendar';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const settings = await getBookingSettings();
    const today = Temporal.PlainDate.from(todayInTimeZone(settings.timeZone));
    const lastDay = today.add({ days: settings.bookingHorizonDays });
    await safelyRefreshGoogleCalendarBusy({
      start: localDayInstantRange(today.toString(), settings.timeZone).start,
      end: localDayInstantRange(lastDay.toString(), settings.timeZone).end,
    });
    const options = await getBookingOptions('nl');
    const shortestByCategory = new Map<BookingCategory, number>();

    for (const option of options) {
      const current = shortestByCategory.get(option.category);
      if (current === undefined || option.minutes < current) {
        shortestByCategory.set(option.category, option.minutes);
      }
    }

    const next = await getNextAvailableSlot({
      candidates: [...shortestByCategory].map(([category, durationMinutes]) => ({
        category,
        durationMinutes,
      })),
    });

    return Response.json(
      {
        today: todayInTimeZone(next?.timeZone ?? 'Europe/Amsterdam'),
        nextAvailableDate: next?.date ?? null,
        nextAvailableStart: next?.start ?? null,
        timeZone: next?.timeZone ?? 'Europe/Amsterdam',
      },
      {
        headers: {
          // Keep the badge fresh without querying the database for every page view.
          'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('Booking status lookup failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
