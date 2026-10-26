import type { BookingCategory } from './types';

// Keep Home Service information visible while its public online booking is paused.
export const homeServiceBookingEnabled = false;

export function isPublicBookingCategoryEnabled(category: BookingCategory): boolean {
  return category !== 'home' || homeServiceBookingEnabled;
}
