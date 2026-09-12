import type { APIRoute } from 'astro';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import {
  getAvailableDates,
  getAvailableSlots,
  getBookingSettings,
} from '../../lib/server/booking-repository';
import { todayInTimeZone } from '../../lib/booking/availability';

export const prerender = false;

const requestBase = z.object({
  category: z.enum(['studio', 'home']),
  minutes: z.coerce.number().int().min(15).max(240),
});

const dayQuerySchema = requestBase.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const rangeQuerySchema = requestBase
  .extend({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((value) => {
    const from = Temporal.PlainDate.from(value.from);
    const to = Temporal.PlainDate.from(value.to);
    return (
      Temporal.PlainDate.compare(from, to) <= 0 && from.until(to).days <= 41
    );
  });

const querySchema = z.union([dayQuerySchema, rangeQuerySchema]);

export const GET: APIRoute = async ({ url }) => {
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    if ('from' in parsed.data) {
      const calendar = await getAvailableDates({
        from: parsed.data.from,
        to: parsed.data.to,
        category: parsed.data.category,
        durationMinutes: parsed.data.minutes,
      });
      return Response.json(calendar);
    }

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
