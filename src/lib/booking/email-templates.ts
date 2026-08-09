import type { BookingCategory, BookingLocale } from './types';

export interface BookingEmailDetails {
  id: string;
  reference: string;
  serviceTitle: string;
  category: BookingCategory;
  durationMinutes: number;
  priceEur: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  homeAddress?: string;
  notes?: string;
  locale: BookingLocale;
  startsAt: string;
  endsAt: string;
}

export interface BookingEmailContext {
  ownerEmail: string;
  studioAddress: string;
  timeZone: string;
  whatsappUrl: string;
}

export interface BookingEmailMessage {
  subject: string;
  html: string;
  text: string;
}

const localeTags: Record<BookingLocale, string> = {
  nl: 'nl-NL',
  en: 'en-GB',
  hu: 'hu-HU',
};

const customerCopy = {
  nl: {
    subject: 'Je afspraak bij Relax Bridge is bevestigd',
    greeting: 'Hallo',
    intro: 'Je afspraak staat vast. Hieronder vind je alle gegevens.',
    service: 'Behandeling',
    date: 'Datum',
    time: 'Tijd',
    duration: 'Duur',
    price: 'Prijs',
    location: 'Locatie',
    reference: 'Reserveringsnummer',
    studio: 'Relax Bridge studio in Tilburg',
    home: 'Bij jou thuis',
    minutes: 'minuten',
    change: 'Wil je iets wijzigen of annuleren? Neem dan contact op via WhatsApp of antwoord op deze e-mail.',
    closing: 'Tot dan,',
  },
  en: {
    subject: 'Your Relax Bridge appointment is confirmed',
    greeting: 'Hello',
    intro: 'Your appointment is confirmed. You can find all details below.',
    service: 'Treatment',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    price: 'Price',
    location: 'Location',
    reference: 'Booking reference',
    studio: 'Relax Bridge studio in Tilburg',
    home: 'At your home',
    minutes: 'minutes',
    change: 'Would you like to change or cancel your appointment? Contact us via WhatsApp or reply to this email.',
    closing: 'See you then,',
  },
  hu: {
    subject: 'Relax Bridge időpontod visszaigazolása',
    greeting: 'Kedves',
    intro: 'Az időpontod végleges. Az összes részletet alább találod.',
    service: 'Kezelés',
    date: 'Dátum',
    time: 'Időpont',
    duration: 'Időtartam',
    price: 'Ár',
    location: 'Helyszín',
    reference: 'Foglalási azonosító',
    studio: 'Relax Bridge stúdió, Tilburg',
    home: 'Az otthonodban',
    minutes: 'perc',
    change: 'Módosításhoz vagy lemondáshoz írj WhatsAppon, vagy válaszolj erre az e-mailre.',
    closing: 'Szeretettel várlak,',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDetails(booking: BookingEmailDetails, timeZone: string) {
  const locale = localeTags[booking.locale];
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  return {
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeZone,
    }).format(startsAt),
    shortDate: new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone,
    }).format(startsAt),
    startTime: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(startsAt),
    endTime: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(endsAt),
    price: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(booking.priceEur),
  };
}

function emailShell(content: string, language: BookingLocale): string {
  return `<!doctype html>
<html lang="${language}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f6f1e8;color:#1f2d28;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f1e8;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdfa;border:1px solid #ded4c4;border-radius:18px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#17362f;color:#fff">
            <div style="font-family:Georgia,serif;font-size:27px;font-weight:700">Relax Bridge</div>
            <div style="margin-top:5px;color:#e5d4bd;font-size:12px;letter-spacing:.13em;text-transform:uppercase">Massage · Tilburg</div>
          </td></tr>
          <tr><td style="padding:32px">${content}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 12px;color:#625f56;font-size:13px;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;color:#1f2d28;font-size:14px;font-weight:700;vertical-align:top">${escapeHtml(value)}</td>
  </tr>`;
}

function customerLocation(
  booking: BookingEmailDetails,
  context: BookingEmailContext,
): string {
  const copy = customerCopy[booking.locale];
  if (booking.category === 'home') {
    return booking.homeAddress
      ? `${copy.home}: ${booking.homeAddress}`
      : copy.home;
  }
  return context.studioAddress || copy.studio;
}

