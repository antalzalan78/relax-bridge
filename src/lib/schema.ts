import { site, localeTags, type Locale } from '../data/site';
import type { Service } from './services';

/**
 * LocalBusiness / MassageTherapy strukturalt adat.
 *
 * A regi oldalon egy ures `WebSite` sema volt — abbol a Google semmit nem tud
 * kezdeni. Ez viszont az, amibol a helyi talalat es a Terkep-megjelenes lesz.
 *
 * A cim es a nyitvatartas csak akkor kerul bele, ha a site.ts-ben ki van
 * toltve — hianyos adatot rosszabb kiadni, mint semmit.
 */
export function localBusinessSchema(locale: Locale, description: string) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    additionalType: 'https://schema.org/MassageTherapy',
    '@id': `${site.url}/#business`,
    name: site.name,
    description,
    url: site.url,
    telephone: site.phone,
    image: `${site.url}/images/relax-bridge-logo.png`,
    inLanguage: localeTags[locale],
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Debit Card, Credit Card',
    areaServed: site.areaServed.map((name) => ({ '@type': 'City', name })),
    sameAs: [site.social.facebook, site.social.instagram],
  };

  if (site.email) schema.email = site.email;

  if (site.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      postalCode: site.address.postalCode,
      addressLocality: site.address.city,
      addressCountry: 'NL',
    };
  } else {
    // Cim nelkul legalabb a varost jelezzuk.
    schema.address = {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressCountry: 'NL',
    };
  }

  if (site.openingHours.length) {
    schema.openingHours = site.openingHours;
  }

  return schema;
}

/** Egy kezeles mint szolgaltatas, arakkal egyutt. */
export function serviceSchema(service: Service, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: service.data.title,
    name: service.data.title,
    description: service.data.summary,
    url,
    provider: { '@id': `${site.url}/#business` },
    areaServed: site.areaServed.map((name) => ({ '@type': 'City', name })),
    offers: service.data.prices.map((p) => ({
      '@type': 'Offer',
      price: p.eur,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      eligibleDuration: {
        '@type': 'QuantitativeValue',
        value: p.minutes,
        unitCode: 'MIN',
      },
    })),
  };
}

/** A "Goed om te weten" blokk kerdes-valaszkent. */
export function faqSchema(items: readonly { title: string; body: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.title,
      acceptedAnswer: { '@type': 'Answer', text: item.body },
    })),
  };
}
