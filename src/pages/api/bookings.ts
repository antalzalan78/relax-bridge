import type { APIRoute } from 'astro';
import { z } from 'zod';
import { findBookingOption } from '../../lib/booking/catalog';
import {
  calculateCreatorSelection,
  createMassageCreatorBookingDetails,
} from '../../lib/booking/massage-creator';
import {
  consumeRateLimit,
  createConfirmedBooking,
  getBookingSettings,
  SlotUnavailableError,
} from '../../lib/server/booking-repository';
import {
  assertSameOrigin,
  readJson,
  requestFingerprint,
} from '../../lib/server/security';
import { dispatchPendingBookingEmails } from '../../lib/server/booking-email';
import {
  safelyRefreshGoogleCalendarBusy,
  safelySyncGoogleCalendarEntity,
} from '../../lib/server/google-calendar';
import { localDayInstantRange } from '../../lib/booking/availability';
import { recordBookingJourneySuccess } from '../../lib/server/website-analytics-repository';
import { Temporal } from '@js-temporal/polyfill';

export const prerender = false;

const bookingSchema = z
  .object({
    locale: z.enum(['nl', 'en', 'hu']),
    key: z.enum(['relax', 'neck-shoulder-back', 'facial', 'foot']),
    category: z.literal('studio'),
    minutes: z.number().int().min(15).max(240),
    start: z.iso.datetime({ offset: true }),
    customerName: z.string().trim().min(2).max(100),
    customerEmail: z.email().max(200),
    customerPhone: z.string().trim().min(6).max(40),
    creatorScent: z.enum(['orange', 'rose', 'lavender', 'any', 'none']).optional(),
    creatorMusic: z.enum(['instrumental', 'nature', 'lofi', 'own', 'any', 'none']).optional(),
    creatorBase: z.enum(['relax', 'relax90', 'back30', 'back']).optional(),
    creatorBack: z.union([z.literal(0), z.literal(30)]).optional(),
    creatorFace: z.union([z.literal(0), z.literal(15), z.literal(30)]).optional(),
    creatorFoot: z.union([z.literal(0), z.literal(15), z.literal(30)]).optional(),
    notes: z.string().trim().max(1000).optional(),
    website: z.string().max(0).optional(),
    consent: z.literal(true),
    analyticsSessionId: z.uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.creatorBase) {
      const creator = calculateCreatorSelection({
        base: value.creatorBase,
        back: value.creatorBack,
        face: value.creatorFace,
        foot: value.creatorFoot,
      });
      if (!creator || value.key !== creator.serviceKey || value.minutes !== creator.minutes) {
        context.addIssue({
          code: 'custom',
          path: ['creatorBase'],
          message: 'Invalid Massage Creator configuration.',
        });
      }
    }
  });

const creatorLabels = {
  nl: {
    scent: 'Geur voor de behandeling',
    music: 'Muziek',
    base: 'Basis',
    addons: 'Aanvullingen',
    total: 'Totaal',
    bases: {
      relax: '60 min Relaxmassage',
      relax90: '90 min Relaxmassage',
      back30: '30 min Nek-, schouder- en rugmassage',
      back: '60 min Nek-, schouder- en rugmassage',
    },
    backAddon: 'Gerichte rug-, nek- en schouderbehandeling',
    faceAddon: 'Gezichts- en hoofdmassage',
    footAddon: 'Voetmassage',
    none: 'geen',
    scentOptions: { orange: 'Sinaasappel', rose: 'Roos', lavender: 'Lavendel', any: 'Ik laat het aan jou over', none: 'Geurloos' },
    musicOptions: { instrumental: 'Instrumentaal', nature: 'Natuurgeluiden', lofi: 'Lo-fi-muziek', own: 'Eigen muziek', any: 'Ik laat het aan jou over', none: 'Stilte' },
  },
  en: {
    scent: 'Scent for the treatment',
    music: 'Music',
    base: 'Base',
    addons: 'Add-ons',
    total: 'Total',
    bases: {
      relax: '60 min Relax Massage',
      relax90: '90 min Relax Massage',
      back30: '30 min Neck, Shoulder & Back Massage',
      back: '60 min Neck, Shoulder & Back Massage',
    },
    backAddon: 'Back, Neck & Shoulder focus',
    faceAddon: 'Face & Head Massage',
    footAddon: 'Foot Massage',
    none: 'none',
    scentOptions: { orange: 'Orange', rose: 'Rose', lavender: 'Lavender', any: 'I’ll leave it to you', none: 'Fragrance-free' },
    musicOptions: { instrumental: 'Instrumental', nature: 'Sounds of nature', lofi: 'Lo-fi music', own: 'Your own music', any: 'I’ll leave it to you', none: 'Silence' },
  },
  hu: {
    scent: 'Illat a kezeléshez',
    music: 'Zene',
    base: 'Alapkezelés',
    addons: 'Kiegészítők',
    total: 'Összesen',
    bases: {
      relax: '60 perc Relaxmasszázs',
      relax90: '90 perc Relaxmasszázs',
      back30: '30 perc Nyak–váll–hátmasszázs',
      back: '60 perc Nyak–váll–hátmasszázs',
    },
    backAddon: 'Célzott hát-, nyak- és vállkezelés',
    faceAddon: 'Arc- és fejmasszázs',
    footAddon: 'Talpmasszázs',
    none: 'nincs',
    scentOptions: { orange: 'Narancs', rose: 'Rózsa', lavender: 'Levendula', any: 'Rád bízom', none: 'Illatmentes' },
    musicOptions: { instrumental: 'Instrumentális', nature: 'Természet hangjai', lofi: 'Lo-fi zene', own: 'Saját zene', any: 'Rád bízom', none: 'Csend' },
  },
} as const;

