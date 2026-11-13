import type { BookingCategory } from './types';

// Retired service: preserve legacy booking records, but never accept new public bookings.
export const homeServiceBookingEnabled = false;

export function isPublicBookingCategoryEnabled(category: BookingCategory): boolean {
  return category === 'studio';
}
