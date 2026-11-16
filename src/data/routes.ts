import type { Locale } from './site';

/** Az aktiv studio-kezelesek URL-szegmense nyelvenkent. */
export const categoryPath: Record<Locale, Record<'studio', string>> = {
  nl: { studio: 'massage' },
  en: { studio: 'massage' },
  hu: { studio: 'masszazs' },
};

/**
 * A fooldal szakaszainak azonositoi. Nyelvfuggetlenek: a horgony nem jelenik
 * meg a keresoben, viszont igy a nyelvvalto ugyanarra a szakaszra tud ugrani.
 */
export const anchors = {
  choice: 'choice',
  services: 'behandelingen',
  prices: 'prijzen',
  contact: 'contact',
} as const;
