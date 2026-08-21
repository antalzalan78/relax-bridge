CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id uuid PRIMARY KEY,
  locale text NOT NULL CHECK (locale IN ('nl', 'en', 'hu')),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questionnaire_responses_created_idx
  ON questionnaire_responses (created_at DESC);
