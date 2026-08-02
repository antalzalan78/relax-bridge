import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { AstroCookies } from 'astro';
import { getDatabase } from './db';

const COOKIE_NAME = 'rb_admin_session';
const SESSION_SECONDS = 12 * 60 * 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedEmail || !stored || email.trim().toLowerCase() !== expectedEmail) {
    return false;
  }

  const [algorithm, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;

  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = scryptSync(password, salt, expected.length, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function startAdminSession(
  cookies: AstroCookies,
  email: string,
  secure: boolean,
) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await getDatabase()`
    INSERT INTO admin_sessions (token_hash, admin_email, expires_at)
    VALUES (${tokenHash}, ${email.toLowerCase()}, now() + interval '12 hours')
  `;
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export async function getAdminSession(
  cookies: AstroCookies,
): Promise<{ email: string } | null> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const database = getDatabase();
  await database`
    DELETE FROM admin_sessions
    WHERE expires_at <= now()
  `;
  const [session] = await database`
    SELECT admin_email
    FROM admin_sessions
    WHERE token_hash = ${tokenHash} AND expires_at > now()
  `;

  return session?.admin_email ? { email: String(session.admin_email) } : null;
}

export async function endAdminSession(cookies: AstroCookies) {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (token) {
    await getDatabase()`
      DELETE FROM admin_sessions WHERE token_hash = ${hashToken(token)}
    `;
  }
  cookies.delete(COOKIE_NAME, { path: '/' });
}
