import type { BookingCategory } from './types';

// Historical Home Service records still exist; public availability is studio-only.
export function isPublicBookingCategoryEnabled(category: BookingCategory): boolean {
  return category === 'studio';
}
