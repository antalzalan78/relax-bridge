import type { APIRoute } from 'astro';
import { z } from 'zod';
import { findBookingOption } from '../../lib/booking/catalog';
import { calculateCreatorSelection } from '../../lib/booking/massage-creator';
import {
  consumeRateLimit,
  createConfirmedBooking,
  SlotUnavailableError,
} from '../../lib/server/booking-repository';
import {
  assertSameOrigin,
  readJson,
  requestFingerprint,
} from '../../lib/server/security';
import { dispatchPendingBookingEmails } from '../../lib/server/booking-email';

export const prerender = false;

const bookingSchema = z
  .object({
    locale: z.enum(['nl', 'en', 'hu']),
    key: z.enum(['relax', 'neck-shoulder-back', 'facial', 'foot']),
    category: z.enum(['studio', 'home']),
    minutes: z.number().int().min(15).max(240),
    start: z.iso.datetime({ offset: true }),
    customerName: z.string().trim().min(2).max(100),
    customerEmail: z.email().max(200),
    customerPhone: z.string().trim().min(6).max(40),
    homeAddress: z.string().trim().max(300).optional(),
    creatorScent: z.string().trim().max(120).optional(),
    creatorMusic: z.string().trim().max(120).optional(),
    creatorBioVegan: z.boolean().optional(),
    creatorBase: z.enum(['relax', 'back']).optional(),
    creatorBack: z.union([z.literal(0), z.literal(30)]).optional(),
    creatorFace: z.union([z.literal(0), z.literal(15), z.literal(30)]).optional(),
    creatorFoot: z.union([z.literal(0), z.literal(15), z.literal(30)]).optional(),
    notes: z.string().trim().max(1000).optional(),
    website: z.string().max(0).optional(),
    consent: z.literal(true),
  })
  .superRefine((value, context) => {
    if (value.category === 'home' && !value.homeAddress) {
      context.addIssue({
        code: 'custom',
        path: ['homeAddress'],
        message: 'Address is required for home appointments.',
      });
    }
    if (value.creatorBase) {
      const creator = calculateCreatorSelection({
        base: value.creatorBase,
        back: value.creatorBack,
        face: value.creatorFace,
        foot: value.creatorFoot,
      });
      if (!creator || value.category !== 'studio' || value.key !== creator.serviceKey || value.minutes !== creator.minutes) {
        context.addIssue({
          code: 'custom',
          path: ['creatorBase'],
          message: 'Invalid Massage Creator configuration.',
        });
      }
    }
  });

const creatorLabels = {
  nl: { scent: 'Geur', music: 'Muziek', bioVegan: 'Bio & vegan: ja', base: 'Basis', addons: 'Aanvullingen', total: 'Totaal', relax: '60 min Relaxmassage', back: '60 min Nek-, schouder- en rugmassage', none: 'geen' },
  en: { scent: 'Scent', music: 'Music', bioVegan: 'Bio & vegan: yes', base: 'Base', addons: 'Add-ons', total: 'Total', relax: '60 min Relax Massage', back: '60 min Neck, Shoulder & Back Massage', none: 'none' },
  hu: { scent: 'Illat', music: 'Zene', bioVegan: 'Bio & vegan: igen', base: 'Alapkezelés', addons: 'Kiegészítők', total: 'Összesen', relax: '60 perc Relaxmasszázs', back: '60 perc Nyak–váll–hátmasszázs', none: 'nincs' },
} as const;

function bookingNotes(input: z.infer<typeof bookingSchema>): string | undefined {
  if (input.category !== 'studio') return input.notes;

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
          customTreatment.back ? `Back, Neck & Shoulder focus (${customTreatment.back} min)` : null,
          customTreatment.face ? `Face & Head Massage (${customTreatment.face} min)` : null,
          customTreatment.foot ? `Foot Massage (${customTreatment.foot} min)` : null,
        ].filter(Boolean);
        const base = customTreatment.base === 'relax' ? labels.relax : labels.back;
        return `Massage Creator — ${labels.base}: ${base} · ${labels.addons}: ${addons.length ? addons.join(', ') : labels.none} · ${labels.total}: ${customTreatment.minutes} min, € ${customTreatment.priceEur}`;
      })()
    : undefined;
  const choices = [
    input.creatorScent ? `${labels.scent}: ${input.creatorScent}` : null,
    input.creatorMusic ? `${labels.music}: ${input.creatorMusic}` : null,
    input.creatorBioVegan ? labels.bioVegan : null,
  ].filter(Boolean);

  const preferencesNote = choices.length ? `Studio Visit — ${choices.join(' · ')}` : undefined;
  return [treatmentNote, preferencesNote, input.notes].filter(Boolean).join('\n') || undefined;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const parsed = bookingSchema.safeParse(await readJson(request));
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

    const booking = await createConfirmedBooking({
      option,
      locale: parsed.data.locale,
      start: parsed.data.start,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      homeAddress: parsed.data.homeAddress,
      notes: bookingNotes(parsed.data),
    });

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
