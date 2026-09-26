import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isBookingDestination,
  journeyPageKey,
  summarizeJourneySessions,
} from '../../src/lib/analytics/journey.ts';

test('maps localized public service pages to the same safe journey category', () => {
  assert.equal(journeyPageKey('/massage/nek-schouder-rugmassage'), 'studio-back');
  assert.equal(journeyPageKey('/en/massage/neck-shoulder-back-massage'), 'studio-back');
  assert.equal(journeyPageKey('/hu/masszazs/nyak-vall-hatmasszazs'), 'studio-back');
  assert.equal(journeyPageKey('/hu/booking?category=studio'), 'booking');
  assert.equal(isBookingDestination('/en/booking'), true);
  assert.equal(isBookingDestination('/en/massage-creator'), false);
});

test('does not retain arbitrary or administrative paths', () => {
  assert.equal(journeyPageKey('/admin'), null);
  assert.equal(journeyPageKey('/api/bookings'), null);
  assert.equal(journeyPageKey('/customer/private-value'), null);
  assert.equal(journeyPageKey('//external.example/path'), null);
});

test('separates unique sessions, page loads, booking clicks and confirmed bookings', () => {
  const summary = summarizeJourneySessions([
    {
      source: 'google',
      pages: ['studio-back', 'booking'],
      page_views: '2',
      booking_clicks: '1',
      bookings: '1',
    },
    {
      source: 'google',
      pages: ['studio-back', 'booking', 'booking'],
      page_views: '3',
      booking_clicks: '2',
      bookings: '1',
    },
    {
      source: 'utm:qr',
      pages: ['home'],
      page_views: '1',
      booking_clicks: '0',
      bookings: '0',
    },
  ]);

  assert.equal(summary.uniqueSessions, 3);
  assert.equal(summary.pageViews, 6);
  assert.equal(summary.bookingClicks, 3);
  assert.equal(summary.successfulBookings, 2);
  assert.equal(summary.bookingPageSessions, 2);
  assert.equal(summary.clickingSessions, 2);
  assert.equal(summary.convertingSessions, 2);
  assert.deepEqual(summary.journeys[0], {
    steps: ['google', 'studio-back', 'booking', 'booking-success'],
    sessions: 2,
  });
});

test('routes show only pages visited before booking and distinguish a click from an opened booking page', () => {
  const summary = summarizeJourneySessions([
    {
      source: 'google',
      pages: ['studio-back', 'booking', 'home'],
      page_views: 3,
      booking_clicks: 1,
      bookings: 0,
    },
    {
      source: 'utm:qr',
      pages: ['home'],
      page_views: 1,
      booking_clicks: 1,
      bookings: 0,
    },
  ]);
  assert.deepEqual(summary.journeys.map(({ steps }) => steps), [
    ['google', 'studio-back', 'booking'],
    ['utm:qr', 'home', 'booking-click'],
  ]);
});
