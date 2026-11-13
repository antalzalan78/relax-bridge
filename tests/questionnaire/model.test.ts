import assert from 'node:assert/strict';
import test from 'node:test';
import { questionnaireSubmissionSchema } from '../../src/lib/questionnaire/model.ts';

const valid = {
  locale: 'hu',
  situations: ['relaxation'],
  priorities: ['personalized'],
  timing: ['weekday_morning'],
  website: '',
};

test('accepts a minimal anonymous questionnaire response', () => {
  const parsed = questionnaireSubmissionSchema.parse(valid);
  assert.equal(parsed.locale, 'hu');
  assert.deepEqual(parsed.situations, ['relaxation']);
  assert.equal(parsed.homeService, undefined);
  assert.equal('website' in parsed, false);
});

test('accepts the former Home Service answer on existing clients', () => {
  const parsed = questionnaireSubmissionSchema.parse({ ...valid, homeService: 'occasionally' });
  assert.equal(parsed.homeService, 'occasionally');
});

test('requires text when an Other option is selected', () => {
  const parsed = questionnaireSubmissionSchema.safeParse({
    ...valid,
    situations: ['other'],
  });
  assert.equal(parsed.success, false);
});

test('drops unused free text and rejects duplicate choices', () => {
  const parsed = questionnaireSubmissionSchema.parse({
    ...valid,
    situationsOther: 'not selected',
  });
  assert.equal(parsed.situationsOther, undefined);

  const duplicate = questionnaireSubmissionSchema.safeParse({
    ...valid,
    timing: ['weekday_morning', 'weekday_morning'],
  });
  assert.equal(duplicate.success, false);
});

test('rejects submissions filled by the honeypot', () => {
  const parsed = questionnaireSubmissionSchema.safeParse({ ...valid, website: 'spam.example' });
  assert.equal(parsed.success, false);
});
