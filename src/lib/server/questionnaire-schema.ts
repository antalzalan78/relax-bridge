import { getDatabase } from './db';

let schemaPromise: Promise<void> | undefined;

async function createQuestionnaireSchema(): Promise<void> {
  const database = getDatabase();
  await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(734052026)`;
    await transaction`
      CREATE TABLE IF NOT EXISTS questionnaire_responses (
        id uuid PRIMARY KEY,
        locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
        answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await transaction`
      CREATE INDEX IF NOT EXISTS questionnaire_responses_created_idx
      ON questionnaire_responses (created_at DESC)
    `;
  });
}

export function ensureQuestionnaireSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createQuestionnaireSchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
