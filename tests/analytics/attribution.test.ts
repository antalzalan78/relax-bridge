import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignChannel, normalizeCampaign } from '../../src/lib/analytics/attribution.ts';
import { summarizeJourneySessions } from '../../src/lib/analytics/journey.ts';

test('GBP, paid Google and paid Meta require explicit labels; historical Google is not guessed', () => {
  const gbp = normalizeCampaign({ utmSource: ' GOOGLE ', utmMedium: 'Organic', utmCampaign: 'GBP' });
  assert.equal(campaignChannel('utm:google', gbp), 'Google Cégprofil');
  assert.equal(campaignChannel('utm:google', { ...gbp, utmMedium: 'cpc' }), 'Google Ads');
  assert.equal(campaignChannel('google', normalizeCampaign({})), 'Google · nem elkülöníthető');
  assert.equal(campaignChannel('utm:google', normalizeCampaign({})), 'Google · nem elkülöníthető');
  assert.equal(campaignChannel('utm:facebook', normalizeCampaign({ utmMedium: 'paid_social' })), 'Meta hirdetés');
});

test('campaign totals cover all sessions, keep entry links separate and distinguish bookings from converting sessions', () => {
  const base = { source: 'utm:google', utm_source: 'google', utm_medium: 'organic', utm_campaign: 'gbp', utm_content: 'website', pages: ['home', 'booking', 'booking'], page_views: 3, booking_clicks: 1, bookings: 2 };
  const result = summarizeJourneySessions([
    base, { ...base, bookings: 0 }, { ...base, utm_content: 'booking', bookings: 1 },
    { ...base, utm_medium: 'cpc', utm_campaign: 'massage', bookings: 0 },
    { source: 'google', pages: ['home'], page_views: 1, booking_clicks: 0, bookings: 0 },
  ]);
  assert.equal(result.campaigns.length, 4);
  const website = result.campaigns.find((item) => item.utmCampaign === 'gbp' && item.utmContent === 'website')!;
  assert.equal(website.sessions, 2);
  assert.equal(website.bookingPageSessions, 2);
  assert.equal(website.successfulBookings, 2);
  assert.equal(website.convertingSessions, 1);
  assert.equal(result.campaigns.reduce((total, item) => total + item.sessions, 0), result.uniqueSessions);
  assert.equal(result.campaigns.reduce((total, item) => total + item.successfulBookings, 0), result.successfulBookings);
  assert.equal(summarizeJourneySessions([]).campaigns.length, 0);
});
