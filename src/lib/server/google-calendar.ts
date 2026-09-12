import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { getDatabase } from './db';
import { ensureGoogleCalendarSchema } from './google-calendar-schema';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_CALLBACK_PATH =
  '/api/admin/google-calendar/callback';
const GOOGLE_CALENDAR_PRODUCTION_ORIGIN = 'https://www.relaxbridge.nl';
const OAUTH_STATE_SECONDS = 10 * 60;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

export type GoogleCalendarEntityType =
  | 'booking'
  | 'availability_rule'
  | 'availability_exception';

type ConnectionRow = {
  calendar_id: string | null;
  calendar_summary: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: Date | string | null;
  granted_scope: string | null;
  connected_by: string;
  last_busy_sync_at: Date | string | null;
  busy_sync_from: Date | string | null;
  busy_sync_to: Date | string | null;
  last_outbound_sync_at: Date | string | null;
  last_error: string | null;
};

type GoogleEvent = Record<string, unknown>;

class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function redirectUri() {
  const configured = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (configured) return configured;

  if (process.env.VERCEL_ENV === 'production') {
    return `${GOOGLE_CALENDAR_PRODUCTION_ORIGIN}${GOOGLE_CALENDAR_CALLBACK_PATH}`;
  }

  const previewHost =
    process.env.VERCEL_BRANCH_URL?.trim() || process.env.VERCEL_URL?.trim();
  return previewHost
    ? `https://${previewHost}${GOOGLE_CALENDAR_CALLBACK_PATH}`
    : undefined;
}

function configuration() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
    redirectUri: redirectUri(),
    tokenKey: process.env.GOOGLE_CALENDAR_TOKEN_KEY?.trim(),
  };
}

export function isGoogleCalendarConfigured(): boolean {
  const config = configuration();
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.redirectUri &&
      config.tokenKey,
  );
}

function requireConfiguration() {
  const { clientId, clientSecret, redirectUri, tokenKey } = configuration();
  if (!clientId || !clientSecret || !redirectUri || !tokenKey) {
    throw new Error('Google Calendar is not configured.');
  }
  const key = Buffer.from(tokenKey, 'base64');
  if (key.length !== 32) {
    throw new Error('GOOGLE_CALENDAR_TOKEN_KEY must be a 32-byte base64 value.');
  }
  return { clientId, clientSecret, redirectUri, key };
}