function bookingNotes(input: z.infer<typeof bookingSchema>): string | undefined {
  const labels = creatorLabels[input.locale];
  const customTreatment = input.creatorBase
    ? calculateCreatorSelection({
        base: input.creatorBase,
        back: input.creatorBack,
        face: input.creatorFace,
        foot: input.creatorFoot,
      })
    : null;
  const treatmentNote = customTreatment
    ? (() => {
        const addons = [
          customTreatment.back ? `${labels.backAddon} (${customTreatment.back} min)` : null,
          customTreatment.face ? `${labels.faceAddon} (${customTreatment.face} min)` : null,
          customTreatment.foot ? `${labels.footAddon} (${customTreatment.foot} min)` : null,
        ].filter(Boolean);
        const base = labels.bases[customTreatment.base];
        return `Massage Creator — ${labels.base}: ${base} · ${labels.addons}: ${addons.length ? addons.join(', ') : labels.none} · ${labels.total}: ${customTreatment.minutes} min, € ${customTreatment.priceEur}`;
      })()
    : undefined;
  const choices = [
    input.creatorScent ? `${labels.scent}: ${labels.scentOptions[input.creatorScent]}` : null,
    input.creatorMusic ? `${labels.music}: ${labels.musicOptions[input.creatorMusic]}` : null,
  ].filter(Boolean);

  const preferencesNote = choices.length ? `Studio Visit — ${choices.join(' · ')}` : undefined;
  return [treatmentNote, preferencesNote, input.notes].filter(Boolean).join('\n') || undefined;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    if (body && typeof body === 'object' && 'category' in body && body.category === 'home') {
      return Response.json({ error: 'home_service_unavailable' }, { status: 404 });
    }
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    const allowed = await consumeRateLimit({
      key: requestFingerprint(request, 'public-booking'),
      limit: 8,
      windowSeconds: 60 * 60,
    });
    if (!allowed) {
      return Response.json({ error: 'too_many_requests' }, { status: 429 });
    }

    const creator = parsed.data.creatorBase
      ? calculateCreatorSelection({
          base: parsed.data.creatorBase,
          back: parsed.data.creatorBack,
          face: parsed.data.creatorFace,
          foot: parsed.data.creatorFoot,
        })
      : null;
    const option = creator
      ? {
          id: `studio:creator:${creator.base}:${creator.back}:${creator.face}:${creator.foot}`,
          key: creator.serviceKey,
          category: 'studio' as const,
          title: 'Massage Creator',
          minutes: creator.minutes,
          priceEur: creator.priceEur,
        }
      : await findBookingOption(parsed.data);
    if (!option) {
      return Response.json({ error: 'invalid_service' }, { status: 400 });
    }

    const settings = await getBookingSettings();
    const bookingDay = Temporal.Instant.from(parsed.data.start)
      .toZonedDateTimeISO(settings.timeZone)
      .toPlainDate()
      .toString();
    await safelyRefreshGoogleCalendarBusy(
      localDayInstantRange(bookingDay, settings.timeZone),
    );

    const booking = await createConfirmedBooking({
      option,
      locale: parsed.data.locale,
      start: parsed.data.start,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      notes: bookingNotes(parsed.data),
      serviceDetails: creator
        ? createMassageCreatorBookingDetails(creator)
        : undefined,
    });

    if (
      parsed.data.analyticsSessionId
      && request.headers.get('dnt') !== '1'
      && request.headers.get('sec-gpc') !== '1'
    ) {
      try {
        await recordBookingJourneySuccess(parsed.data.analyticsSessionId);
      } catch (error) {
        console.error('Booking saved, but conversion statistics could not be recorded', {
          bookingId: booking.id,
          error,
        });
      }
    }

    await safelySyncGoogleCalendarEntity('booking', booking.id);

    try {
      await dispatchPendingBookingEmails({ bookingId: booking.id, limit: 2 });
    } catch (error) {
      console.error('Booking saved, but email dispatch could not start', {
        bookingId: booking.id,
        error,
      });
    }

    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SlotUnavailableError) {
      return Response.json({ error: 'slot_unavailable' }, { status: 409 });
    }
    console.error('Booking creation failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
