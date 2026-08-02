import type { APIRoute } from 'astro';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  getAvailableSlots,
  getBookingSettings,
} from '../../lib/server/booking-repository';
import { todayInTimeZone } from '../../lib/booking/availability';

export const prerender = false;

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(['studio', 'home']),
  minutes: z.coerce.number().int().min(15).max(240),
});

export const GET: APIRoute = async ({ url }) => {
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const settings = await getBookingSettings();
    const requested = Temporal.PlainDate.from(parsed.data.date);
    const today = Temporal.PlainDate.from(todayInTimeZone(settings.timeZone));
    const lastDay = today.add({ days: settings.bookingHorizonDays });

    if (
      Temporal.PlainDate.compare(requested, today) < 0 ||
      Temporal.PlainDate.compare(requested, lastDay) > 0
    ) {
      return Response.json({ error: 'date_out_of_range' }, { status: 400 });
    }

    const slots = await getAvailableSlots({
      date: parsed.data.date,
      category: parsed.data.category,
      durationMinutes: parsed.data.minutes,
    });

    return Response.json({
      date: parsed.data.date,
      timeZone: settings.timeZone,
      slots: slots.map(({ start, end, label }) => ({ start, end, label })),
    });
  } catch (error) {
    console.error('Availability lookup failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