function encryptSecret(value: string): string {
  const { key } = requireConfiguration();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(value: string): string {
  const { key } = requireConfiguration();
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Stored Google Calendar token is invalid.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function hashState(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function connectionRow(): Promise<ConnectionRow | null> {
  await ensureGoogleCalendarSchema();
  const [row] = await getDatabase()`
    SELECT calendar_id, calendar_summary, access_token_encrypted,
      refresh_token_encrypted, token_expires_at, granted_scope, connected_by,
      last_busy_sync_at, busy_sync_from, busy_sync_to,
      last_outbound_sync_at, last_error
    FROM google_calendar_connection
    WHERE id = 1
  `;
  return (row as ConnectionRow | undefined) ?? null;
}

export async function getGoogleCalendarStatus() {
  const row = await connectionRow();
  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(row),
    selected: Boolean(row?.calendar_id),
    calendarId: row?.calendar_id ?? null,
    calendarSummary: row?.calendar_summary ?? null,
    connectedBy: row?.connected_by ?? null,
    lastBusySyncAt: row?.last_busy_sync_at ?? null,
    lastOutboundSyncAt: row?.last_outbound_sync_at ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function createGoogleAuthorization(input: {
  adminEmail: string;
}): Promise<{ url: string; state: string }> {
  const config = requireConfiguration();
  await ensureGoogleCalendarSchema();
  const state = randomBytes(32).toString('base64url');
  const database = getDatabase();
  await database`
    DELETE FROM google_calendar_oauth_states WHERE expires_at <= now()
  `;
  await database`
    INSERT INTO google_calendar_oauth_states (token_hash, admin_email, expires_at)
    VALUES (
      ${hashState(state)}, ${input.adminEmail.toLowerCase()},
      now() + (${OAUTH_STATE_SECONDS} * interval '1 second')
    )
  `;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_SCOPES.join(' '),
    state,
  });
  return { url: `${GOOGLE_AUTH_URL}?${params}`, state };
}

export async function consumeGoogleAuthorizationState(input: {
  state: string;
  adminEmail: string;
}): Promise<boolean> {
  await ensureGoogleCalendarSchema();
  const rows = await getDatabase()`
    DELETE FROM google_calendar_oauth_states
    WHERE token_hash = ${hashState(input.state)}
      AND admin_email = ${input.adminEmail.toLowerCase()}
      AND expires_at > now()
    RETURNING token_hash
  `;
  return rows.length === 1;
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  adminEmail: string;
}): Promise<void> {
  const config = requireConfiguration();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof token.access_token !== 'string') {
    throw new GoogleApiError('Google authorization code exchange failed.', response.status);
  }

  const existing = await connectionRow();
  const refreshToken = typeof token.refresh_token === 'string'
    ? token.refresh_token
    : existing
      ? decryptSecret(existing.refresh_token_encrypted)
      : null;
  if (!refreshToken) throw new Error('Google did not return a refresh token.');
  const expiresIn = Number(token.expires_in || 3600);

  await getDatabase()`
    INSERT INTO google_calendar_connection (
      id, calendar_id, calendar_summary, access_token_encrypted,
      refresh_token_encrypted, token_expires_at, granted_scope,
      connected_by, last_error, updated_at
    ) VALUES (
      1, ${existing?.calendar_id ?? null}, ${existing?.calendar_summary ?? null},
      ${encryptSecret(token.access_token)}, ${encryptSecret(refreshToken)},
      now() + (${expiresIn} * interval '1 second'),
      ${typeof token.scope === 'string' ? token.scope : GOOGLE_SCOPES.join(' ')},
      ${input.adminEmail.toLowerCase()}, NULL, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      token_expires_at = EXCLUDED.token_expires_at,
      granted_scope = EXCLUDED.granted_scope,
      connected_by = EXCLUDED.connected_by,
      last_error = NULL,
      updated_at = now()
  `;
}

async function refreshAccessToken(row: ConnectionRow): Promise<string> {
  const config = requireConfiguration();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decryptSecret(row.refresh_token_encrypted),
      grant_type: 'refresh_token',
    }),
  });
  const token = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof token.access_token !== 'string') {
    throw new GoogleApiError('Google access token refresh failed.', response.status);
  }
  const expiresIn = Number(token.expires_in || 3600);
  await getDatabase()`
    UPDATE google_calendar_connection
    SET access_token_encrypted = ${encryptSecret(token.access_token)},
      token_expires_at = now() + (${expiresIn} * interval '1 second'),
      last_error = NULL, updated_at = now()
    WHERE id = 1
  `;
  return token.access_token;
}

async function accessToken(row: ConnectionRow): Promise<string> {
  const expiresAt = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    return decryptSecret(row.access_token_encrypted);
  }
  return refreshAccessToken(row);
}

