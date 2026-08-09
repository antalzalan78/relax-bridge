import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCustomerBookingEmail,
  buildOwnerBookingEmail,
  type BookingEmailContext,
  type BookingEmailDetails,
} from '../../src/lib/booking/email-templates.ts';

const context: BookingEmailContext = {
  ownerEmail: 'info@relaxbridge.nl',
  studioAddress: 'Teststraat 1, Tilburg',
  timeZone: 'Europe/Amsterdam',
  whatsappUrl: 'https://wa.me/31653964923',
};

const booking: BookingEmailDetails = {
  id: 'd68c17b8-3d8e-4b0c-93f8-76b41086f171',
  reference: 'RB-20260811-ABC123',
  serviceTitle: 'Relax Massage',
  category: 'studio',
  durationMinutes: 60,
  priceEur: 65,
  customerName: 'Anna & Co',
  customerEmail: 'anna@example.com',
  customerPhone: '+31 6 12345678',
  locale: 'nl',
  startsAt: '2026-08-11T08:00:00Z',
  endsAt: '2026-08-11T09:00:00Z',
};

test('builds a localized customer confirmation with escaped HTML', () => {
  const message = buildCustomerBookingEmail(booking, context);
  assert.match(message.subject, /bevestigd/i);
  assert.match(message.text, /Teststraat 1, Tilburg/);
  assert.match(message.text, /RB-20260811-ABC123/);
  assert.match(message.html, /Anna &amp; Co/);
  assert.doesNotMatch(message.html, /Anna & Co/);
});

test('includes the home address in a Hungarian confirmation', () => {
  const message = buildCustomerBookingEmail({
    ...booking,
    locale: 'hu',
    category: 'home',
    homeAddress: 'Tilburg <centrum>',
  }, context);
  assert.match(message.subject, /visszaigazolása/i);
  assert.match(message.text, /Tilburg <centrum>/);
  assert.match(message.html, /Tilburg &lt;centrum&gt;/);
});

test('builds the owner notification with customer contact details', () => {
  const message = buildOwnerBookingEmail({ ...booking, notes: 'Első alkalom.' }, context);
  assert.match(message.subject, /Új foglalás/);
  assert.match(message.text, /anna@example.com/);
  assert.match(message.text, /Első alkalom/);
});
