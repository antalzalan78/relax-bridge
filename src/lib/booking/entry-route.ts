import { bookingChoicePath, type Locale } from '../../data/site.ts';

/** Keep a selected treatment reachable; otherwise begin with the two current studio choices. */
export function bookingEntryRedirect(locale: Locale, url: URL): string | null {
  const params = url.searchParams;
  const category = params.get('category');
  const service = params.get('service');

  if (category !== 'home' && !service?.startsWith('home:') && (
    category === 'studio' || service?.startsWith('studio:') || params.get('creator') === '1'
  )) return null;

  const destination = new URL(bookingChoicePath(locale), url.origin);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid']) {
    const value = params.get(key);
    if (value && value.length <= 200) destination.searchParams.set(key, value);
  }
  return destination.pathname + destination.search + destination.hash;
}
