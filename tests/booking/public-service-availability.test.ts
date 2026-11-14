import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPublicBookingCategoryEnabled } from '../../src/lib/booking/public-service-availability.ts';

test('Retired Home Service cannot be booked while Studio Visit remains bookable', () => {
  assert.equal(isPublicBookingCategoryEnabled('home'), false);
  assert.equal(isPublicBookingCategoryEnabled('studio'), true);
});
