export type BookingCategory = 'studio' | 'home';
export type BookingLocale = 'nl' | 'en' | 'hu';

export interface BookingSettings {
  timeZone: string;
  slotIntervalMinutes: number;
  minNoticeHours: number;
  bookingHorizonDays: number;
  studioBufferBeforeMinutes: number;
  studioBufferAfterMinutes: number;
  homeBufferBeforeMinutes: number;
  homeBufferAfterMinutes: number;
}

export interface LocalTimeWindow {
  start: string;
  end: string;
}

export interface InstantWindow {
  start: string;
  end: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
  busyStart: string;
  busyEnd: string;
  label: string;
}

export interface BookingOption {
  id: string;
  key: 'relax' | 'neck-shoulder-back' | 'facial' | 'foot';
  category: BookingCategory;
  title: string;
  minutes: number;
  /** Total time blocked in the calendar when it differs from massage time. */
  reservedMinutes?: number;
  priceEur: number;
}
