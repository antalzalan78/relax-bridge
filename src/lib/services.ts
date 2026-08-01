import { getCollection, type CollectionEntry } from 'astro:content';
import { locales, pathFor, type Locale } from '../data/site';
import { categoryPath } from '../data/routes';

export type Service = CollectionEntry<'services'>;
export type Category = 'studio' | 'home';

/** Egy kezeles utvonala adott nyelven. */
export function servicePath(
  locale: Locale,
  category: Category,
  slug: string,
): string {
  return pathFor(locale, `${categoryPath[locale][category]}/${slug}`);
}

/** Egy nyelv kezelesei, sorrendben. Kategoriara szurheto. */
export async function getServices(
  locale: Locale,
  category?: Category,
): Promise<Service[]> {
  const all = await getCollection('services');
  return all
    .filter((s) => s.data.lang === locale)
    .filter((s) => (category ? s.data.category === category : true))
    .sort((a, b) => a.data.order - b.data.order);
}

/**
 * Ugyanannak a kezelesnek az utvonala mind a harom nyelven.
 * Ebbol keszul a hreflang es a nyelvvalto — a regi oldalon a nyelvvalto mindig
 * a fooldalra dobta vissza a latogatot.
 */
export async function serviceAlternates(
  key: Service['data']['key'],
  category: Category,
): Promise<Partial<Record<Locale, string>>> {
  const all = await getCollection('services');
  const out: Partial<Record<Locale, string>> = {};

  for (const locale of locales) {
    const match = all.find(
      (s) =>
        s.data.lang === locale &&
        s.data.key === key &&
        s.data.category === category,
    );
    if (match) {
      out[locale] = servicePath(locale, category, match.data.slug);
    }
  }

  return out;
}

/** A fooldalak utvonala minden nyelven. */
export function homeAlternates(): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, pathFor(l)])) as Record<
    Locale,
    string
  >;
}

/** A legolcsobb ar — a "vanaf / from / mar ... -tol" felirathoz. */
export function lowestPrice(services: Service[]): number | null {
  const all = services.flatMap((s) => s.data.prices.map((p) => p.eur));
  return all.length ? Math.min(...all) : null;
}
