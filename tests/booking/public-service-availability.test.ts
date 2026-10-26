import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  homeServiceBookingEnabled,
  isPublicBookingCategoryEnabled,
} from '../../src/lib/booking/public-service-availability.ts';

test('Home Service public booking is paused while Studio Visit remains bookable', () => {
  assert.equal(homeServiceBookingEnabled, false);
  assert.equal(isPublicBookingCategoryEnabled('home'), false);
  assert.equal(isPublicBookingCategoryEnabled('studio'), true);
});
