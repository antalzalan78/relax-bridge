import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingEntryRedirect } from '../../src/lib/booking/entry-route.ts';

test('the former one-choice booking page goes straight to Studio Visit in each language', () => {
  assert.equal(bookingEntryRedirect('nl', new URL('https://www.relaxbridge.nl/booking')), '/studio-visit');
  assert.equal(bookingEntryRedirect('en', new URL('https://www.relaxbridge.nl/en/booking')), '/en/studio-visit');
  assert.equal(bookingEntryRedirect('hu', new URL('https://www.relaxbridge.nl/hu/booking')), '/hu/studio-visit');
});

test('existing ready-treatment and Massage Creator links still open the booking form', () => {
  assert.equal(bookingEntryRedirect('nl', new URL('https://www.relaxbridge.nl/booking?category=studio')), null);
  assert.equal(bookingEntryRedirect('en', new URL('https://www.relaxbridge.nl/en/booking?service=studio:relax:60')), null);
  assert.equal(bookingEntryRedirect('hu', new URL('https://www.relaxbridge.nl/hu/booking?creator=1&base=relax')), null);
});

test('retired Home Service links go to Studio Visit and campaign labels survive', () => {
  assert.equal(
    bookingEntryRedirect('nl', new URL('https://www.relaxbridge.nl/booking?category=home&utm_source=instagram&utm_medium=organic_social')),
    '/studio-visit?utm_source=instagram&utm_medium=organic_social',
  );
  assert.equal(
    bookingEntryRedirect('en', new URL('https://www.relaxbridge.nl/en/booking?category=studio&service=home:relax')),
    '/en/studio-visit',
  );
});
