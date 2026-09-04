import { getCollection } from 'astro:content';
import type { Locale } from '../../data/site';
import type { BookingCategory, BookingOption } from './types';

export async function getBookingOptions(locale: Locale): Promise<BookingOption[]> {
  const services = await getCollection('services');

  return services
    .filter((service) => service.data.lang === locale)
    .sort((a, b) => {
      if (a.data.category !== b.data.category) {
        return a.data.category === 'studio' ? -1 : 1;
      }
      return a.data.order - b.data.order;
    })
    .flatMap((service) =>
      service.data.prices.map((price) => ({
        id: `${service.data.category}:${service.data.key}:${price.minutes}`,
        key: service.data.key,
        category: service.data.category,
        title: service.data.title,
        minutes: price.minutes,
        priceEur: price.eur,
      })),
    );
}

/** Home Service treatment prices exclude the one shared travel fee. */
export async function getHomeServiceBookingOptions(
  locale: Locale,
): Promise<BookingOption[]> {
  const options = await getBookingOptions(locale);
  return options.filter((option) => option.category === 'home');
}

export async function findBookingOption(input: {
  locale: Locale;
  key: BookingOption['key'];
  category: BookingCategory;
  minutes: number;
}): Promise<BookingOption | null> {
  const options = await getBookingOptions(input.locale);
  return (
    options.find(
      (option) =>
        option.key === input.key &&
        option.category === input.category &&
        option.minutes === input.minutes,
    ) ?? null
  );
}
