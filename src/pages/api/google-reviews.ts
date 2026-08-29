import type { APIRoute } from 'astro';

export const prerender = false;

type Locale = 'nl' | 'en' | 'hu';

type GoogleLocalizedText = {
  text?: string;
  languageCode?: string;
};

type GoogleReview = {
  relativePublishTimeDescription?: string;
  text?: GoogleLocalizedText;
  originalText?: GoogleLocalizedText;
  rating?: number;
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime?: string;
  googleMapsUri?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: GoogleLocalizedText;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReview[];
  reviewsUri?: string;
  googleMapsUri?: string;
};

const localeConfig: Record<Locale, { languageCode: string; regionCode: string }> = {
  nl: { languageCode: 'nl', regionCode: 'NL' },
  en: { languageCode: 'en', regionCode: 'NL' },
  hu: { languageCode: 'hu', regionCode: 'NL' },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Places content may not be cached or stored; only the Place ID is exempt.
      'cache-control': 'private, no-store, max-age=0',
    },
  });
}

function isLocale(value: string | null): value is Locale {
  return value === 'nl' || value === 'en' || value === 'hu';
}

async function findPlaceId(apiKey: string, languageCode: string, regionCode: string): Promise<string> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-fieldmask': 'places.id,places.displayName,places.websiteUri',
    },
    body: JSON.stringify({
      textQuery: 'Relax Bridge massage Tilburg Netherlands',
      languageCode,
      regionCode,
    }),
  });

  if (!response.ok) throw new Error(`Google place search failed (${response.status}).`);

  const data = (await response.json()) as { places?: GooglePlace[] };
  const place = data.places?.find((candidate) => {
    const nameMatches = candidate.displayName?.text?.toLowerCase() === 'relax bridge';
    const websiteMatches = candidate.websiteUri?.includes('relaxbridge.nl');
    return nameMatches || websiteMatches;
  });

  if (!place?.id) throw new Error('Relax Bridge Place ID was not found.');
  return place.id;
}

export const GET: APIRoute = async ({ url }) => {
  const localeParam = url.searchParams.get('locale');
  const locale: Locale = isLocale(localeParam) ? localeParam : 'nl';
  const { languageCode, regionCode } = localeConfig[locale];
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) return json({ error: 'Google reviews are not configured.' }, 503);

  try {
    const placeId = process.env.GOOGLE_PLACE_ID?.trim() ||
      (await findPlaceId(apiKey, languageCode, regionCode));
    const endpoint = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    endpoint.searchParams.set('languageCode', languageCode);
    endpoint.searchParams.set('regionCode', regionCode);

    const response = await fetch(endpoint, {
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
        'x-goog-fieldmask': [
          'id',
          'displayName',
          'rating',
          'userRatingCount',
          'reviews',
          'reviewsUri',
          'googleMapsUri',
        ].join(','),
      },
    });

    if (!response.ok) throw new Error(`Google place details failed (${response.status}).`);

    const place = (await response.json()) as GooglePlace;
    const reviews = (place.reviews || []).map((review) => ({
      author: review.authorAttribution?.displayName || '',
      authorUri: review.authorAttribution?.uri || '',
      authorPhotoUri: review.authorAttribution?.photoUri || '',
      rating: review.rating || 0,
      relativeTime: review.relativePublishTimeDescription || '',
      publishTime: review.publishTime || '',
      text: review.text?.text || review.originalText?.text || '',
      originalLanguage: review.originalText?.languageCode || '',
      displayedLanguage: review.text?.languageCode || '',
      googleMapsUri: review.googleMapsUri || place.reviewsUri || place.googleMapsUri || '',
    }));

    return json({
      placeId: place.id || placeId,
      placeName: place.displayName?.text || 'Relax Bridge',
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      reviews,
      reviewsUri: place.reviewsUri || place.googleMapsUri || '',
      order: 'relevance',
    });
  } catch (error) {
    console.error('Google reviews request failed.', error);
    return json({ error: 'Google reviews are temporarily unavailable.' }, 502);
  }
};
