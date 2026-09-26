export type JourneyEventType = 'page_view' | 'booking_click' | 'booking_success';

export interface JourneySessionRow {
  source: string;
  pages: string[] | null;
  page_views: number | string;
  booking_clicks: number | string;
  bookings: number | string;
}

export interface JourneySummary {
  uniqueSessions: number;
  pageViews: number;
  bookingClicks: number;
  successfulBookings: number;
  bookingPageSessions: number;
  clickingSessions: number;
  convertingSessions: number;
  journeys: Array<{ steps: string[]; sessions: number }>;
}

const localizedPagePaths: Record<string, string> = {
  '/': 'home',
  '/booking': 'booking',
  '/studio-visit': 'studio-visit',
  '/massage-creator': 'massage-creator',
  '/privacy': 'privacy',
  '/vragenlijst': 'questionnaire',
  '/questionnaire': 'questionnaire',
  '/kerdoiv': 'questionnaire',
  '/massage/relaxmassage': 'studio-relax',
  '/massage/relax-massage': 'studio-relax',
  '/masszazs/relaxmasszazs': 'studio-relax',
  '/massage/nek-schouder-rugmassage': 'studio-back',
  '/massage/neck-shoulder-back-massage': 'studio-back',
  '/masszazs/nyak-vall-hatmasszazs': 'studio-back',
  '/massage/gezichtsmassage': 'studio-face',
  '/massage/facial-massage': 'studio-face',
  '/masszazs/arcmasszazs': 'studio-face',
  '/massage/voetmassage': 'studio-foot',
  '/massage/foot-massage': 'studio-foot',
  '/masszazs/talpmasszazs': 'studio-foot',
  '/home-service/relaxmassage': 'home-relax',
  '/home-service/relax-massage': 'home-relax',
  '/hazhoz/relaxmasszazs': 'home-relax',
  '/home-service/nek-schouder-rugmassage': 'home-back',
  '/home-service/neck-shoulder-back-massage': 'home-back',
  '/hazhoz/nyak-vall-hatmasszazs': 'home-back',
};

/** Store only known public page categories, never free-form URLs or query values. */
export function journeyPageKey(value: string): string | null {
  const path = value.trim().toLowerCase().split(/[?#]/, 1)[0]
    .replace(/\/+$/, '') || '/';
  if (!path.startsWith('/') || path.includes('//')) return null;
  const withoutLocale = path.replace(/^\/(en|hu)(?=\/|$)/, '') || '/';
  return localizedPagePaths[withoutLocale] ?? null;
}

export function isBookingDestination(value: string): boolean {
  return journeyPageKey(value) === 'booking';
}

export function summarizeJourneySessions(rows: JourneySessionRow[]): JourneySummary {
  const journeys = new Map<string, { steps: string[]; sessions: number }>();
  const summary: JourneySummary = {
    uniqueSessions: rows.length,
    pageViews: 0,
    bookingClicks: 0,
    successfulBookings: 0,
    bookingPageSessions: 0,
    clickingSessions: 0,
    convertingSessions: 0,
    journeys: [],
  };

  for (const row of rows) {
    const pageViews = Number(row.page_views) || 0;
    const clicks = Number(row.booking_clicks) || 0;
    const bookings = Number(row.bookings) || 0;
    const pages = (row.pages ?? []).filter((page) => page !== 'privacy' && page !== 'questionnaire');
    const distinctPages = pages.filter((page, index) => page !== pages[index - 1]);
    const sawBooking = distinctPages.includes('booking');

    summary.pageViews += pageViews;
    summary.bookingClicks += clicks;
    summary.successfulBookings += bookings;
    if (sawBooking) summary.bookingPageSessions += 1;
    if (clicks > 0) summary.clickingSessions += 1;
    if (bookings > 0) summary.convertingSessions += 1;

    const bookingIndex = distinctPages.indexOf('booking');
    const firstPages = (bookingIndex >= 0 ? distinctPages.slice(0, bookingIndex) : distinctPages).slice(0, 2);
    const steps = [row.source || 'direct', ...firstPages];
    if (sawBooking) steps.push('booking');
    else if (clicks > 0) steps.push('booking-click');
    if (bookings > 0) steps.push('booking-success');
    const key = JSON.stringify(steps);
    const current = journeys.get(key);
    if (current) current.sessions += 1;
    else journeys.set(key, { steps, sessions: 1 });
  }

  summary.journeys = [...journeys.values()]
    .sort((a, b) => b.sessions - a.sessions || a.steps.join(' → ').localeCompare(b.steps.join(' → ')))
    .slice(0, 10);
  return summary;
}
