import type { APIRoute } from 'astro';
import { questionnaireSubmissionSchema } from '../../lib/questionnaire/model';
import { consumeRateLimit } from '../../lib/server/booking-repository';
import { createQuestionnaireResponse } from '../../lib/server/questionnaire-repository';
import { assertSameOrigin, readJson, requestFingerprint } from '../../lib/server/security';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const parsed = questionnaireSubmissionSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }

    const allowed = await consumeRateLimit({
      key: requestFingerprint(request, 'public-questionnaire'),
      limit: 8,
      windowSeconds: 24 * 60 * 60,
    });
    if (!allowed) {
      return Response.json({ error: 'too_many_requests' }, { status: 429 });
    }

    const { locale, ...answers } = parsed.data;
    await createQuestionnaireResponse({ locale, answers });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Questionnaire submission failed', error);
    return Response.json({ error: 'service_unavailable' }, { status: 503 });
  }
};
