import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  normalizeCountryCode,
  normalizeEntryPath,
  normalizeTrafficSource,
} from '../../lib/analytics/model';
import { recordWebsiteVisit } from '../../lib/server/website-analytics-repository';
import { assertSameOrigin, readJson } from '../../lib/server/security';

export const prerender = false;

const visitSchema = z.object({
  locale: z.enum(['nl', 'en', 'hu']),
  entryPath: z.string().min(1).max(300),
  referrerHost: z.string().max(253).optional().default(''),
  utmSource: z.string().max(100).optional().default(''),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const requestUrl = new URL(request.url);
    if (!/(^|\.)relaxbridge\.nl$/i.test(requestUrl.hostname)) {
      return new Response(null, { status: 204 });
    }

    const parsed = visitSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    const entryPath = normalizeEntryPath(parsed.data.entryPath);
    if (entryPath.startsWith('/admin') || entryPath.startsWith('/api')) {
      return new Response(null, { status: 204 });
    }

    await recordWebsiteVisit({
      source: normalizeTrafficSource({
        utmSource: parsed.data.utmSource,
        referrerHost: parsed.data.referrerHost,
        siteHost: requestUrl.hostname,
      }),
      countryCode: normalizeCountryCode(request.headers.get('x-vercel-ip-country')),
      entryPath,
      locale: parsed.data.locale,
    });

    return new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Anonymous website visit could not be recorded', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