export function buildCustomerBookingEmail(
  booking: BookingEmailDetails,
  context: BookingEmailContext,
): BookingEmailMessage {
  const copy = customerCopy[booking.locale];
  const formatted = formatDetails(booking, context.timeZone);
  const location = customerLocation(booking, context);
  const subject = `${copy.subject} · ${formatted.shortDate} ${formatted.startTime}`;
  const rows = [
    [copy.service, booking.serviceTitle],
    [copy.date, formatted.date],
    [copy.time, `${formatted.startTime}–${formatted.endTime}`],
    [copy.duration, `${booking.durationMinutes} ${copy.minutes}`],
    [copy.price, formatted.price],
    [copy.location, location],
    [copy.reference, booking.reference],
  ] as const;

  const html = emailShell(`
    <p style="margin:0 0 10px;font-size:18px">${escapeHtml(copy.greeting)} ${escapeHtml(booking.customerName)},</p>
    <p style="margin:0 0 24px;color:#625f56;line-height:1.6">${escapeHtml(copy.intro)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #ded4c4;border-radius:12px">
      ${rows.map(([label, value]) => detailRow(label, value)).join('')}
    </table>
    <p style="margin:24px 0 0;color:#625f56;line-height:1.6">${escapeHtml(copy.change)}</p>
    <p style="margin:14px 0 0"><a href="${escapeHtml(context.whatsappUrl)}" style="color:#a85030;font-weight:700">WhatsApp</a> · <a href="mailto:${escapeHtml(context.ownerEmail)}" style="color:#285247">${escapeHtml(context.ownerEmail)}</a></p>
    <p style="margin:28px 0 0;line-height:1.6">${escapeHtml(copy.closing)}<br><strong>Relax Bridge</strong></p>
  `, booking.locale);

  const text = [
    `${copy.greeting} ${booking.customerName},`,
    '',
    copy.intro,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    copy.change,
    `WhatsApp: ${context.whatsappUrl}`,
    `E-mail: ${context.ownerEmail}`,
    '',
    copy.closing,
    'Relax Bridge',
  ].join('\n');

  return { subject, html, text };
}

export function buildOwnerBookingEmail(
  booking: BookingEmailDetails,
  context: BookingEmailContext,
): BookingEmailMessage {
  const formatted = formatDetails(booking, context.timeZone);
  const location = booking.category === 'home'
    ? booking.homeAddress || 'Otthoni kezelés – cím nincs megadva'
    : context.studioAddress || 'Relax Bridge stúdió, Tilburg';
  const subject = `Új foglalás · ${formatted.shortDate} ${formatted.startTime} · ${booking.customerName}`;
  const rows = [
    ['Vendég', booking.customerName],
    ['Kezelés', booking.serviceTitle],
    ['Típus', booking.category === 'home' ? 'Home service' : 'Stúdió'],
    ['Dátum', formatted.date],
    ['Időpont', `${formatted.startTime}–${formatted.endTime}`],
    ['Időtartam', `${booking.durationMinutes} perc`],
    ['Ár', formatted.price],
    ['Helyszín', location],
    ['Telefon', booking.customerPhone],
    ['E-mail', booking.customerEmail],
    ['Foglalási azonosító', booking.reference],
  ] as const;
  const notes = booking.notes
    ? `<p style="margin:24px 0 0"><strong>Megjegyzés</strong><br><span style="color:#625f56;line-height:1.6">${escapeHtml(booking.notes)}</span></p>`
    : '';

  const html = emailShell(`
    <p style="margin:0 0 8px;color:#a85030;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Új végleges foglalás</p>
    <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:28px">${escapeHtml(booking.customerName)}</h1>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #ded4c4;border-radius:12px">
      ${rows.map(([label, value]) => detailRow(label, value)).join('')}
    </table>
    ${notes}
  `, 'hu');

  const text = [
    'Új végleges foglalás',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(booking.notes ? ['', `Megjegyzés: ${booking.notes}`] : []),
  ].join('\n');

  return { subject, html, text };
}
