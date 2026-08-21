import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeQuestionnaire } from '../../src/lib/questionnaire/summary.ts';

test('aggregates multilingual, multi-select and free-text answers', () => {
  const summary = summarizeQuestionnaire([
    {
      locale: 'nl',
      created_at: '2026-08-20T10:00:00Z',
      answers: {
        situations: ['relaxation', 'other'],
        situationsOther: 'Meer energie',
        priorities: ['choice'],
        timing: ['weekday_morning'],
        homeService: 'yes',
      },
    },
    {
      locale: 'hu',
      created_at: '2026-07-01T10:00:00Z',
      answers: {
        situations: ['stress', 'other'],
        situationsOther: 'meer energie',
        priorities: ['choice', 'short_notice'],
        timing: ['weekday_morning', 'weekend_evening'],
        homeService: 'probably_not',
      },
    },
  ], new Date('2026-08-21T12:00:00Z'));

  assert.equal(summary.total, 2);
  assert.equal(summary.last30Days, 1);
  assert.equal(summary.locales.nl, 1);
  assert.equal(summary.locales.hu, 1);
  assert.equal(summary.situations.other, 2);
  assert.equal(summary.priorities.choice, 2);
  assert.equal(summary.timing.weekday_morning, 2);
  assert.deepEqual(summary.situationOther, [{ text: 'Meer energie', count: 2 }]);
  assert.equal(summary.latest?.toISOString(), '2026-08-20T10:00:00.000Z');
});
