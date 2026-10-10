import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { Temporal } from '@js-temporal/polyfill';
import ts from 'typescript';
import * as journey from '../../src/lib/analytics/journey.ts';
import * as model from '../../src/lib/analytics/model.ts';

function loadModule(path: string, dependencies: Record<string, unknown>): Record<string, (...args: any[]) => Promise<any>> {
  const code = ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, process: { env: { BOOKING_TIME_ZONE: 'Europe/Amsterdam' } }, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test('real PostgreSQL migration preserves historical rows and success inherits the first event campaign', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(readFileSync(new URL('../../db/migrations/0008_website_journeys.sql', import.meta.url), 'utf8'));
    const oldId = '00000000-0000-4000-8000-000000000001';
    const campaignId = '00000000-0000-4000-8000-000000000002';
    const orphanId = '00000000-0000-4000-8000-000000000003';
    await pg.query("INSERT INTO website_journey_events (session_id, event_type, page_key, source) VALUES ($1, 'page_view', 'home', 'google')", [oldId]);
    const query = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
      return (await pg.query(sql, values)).rows;
    };
    const database = Object.assign(query, { begin: async (callback: (transaction: typeof query) => Promise<void>) => {
      await pg.exec('BEGIN');
      try { await callback(query); await pg.exec('COMMIT'); }
      catch (error) { await pg.exec('ROLLBACK'); throw error; }
    } });
    const schema = loadModule('src/lib/server/website-analytics-schema.ts', { './db': { getDatabase: () => database } });
    await schema.ensureWebsiteAnalyticsSchema();
    // The explicit migration is safe after the automatic runtime upgrade, including reruns.
    const migration = readFileSync(new URL('../../db/migrations/0009_journey_campaigns.sql', import.meta.url), 'utf8');
    await pg.exec(migration);
    await pg.exec(migration);
    const historical = await pg.query<{ source: string; utm_campaign: string }>('SELECT source, utm_campaign FROM website_journey_events WHERE session_id = $1', [oldId]);
    assert.deepEqual(historical.rows, [{ source: 'google', utm_campaign: '' }]);

    const repository = loadModule('src/lib/server/website-analytics-repository.ts', {
      '@js-temporal/polyfill': { Temporal }, '../analytics/model': model, '../analytics/journey': journey,
      './db': { getDatabase: () => database }, './website-analytics-schema': schema,
    });
    const event = { sessionId: campaignId, eventType: 'page_view', pageKey: 'home', source: 'utm:google', utmSource: 'google', utmMedium: 'organic', utmCampaign: 'gbp', utmContent: 'website' };
    await repository.recordWebsiteJourneyEvent(event);
    await repository.recordWebsiteJourneyEvent({ ...event, pageKey: 'booking' });
    // Even if an inconsistent later client event appears, the original campaign wins.
    await repository.recordWebsiteJourneyEvent({ ...event, eventType: 'booking_click', utmCampaign: 'later' });
    await repository.recordBookingJourneySuccess(campaignId);
    await repository.recordBookingJourneySuccess(oldId);
    await repository.recordBookingJourneySuccess(orphanId);
    const saved = await pg.query<{ source: string; utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string }>(
      "SELECT source, utm_source, utm_medium, utm_campaign, utm_content FROM website_journey_events WHERE session_id = $1 AND event_type = 'booking_success'", [campaignId],
    );
    assert.deepEqual(saved.rows, [{ source: 'utm:google', utm_source: 'google', utm_medium: 'organic', utm_campaign: 'gbp', utm_content: 'website' }]);
    const summary = await repository.getWebsiteJourneySummary();
    assert.equal(summary.uniqueSessions, 3);
    assert.equal(summary.successfulBookings, 3);
    const gbp = summary.campaigns.find((item: journey.CampaignSummary) => item.utmCampaign === 'gbp');
    assert.equal(gbp.sessions, 1);
    assert.equal(gbp.bookingPageSessions, 1);
    assert.equal(gbp.successfulBookings, 1);
    assert.equal(summary.campaigns.find((item: journey.CampaignSummary) => item.source === 'direct').utmCampaign, '');
  } finally { await pg.close(); }
});
