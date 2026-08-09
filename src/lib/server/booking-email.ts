import {
  buildCustomerBookingEmail,
  buildOwnerBookingEmail,
  type BookingEmailDetails,
  type BookingEmailMessage,
} from '../booking/email-templates';
import { getDatabase } from './db';

type DeliveryKind = 'customer_confirmation' | 'owner_notification';

interface ClaimedDelivery extends BookingEmailDetails {
  deliveryId: string;
  deliveryKind: DeliveryKind;
  attempts: number;
}

export interface BookingEmailDispatchResult {
  sent: number;
  failed: number;
  skipped: boolean;
}

function emailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const ownerEmail = process.env.BOOKING_OWNER_EMAIL?.trim() || 'info@relaxbridge.nl';
  const from = process.env.BOOKING_EMAIL_FROM?.trim() || 'Relax Bridge <info@relaxbridge.nl>';
  return {
    apiKey,
    ownerEmail,
    from,
    studioAddress: process.env.BOOKING_STUDIO_ADDRESS?.trim() || 'Relax Bridge studio, Tilburg',
    timeZone: process.env.BOOKING_TIME_ZONE?.trim() || 'Europe/Amsterdam',
    whatsappUrl: 'https://wa.me/31653964923',
  };
}

async function claimDelivery(bookingId?: string): Promise<ClaimedDelivery | null> {
  const database = getDatabase();
  const [row] = await database`
    WITH candidate AS (
      SELECT id
      FROM booking_email_deliveries
      WHERE (${bookingId || null}::uuid IS NULL OR booking_id = ${bookingId || null}::uuid)
        AND (
          (status IN ('pending', 'failed') AND next_attempt_at <= now())
          OR (status = 'sending' AND claimed_at < now() - interval '15 minutes')
        )
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    ), claimed AS (
      UPDATE booking_email_deliveries AS delivery
      SET status = 'sending',
          attempts = delivery.attempts + 1,
          claimed_at = now(),
          updated_at = now(),
          last_error = NULL
      FROM candidate
      WHERE delivery.id = candidate.id
      RETURNING delivery.*
    )
    SELECT
      claimed.id AS delivery_id,
      claimed.kind AS delivery_kind,
      claimed.attempts,
      booking.id,
      booking.reference,
      booking.service_title,
      booking.service_category,
      booking.duration_minutes,
      booking.price_eur,
      booking.customer_name,
      booking.customer_email,
      booking.customer_phone,
      booking.home_address,
      booking.notes,
      booking.locale,
      booking.starts_at,
      booking.ends_at
    FROM claimed
    JOIN bookings AS booking ON booking.id = claimed.booking_id
  `;

  if (!row) return null;
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
  return {
    deliveryId: String(row.delivery_id),
    deliveryKind: String(row.delivery_kind) as DeliveryKind,
    attempts: Number(row.attempts),
    id: String(row.id),
    reference: String(row.reference),
    serviceTitle: String(row.service_title),
    category: String(row.service_category) as BookingEmailDetails['category'],
    durationMinutes: Number(row.duration_minutes),
    priceEur: Number(row.price_eur),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    homeAddress: row.home_address ? String(row.home_address) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    locale: String(row.locale) as BookingEmailDetails['locale'],
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
  };
}

async function sendWithResend(input: {
  apiKey: string;
  from: string;
  to: string;
  replyTo: string;
  idempotencyKey: string;
  message: BookingEmailMessage;
}): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      reply_to: input.replyTo,
      subject: input.message.subject,
      html: input.message.html,
      text: input.message.text,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !body.id) {
    throw new Error(`Resend ${response.status}: ${body.message || 'email delivery failed'}`);
  }
  return body.id;
}

async function markSent(deliveryId: string, providerMessageId: string): Promise<void> {
  await getDatabase()`
    UPDATE booking_email_deliveries
    SET status = 'sent', provider_message_id = ${providerMessageId},
        sent_at = now(), claimed_at = NULL, updated_at = now(), last_error = NULL
    WHERE id = ${deliveryId}
  `;
}

async function markFailed(delivery: ClaimedDelivery, error: unknown): Promise<void> {
  const delaySeconds = Math.min(21_600, 30 * (2 ** Math.min(delivery.attempts, 9)));
  const message = error instanceof Error ? error.message : String(error);
  await getDatabase()`
    UPDATE booking_email_deliveries
    SET status = 'failed', claimed_at = NULL,
        next_attempt_at = now() + (${delaySeconds} * interval '1 second'),
        last_error = ${message.slice(0, 1000)}, updated_at = now()
    WHERE id = ${delivery.deliveryId}
  `;
}

export async function dispatchPendingBookingEmails(input: {
  bookingId?: string;
  limit?: number;
} = {}): Promise<BookingEmailDispatchResult> {
  const configuration = emailConfiguration();
  if (!configuration.apiKey) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const result: BookingEmailDispatchResult = { sent: 0, failed: 0, skipped: false };
  const limit = Math.max(1, Math.min(input.limit || 10, 25));

  for (let index = 0; index < limit; index += 1) {
    const delivery = await claimDelivery(input.bookingId);
    if (!delivery) break;
    const context = {
      ownerEmail: configuration.ownerEmail,
      studioAddress: configuration.studioAddress,
      timeZone: configuration.timeZone,
      whatsappUrl: configuration.whatsappUrl,
    };
    const isCustomer = delivery.deliveryKind === 'customer_confirmation';
    const message = isCustomer
      ? buildCustomerBookingEmail(delivery, context)
      : buildOwnerBookingEmail(delivery, context);

    try {
      const providerId = await sendWithResend({
        apiKey: configuration.apiKey,
        from: configuration.from,
        to: isCustomer ? delivery.customerEmail : configuration.ownerEmail,
        replyTo: isCustomer ? configuration.ownerEmail : delivery.customerEmail,
        idempotencyKey: `booking-${delivery.id}-${delivery.deliveryKind}`,
        message,
      });
      await markSent(delivery.deliveryId, providerId);
      result.sent += 1;
    } catch (error) {
      await markFailed(delivery, error);
      console.error('Booking email delivery failed', {
        bookingId: delivery.id,
        kind: delivery.deliveryKind,
        error,
      });
      result.failed += 1;
    }
  }

  return result;
}

export async function retryBookingEmails(
  bookingId: string,
): Promise<BookingEmailDispatchResult> {
  await getDatabase()`
    UPDATE booking_email_deliveries
    SET status = 'pending', next_attempt_at = now(), claimed_at = NULL,
        last_error = NULL, updated_at = now()
    WHERE booking_id = ${bookingId} AND status <> 'sent'
  `;
  return dispatchPendingBookingEmails({ bookingId, limit: 2 });
}