async function googleRequest<T>(
  row: ConnectionRow,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await accessToken(row);
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new GoogleApiError(
      `Google Calendar request failed (${response.status}): ${message.slice(0, 400)}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listWritableGoogleCalendars(): Promise<Array<{
  id: string;
  summary: string;
  primary: boolean;
}>> {
  const row = await connectionRow();
  if (!row) return [];
  const result = await googleRequest<{ items?: Array<Record<string, unknown>> }>(
    row,
    '/users/me/calendarList?minAccessRole=writer',
  );
  return (result.items ?? [])
    .filter((item) => typeof item.id === 'string')
    .map((item) => ({
      id: String(item.id),
      summary: String(item.summaryOverride || item.summary || item.id),
      primary: item.primary === true,
    }))
    .sort((left, right) => Number(right.primary) - Number(left.primary));
}

function entityPath(calendarId: string, eventId?: string): string {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function deleteLinkedEvent(
  row: ConnectionRow,
  entityType: GoogleCalendarEntityType,
  entityId: string,
): Promise<void> {
  const [link] = await getDatabase()`
    SELECT calendar_id, google_event_id
    FROM google_calendar_event_links
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}::uuid
  `;
  if (!link) return;
  try {
    await googleRequest<void>(
      row,
      entityPath(String(link.calendar_id), String(link.google_event_id)),
      { method: 'DELETE' },
    );
  } catch (error) {
    if (!(error instanceof GoogleApiError) || error.status !== 404) throw error;
  }
  await getDatabase()`
    DELETE FROM google_calendar_event_links
    WHERE entity_type = ${entityType} AND entity_id = ${entityId}::uuid
  `;
}

async function upsertLinkedEvent(input: {
  row: ConnectionRow;
  entityType: GoogleCalendarEntityType;
  entityId: string;
  event: GoogleEvent;
}): Promise<void> {
  const calendarId = input.row.calendar_id;
  if (!calendarId) return;
  const [link] = await getDatabase()`
    SELECT calendar_id, google_event_id
    FROM google_calendar_event_links
    WHERE entity_type = ${input.entityType}
      AND entity_id = ${input.entityId}::uuid
  `;

  let saved: { id: string } | undefined;
  if (link && String(link.calendar_id) === calendarId) {
    try {
      saved = await googleRequest<{ id: string }>(
        input.row,
        entityPath(calendarId, String(link.google_event_id)),
        { method: 'PUT', body: JSON.stringify(input.event) },
      );
    } catch (error) {
      if (!(error instanceof GoogleApiError) || error.status !== 404) throw error;
    }
  }
  if (!saved) {
    saved = await googleRequest<{ id: string }>(
      input.row,
      `${entityPath(calendarId)}?sendUpdates=none`,
      { method: 'POST', body: JSON.stringify(input.event) },
    );
  }
  await getDatabase()`
    INSERT INTO google_calendar_event_links (
      entity_type, entity_id, calendar_id, google_event_id, updated_at
    ) VALUES (
      ${input.entityType}, ${input.entityId}::uuid, ${calendarId}, ${saved.id}, now()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      calendar_id = EXCLUDED.calendar_id,
      google_event_id = EXCLUDED.google_event_id,
      updated_at = now()
  `;
}

function extendedProperties(
  entityType: GoogleCalendarEntityType,
  entityId: string,
) {
  return {
    private: {
      relaxBridge: 'true',
      relaxBridgeType: entityType,
      relaxBridgeId: entityId,
    },
  };
}

function localDate(value: unknown): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function shortTime(value: unknown): string {
  return String(value).slice(0, 5);
}

function recurringRuleEvent(row: any, timeZone: string): GoogleEvent | null {
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
  const validFrom = row.valid_from
    ? Temporal.PlainDate.from(localDate(row.valid_from))
    : today;
  let first = Temporal.PlainDate.compare(validFrom, today) > 0 ? validFrom : today;
  first = first.add({ days: (Number(row.weekday) - first.dayOfWeek + 7) % 7 });
  if (
    row.valid_until &&
    Temporal.PlainDate.compare(first, Temporal.PlainDate.from(localDate(row.valid_until))) > 0
  ) {
    return null;
  }
  const dayCodes = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  let recurrence = `RRULE:FREQ=WEEKLY;BYDAY=${dayCodes[Number(row.weekday)]}`;
  if (row.valid_until) {
    const until = Temporal.PlainDate.from(localDate(row.valid_until))
      .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from('23:59:59') })
      .toInstant()
      .toString()
      .replaceAll('-', '')
      .replaceAll(':', '')
      .replace(/\.\d+Z$/, 'Z');
    recurrence += `;UNTIL=${until}`;
  }
  return {
    summary: 'Relax Bridge · Beschikbaar',
    description: 'Automatisch gesynchroniseerd vanuit Relax Bridge.',
    start: { dateTime: `${first}T${shortTime(row.start_time)}:00`, timeZone },
    end: { dateTime: `${first}T${shortTime(row.end_time)}:00`, timeZone },
    recurrence: [recurrence],
    transparency: 'transparent',
    extendedProperties: extendedProperties('availability_rule', String(row.id)),
  };
}

function exceptionEvent(row: any, timeZone: string): GoogleEvent {
  const day = Temporal.PlainDate.from(localDate(row.day));
  const open = row.kind === 'open';
  const base: GoogleEvent = {
    summary: open
      ? 'Relax Bridge · Beschikbaar'
      : 'Relax Bridge · Niet beschikbaar',
    description: [
      'Automatisch gesynchroniseerd vanuit Relax Bridge.',
      row.reason ? `Notitie: ${row.reason}` : null,
    ].filter(Boolean).join('\n'),
    transparency: open ? 'transparent' : 'opaque',
    extendedProperties: extendedProperties(
      'availability_exception',
      String(row.id),
    ),
  };
  if (row.start_time && row.end_time) {
    base.start = { dateTime: `${day}T${shortTime(row.start_time)}:00`, timeZone };
    base.end = { dateTime: `${day}T${shortTime(row.end_time)}:00`, timeZone };
  } else {
    base.start = { date: day.toString() };
    base.end = { date: day.add({ days: 1 }).toString() };
  }
  return base;
}

function bookingEvent(row: any, timeZone: string): GoogleEvent {
  const description = [
    `Referentie: ${row.reference}`,
    `Behandeling: ${row.service_title}`,
    `Duur: ${row.duration_minutes} min`,
    `Prijs: € ${Number(row.price_eur)}`,
    `E-mail: ${row.customer_email}`,
    `Telefoon: ${row.customer_phone}`,
    row.notes ? `Notitie: ${row.notes}` : null,
  ].filter(Boolean).join('\n');
  return {
    summary: `Relax Bridge · ${row.customer_name} · ${row.service_title}`,
    description,
    location: row.home_address || undefined,
    start: { dateTime: new Date(row.starts_at).toISOString(), timeZone },
    end: { dateTime: new Date(row.ends_at).toISOString(), timeZone },
    transparency: 'opaque',
    extendedProperties: extendedProperties('booking', String(row.id)),
  };
}

export async function syncGoogleCalendarEntity(
  entityType: GoogleCalendarEntityType,
  entityId: string,
): Promise<void> {
  const row = await connectionRow();
  if (!row?.calendar_id || !isGoogleCalendarConfigured()) return;
  const database = getDatabase();
  const [settings] = await database`
    SELECT time_zone FROM booking_settings WHERE id = 1
  `;
  const timeZone = String(settings?.time_zone || 'Europe/Amsterdam');
  let source: any;
  let event: GoogleEvent | null = null;

  if (entityType === 'booking') {
    [source] = await database`
      SELECT * FROM bookings WHERE id = ${entityId}::uuid
    `;
    if (source?.status === 'confirmed') event = bookingEvent(source, timeZone);
  } else if (entityType === 'availability_rule') {
    [source] = await database`
      SELECT * FROM availability_rules WHERE id = ${entityId}::uuid AND active = true
    `;
    if (source) event = recurringRuleEvent(source, timeZone);
  } else {
    [source] = await database`
      SELECT * FROM availability_exceptions WHERE id = ${entityId}::uuid
    `;
    if (source) event = exceptionEvent(source, timeZone);
  }

  if (!event) {
    await deleteLinkedEvent(row, entityType, entityId);
    return;
  }
  await upsertLinkedEvent({ row, entityType, entityId, event });
}

export async function removeGoogleCalendarEntity(
  entityType: GoogleCalendarEntityType,
  entityId: string,
): Promise<void> {
  const row = await connectionRow();
  if (!row?.calendar_id || !isGoogleCalendarConfigured()) return;
  await deleteLinkedEvent(row, entityType, entityId);
}

export async function recordGoogleCalendarError(error: unknown): Promise<void> {
  try {
    await ensureGoogleCalendarSchema();
    const message = error instanceof Error ? error.message : String(error);
    await getDatabase()`
      UPDATE google_calendar_connection
      SET last_error = ${message.slice(0, 1000)}, updated_at = now()
      WHERE id = 1
    `;
  } catch {}
}

export async function safelySyncGoogleCalendarEntity(
  entityType: GoogleCalendarEntityType,
  entityId: string,
): Promise<void> {
  try {
    await syncGoogleCalendarEntity(entityType, entityId);
  } catch (error) {
    console.error('Google Calendar entity sync failed', { entityType, entityId, error });
    await recordGoogleCalendarError(error);
  }
}

export async function safelyRemoveGoogleCalendarEntity(
  entityType: GoogleCalendarEntityType,
  entityId: string,
): Promise<void> {
  try {
    await removeGoogleCalendarEntity(entityType, entityId);
  } catch (error) {
    console.error('Google Calendar entity removal failed', { entityType, entityId, error });
    await recordGoogleCalendarError(error);
  }
}

export async function syncAllToGoogleCalendar(): Promise<void> {
  const row = await connectionRow();
  if (!row?.calendar_id || !isGoogleCalendarConfigured()) return;
  const database = getDatabase();
  const [rules, exceptions, bookings] = await Promise.all([
    database`SELECT id FROM availability_rules WHERE active = true`,
    database`SELECT id FROM availability_exceptions WHERE day >= current_date`,
    database`
      SELECT id FROM bookings
      WHERE status = 'confirmed' AND ends_at >= now()
    `,
  ]);
  const targets = [
    ...rules.map((item: any) => ({ type: 'availability_rule' as const, id: String(item.id) })),
    ...exceptions.map((item: any) => ({ type: 'availability_exception' as const, id: String(item.id) })),
    ...bookings.map((item: any) => ({ type: 'booking' as const, id: String(item.id) })),
  ];
  const expected = new Set(targets.map((target) => `${target.type}:${target.id}`));

  for (const target of targets) {
    await syncGoogleCalendarEntity(target.type, target.id);
  }

  const links = await database`
    SELECT entity_type, entity_id
    FROM google_calendar_event_links
    WHERE calendar_id = ${row.calendar_id}
  `;
  for (const link of links) {
    const key = `${link.entity_type}:${link.entity_id}`;
    if (!expected.has(key)) {
      await deleteLinkedEvent(
        row,
        link.entity_type as GoogleCalendarEntityType,
        String(link.entity_id),
      );
    }
  }
  await database`
    UPDATE google_calendar_connection
    SET last_outbound_sync_at = now(), last_error = NULL, updated_at = now()
    WHERE id = 1
  `;
}

export async function selectGoogleCalendar(input: {
  calendarId: string;
  calendarSummary: string;
}): Promise<void> {
  const row = await connectionRow();
  if (!row) throw new Error('Connect Google Calendar first.');
  if (row.calendar_id && row.calendar_id !== input.calendarId) {
    const links = await getDatabase()`
      SELECT entity_type, entity_id
      FROM google_calendar_event_links
      WHERE calendar_id = ${row.calendar_id}
    `;
    for (const link of links) {
      await deleteLinkedEvent(
        row,
        link.entity_type as GoogleCalendarEntityType,
        String(link.entity_id),
      );
    }
  }
  await getDatabase().begin(async (transaction) => {
    await transaction`
      DELETE FROM google_calendar_busy
    `;
    await transaction`
      UPDATE google_calendar_connection
      SET calendar_id = ${input.calendarId},
        calendar_summary = ${input.calendarSummary},
        busy_sync_from = NULL, busy_sync_to = NULL,
        last_error = NULL, updated_at = now()
      WHERE id = 1
    `;
  });
  await syncAllToGoogleCalendar();
}

export async function refreshGoogleCalendarBusy(input: {
  start: string;
  end: string;
}): Promise<void> {
  const row = await connectionRow();
  if (!row?.calendar_id || !isGoogleCalendarConfigured()) return;
  const lastSync = row.last_busy_sync_at
    ? new Date(row.last_busy_sync_at).getTime()
    : 0;
  const cachedFrom = row.busy_sync_from
    ? new Date(row.busy_sync_from).getTime()
    : Number.POSITIVE_INFINITY;
  const cachedTo = row.busy_sync_to
    ? new Date(row.busy_sync_to).getTime()
    : Number.NEGATIVE_INFINITY;
  if (
    lastSync > Date.now() - 60_000 &&
    cachedFrom <= new Date(input.start).getTime() &&
    cachedTo >= new Date(input.end).getTime()
  ) {
    return;
  }
  const [settings] = await getDatabase()`
    SELECT time_zone FROM booking_settings WHERE id = 1
  `;
  const timeZone = String(settings?.time_zone || 'Europe/Amsterdam');
  const events: Array<Record<string, any>> = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: input.start,
      timeMax: input.end,
      timeZone,
      singleEvents: 'true',
      showDeleted: 'false',
      maxResults: '2500',
      orderBy: 'startTime',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await googleRequest<{
      items?: Array<Record<string, any>>;
      nextPageToken?: string;
    }>(row, `${entityPath(row.calendar_id)}?${params}`);
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const instantValue = (value: Record<string, any> | undefined) => {
    if (typeof value?.dateTime === 'string') {
      return Temporal.Instant.from(value.dateTime).toString();
    }
    if (typeof value?.date === 'string') {
      return Temporal.PlainDate.from(value.date)
        .toZonedDateTime({
          timeZone,
          plainTime: Temporal.PlainTime.from('00:00'),
        })
        .toInstant()
        .toString();
    }
    return null;
  };
  const busy = events.flatMap((event) => {
    const privateProperties = event.extendedProperties?.private;
    if (
      event.status === 'cancelled' ||
      event.transparency === 'transparent' ||
      event.eventType === 'birthday' ||
      event.eventType === 'workingLocation' ||
      privateProperties?.relaxBridge === 'true'
    ) {
      return [];
    }
    const start = instantValue(event.start);
    const end = instantValue(event.end);
    return start && end ? [{ start, end }] : [];
  });
  await getDatabase().begin(async (transaction) => {
    await transaction`
      DELETE FROM google_calendar_busy
      WHERE calendar_id = ${row.calendar_id}
        AND starts_at < ${input.end}::timestamptz
        AND ends_at > ${input.start}::timestamptz
    `;
    for (const window of busy) {
      await transaction`
        INSERT INTO google_calendar_busy (
          id, calendar_id, starts_at, ends_at, synced_at
        ) VALUES (
          ${randomUUID()}, ${row.calendar_id},
          ${window.start}::timestamptz, ${window.end}::timestamptz, now()
        )
      `;
    }
    await transaction`
      UPDATE google_calendar_connection
      SET last_busy_sync_at = now(),
        busy_sync_from = ${input.start}::timestamptz,
        busy_sync_to = ${input.end}::timestamptz,
        last_error = NULL, updated_at = now()
      WHERE id = 1
    `;
  });
}

export async function safelyRefreshGoogleCalendarBusy(input: {
  start: string;
  end: string;
}): Promise<void> {
  try {
    await refreshGoogleCalendarBusy(input);
  } catch (error) {
    console.error('Google Calendar busy sync failed', error);
    await recordGoogleCalendarError(error);
  }
}

export async function listGoogleCalendarBusy(input: {
  start: string;
  end: string;
}) {
  await ensureGoogleCalendarSchema();
  return getDatabase()`
    SELECT id, starts_at, ends_at
    FROM google_calendar_busy
    WHERE starts_at < ${input.end}::timestamptz
      AND ends_at > ${input.start}::timestamptz
    ORDER BY starts_at
  `;
}
