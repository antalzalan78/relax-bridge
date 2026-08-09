import { createHash } from 'node:crypto';

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Response('Invalid request origin.', { status: 403 });
  }
}

export function requestFingerprint(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const secret = process.env.RATE_LIMIT_SECRET || 'development-only';
  return createHash('sha256')
    .update(`${scope}:${secret}:${address}`)
    .digest('hex');
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Response('Expected JSON request.', { status: 415 });
  }
  return request.json();
}
