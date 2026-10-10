import { isBookingDestination } from '../lib/analytics/journey';
import { normalizeCampaign, type CampaignAttribution } from '../lib/analytics/attribution';

const liveDomain = /(^|\.)relaxbridge\.nl$/i;
const visitStorageKey = 'relax-bridge-anonymous-visit-v1';
const journeyStorageKey = 'relax-bridge-journey-v1';
const trackingAllowed = liveDomain.test(window.location.hostname)
  && navigator.doNotTrack !== '1'
  && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;

interface JourneySession extends CampaignAttribution {
  id: string;
  createdAt: number;
  referrerHost: string;
}

let journeySession: JourneySession | null = null;

function referrerHost(): string {
  try {
    return document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    return '';
  }
}

function loadSession(): JourneySession {
  const saved = window.sessionStorage.getItem(journeyStorageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<JourneySession>;
      if (
        typeof parsed.id === 'string'
        && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(parsed.id)
        && typeof parsed.createdAt === 'number'
        && Date.now() - parsed.createdAt < 24 * 60 * 60 * 1000
        && typeof parsed.referrerHost === 'string'
        && typeof parsed.utmSource === 'string'
      ) return { ...parsed, ...normalizeCampaign(parsed) } as JourneySession;
    } catch {}
  }

  const params = new URLSearchParams(window.location.search);
  const session: JourneySession = {
    id: window.crypto.randomUUID(),
    createdAt: Date.now(),
    referrerHost: referrerHost(),
    ...normalizeCampaign({
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmContent: params.get('utm_content') || '',
    }),
  };
  window.sessionStorage.setItem(journeyStorageKey, JSON.stringify(session));
  return session;
}

function recordJourneyEvent(eventType: 'page_view' | 'booking_click', pagePath: string): void {
  if (!journeySession) return;
  void fetch('/api/website-event', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: journeySession.id,
      eventType,
      pagePath,
      referrerHost: journeySession.referrerHost,
      utmSource: journeySession.utmSource,
      utmMedium: journeySession.utmMedium,
      utmCampaign: journeySession.utmCampaign,
      utmContent: journeySession.utmContent,
    }),
    keepalive: true,
  }).catch(() => {
    // Statistics must never interrupt navigation or booking.
  });
}

export function getAnalyticsSessionId(): string | undefined {
  return journeySession?.id;
}

if (trackingAllowed) {
  try {
    journeySession = loadSession();
    recordJourneyEvent('page_view', window.location.pathname);

    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href]')
        : null;
      if (!link || link.hasAttribute('data-language-link')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && isBookingDestination(destination.pathname)) {
        recordJourneyEvent('booking_click', window.location.pathname);
      }
    }, { capture: true });

    if (!window.sessionStorage.getItem(visitStorageKey)) {
      window.sessionStorage.setItem(visitStorageKey, 'pending');
      void fetch('/api/website-visit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale: document.documentElement.lang.toLowerCase().split('-')[0],
          entryPath: window.location.pathname,
          referrerHost: journeySession.referrerHost,
          utmSource: journeySession.utmSource,
        }),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error('Visit could not be recorded.');
        window.sessionStorage.setItem(visitStorageKey, 'recorded');
      }).catch(() => {
        window.sessionStorage.removeItem(visitStorageKey);
      });
    }
  } catch {
    // If session storage is unavailable, do not fall back to persistent tracking.
    journeySession = null;
  }
}
