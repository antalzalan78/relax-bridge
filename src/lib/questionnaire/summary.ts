import type { Locale } from '../../data/site';
import {
  homeServiceKeys,
  priorityKeys,
  situationKeys,
  timingKeys,
  type QuestionnaireAnswers,
} from './model.ts';

export interface QuestionnaireSummaryRow {
  locale: Locale;
  answers: QuestionnaireAnswers;
  created_at: Date | string;
}

const emptyCounts = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

function collectOther(values: Map<string, { text: string; count: number }>, text?: string) {
  const clean = text?.trim();
  if (!clean) return;
  const key = clean.toLocaleLowerCase('hu-HU');
  const existing = values.get(key);
  if (existing) existing.count += 1;
  else values.set(key, { text: clean, count: 1 });
}

export function summarizeQuestionnaire(
  rows: QuestionnaireSummaryRow[],
  now = new Date(),
) {
  const situations = emptyCounts(situationKeys);
  const priorities = emptyCounts(priorityKeys);
  const timing = emptyCounts(timingKeys);
  const homeService = emptyCounts(homeServiceKeys);
  const locales: Record<Locale, number> = { nl: 0, en: 0, hu: 0 };
  const situationOther = new Map<string, { text: string; count: number }>();
  const priorityOther = new Map<string, { text: string; count: number }>();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  let last30Days = 0;
  let latest: Date | null = null;

  for (const row of rows) {
    locales[row.locale] += 1;
    for (const key of row.answers.situations) if (key in situations) situations[key] += 1;
    for (const key of row.answers.priorities) if (key in priorities) priorities[key] += 1;
    for (const key of row.answers.timing) if (key in timing) timing[key] += 1;
    if (row.answers.homeService in homeService) homeService[row.answers.homeService] += 1;
    collectOther(situationOther, row.answers.situationsOther);
    collectOther(priorityOther, row.answers.prioritiesOther);

    const created = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
    if (!Number.isNaN(created.getTime())) {
      if (created.getTime() >= thirtyDaysAgo) last30Days += 1;
      if (!latest || created > latest) latest = created;
    }
  }

  const sortedOther = (values: Map<string, { text: string; count: number }>) =>
    [...values.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'hu-HU'));

  return {
    total: rows.length,
    last30Days,
    latest,
    locales,
    situations,
    priorities,
    timing,
    homeService,
    situationOther: sortedOther(situationOther),
    priorityOther: sortedOther(priorityOther),
  };
}

export type QuestionnaireSummary = ReturnType<typeof summarizeQuestionnaire>;
