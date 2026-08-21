import { randomUUID } from 'node:crypto';
import type { Locale } from '../../data/site';
import type { QuestionnaireAnswers } from '../questionnaire/model';
import { getDatabase } from './db';
import { ensureQuestionnaireSchema } from './questionnaire-schema';

export interface QuestionnaireResponseRow {
  id: string;
  locale: Locale;
  answers: QuestionnaireAnswers;
  created_at: Date | string;
}

async function deleteExpiredQuestionnaireResponses(): Promise<void> {
  await getDatabase()`
    DELETE FROM questionnaire_responses
    WHERE created_at < now() - interval '2 years'
  `;
}

export async function createQuestionnaireResponse(input: {
  locale: Locale;
  answers: QuestionnaireAnswers;
}): Promise<void> {
  await ensureQuestionnaireSchema();
  const database = getDatabase();
  await deleteExpiredQuestionnaireResponses();
  const answersJson = {
    situations: input.answers.situations,
    ...(input.answers.situationsOther ? { situationsOther: input.answers.situationsOther } : {}),
    priorities: input.answers.priorities,
    ...(input.answers.prioritiesOther ? { prioritiesOther: input.answers.prioritiesOther } : {}),
    timing: input.answers.timing,
    homeService: input.answers.homeService,
  };
  await database`
    INSERT INTO questionnaire_responses (id, locale, answers)
    VALUES (${randomUUID()}, ${input.locale}, ${database.json(answersJson)})
  `;
}

export async function listQuestionnaireResponses(): Promise<QuestionnaireResponseRow[]> {
  await ensureQuestionnaireSchema();
  const database = getDatabase();
  await deleteExpiredQuestionnaireResponses();
  return database<QuestionnaireResponseRow[]>`
    SELECT id, locale, answers, created_at
    FROM questionnaire_responses
    ORDER BY created_at DESC
  `;
}
