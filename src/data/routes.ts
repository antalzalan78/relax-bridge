import type { Locale } from './site';

/** A kategoria URL-szegmense nyelvenkent. */
export const categoryPath: Record<Locale, Record<'studio' | 'home', string>> = {
  nl: { studio: 'massage', home: 'home-service' },
  en: { studio: 'massage', home: 'home-service' },
  hu: { studio: 'masszazs', home: 'hazhoz' },
};

/**
 * A fooldal szakaszainak azonositoi. Nyelvfuggetlenek: a horgony nem jelenik
 * meg a keresoben, viszont igy a nyelvvalto ugyanarra a szakaszra tud ugrani.
 */
export const anchors = {
  services: 'behandelingen',
  prices: 'prijzen',
  contact: 'contact',
} as const;
