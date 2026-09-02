/**
 * Minden elerhetoseg EGY helyen.
 *
 * A regi oldalon a telefonszam es az e-mail cim szet volt szorva, es ket hibas
 * valtozat is bent maradt a sablonbol (info@relaxbridge.com, +31612595922).
 * Ezert van itt egyetlen forras: amit ide beirunk, az jelenik meg mindenhol.
 */

export const site = {
  name: 'Relax Bridge',
  url: 'https://www.relaxbridge.nl',

  // --- elerhetoseg ---
  phone: '+31653964923',
  phoneDisplay: '+31 6 53964923',
  whatsapp: 'https://wa.me/31653964923',
  googleReview: 'https://g.page/r/CXNtFuk0lC9HEAE/review',

  email: 'info@relaxbridge.nl' as string | null,

  // --- helyszin ---
  city: 'Tilburg',
  /** TODO: a studio pontos cime. Kell a LocalBusiness strukturalt adathoz. */
  address: null as { street: string; postalCode: string; city: string } | null,
  /** Home service lefedettseg. */
  areaServed: ['Tilburg', 'Reeshof'],

  /**
   * TODO: nyitvatartas. Formatum: ['Mo-Fr 09:00-20:00', 'Sa 10:00-16:00']
   * Amig ures, nem kerul bele a strukturalt adatba.
   */
  openingHours: [] as string[],

  // --- kozossegi media ---
  social: {
    facebook: 'https://www.facebook.com/profile.php?id=61579145392339',
    instagram: 'https://www.instagram.com/relax.bridge/',
  },

  playlists: {
    spotify: 'https://open.spotify.com/playlist/48B3JI7mVp0KF00hZtzEOF',
    youtubeMusic:
      'https://music.youtube.com/playlist?list=PL4HcFjoIe4UJcTqO5hikAMxrE524mIvdh',
  },
} as const;

export type Locale = 'nl' | 'en' | 'hu';

export const locales: Locale[] = ['nl', 'en', 'hu'];
export const defaultLocale: Locale = 'nl';

export const localeNames: Record<Locale, string> = {
  nl: 'Nederlands',
  en: 'English',
  hu: 'Magyar',
};

/** A <html lang="..."> es a hreflang ertekei. */
export const localeTags: Record<Locale, string> = {
  nl: 'nl-NL',
  en: 'en',
  hu: 'hu-HU',
};

/** Egy utvonal eleje az adott nyelven: '' | '/en' | '/hu' */
export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}

/** Nyelvfuggetlen ut -> teljes utvonal. pathFor('en', 'massage/relax-massage') */
export function pathFor(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  const prefix = localePrefix(locale);
  if (!clean) return prefix || '/';
  return `${prefix}/${clean}`;
}

/** A sajat foglalasi oldal teljes, lokalizalt utvonala. */
export function bookingPath(locale: Locale): string {
  return pathFor(locale, 'booking');
}

/** A Studio Visit kezelési mód választóoldala. */
export function studioVisitBookingPath(locale: Locale): string {
  return pathFor(locale, 'studio-visit');
}

/** A Studio Visit Massage Creator lépésenkénti összeállítója. */
export function massageCreatorPath(locale: Locale): string {
  return pathFor(locale, 'massage-creator');
}

/** A lokalizalt adatvedelmi tajekoztato utvonala. */
export function privacyPath(locale: Locale): string {
  return pathFor(locale, 'privacy');
}

/** A kerdoiv nyelvenkent lokalizalt utvonala. */
export function questionnairePath(locale: Locale): string {
  if (locale === 'nl') return '/vragenlijst';
  if (locale === 'en') return '/en/questionnaire';
  return '/hu/kerdoiv';
}
