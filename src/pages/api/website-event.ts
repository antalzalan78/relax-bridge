import type { APIRoute } from 'astro';
import { z } from 'zod';
import { journeyPageKey } from '../../lib/analytics/journey';
import { normalizeTrafficSource } from '../../lib/analytics/model';
import { consumeRateLimit } from '../../lib/server/booking-repository';
import { recordWebsiteJourneyEvent } from '../../lib/server/website-analytics-repository';
import { assertSameOrigin, readJson, requestFingerprint } from '../../lib/server/security';

export const prerender = false;

const eventSchema = z.object({
  sessionId: z.uuid(),
  eventType: z.enum(['page_view', 'booking_click']),
  pagePath: z.string().min(1).max(300),
  referrerHost: z.string().max(253).optional().default(''),
  utmSource: z.string().max(100).optional().default(''),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const requestUrl = new URL(request.url);
    if (
      !/(^|\.)relaxbridge\.nl$/i.test(requestUrl.hostname)
      || request.headers.get('dnt') === '1'
      || request.headers.get('sec-gpc') === '1'
    ) return new Response(null, { status: 204 });

    const parsed = eventSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    const pageKey = journeyPageKey(parsed.data.pagePath);
    if (!pageKey) return new Response(null, { status: 204 });

    const allowed = await consumeRateLimit({
      key: requestFingerprint(request, 'website-journey'),
      limit: 240,
      windowSeconds: 60 * 60,
    });
    if (!allowed) return new Response(null, { status: 204 });

    await recordWebsiteJourneyEvent({
      sessionId: parsed.data.sessionId,
      eventType: parsed.data.eventType,
      pageKey,
      source: normalizeTrafficSource({
        utmSource: parsed.data.utmSource,
        referrerHost: parsed.data.referrerHost,
        siteHost: requestUrl.hostname,
      }),
    });
    return new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Anonymous website journey event could not be recorded', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
