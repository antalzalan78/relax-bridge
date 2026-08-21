import { z } from 'zod';

export const situationKeys = [
  'relaxation',
  'stress',
  'pain',
  'regular',
  'never',
  'other',
] as const;

export const priorityKeys = [
  'choice',
  'personalized',
  'short_notice',
  'other',
] as const;

export const timingKeys = [
  'weekday_morning',
  'weekday_early_afternoon',
  'weekday_late_afternoon',
  'weekday_evening',
  'weekend_morning',
  'weekend_early_afternoon',
  'weekend_late_afternoon',
  'weekend_evening',
] as const;

export const homeServiceKeys = ['yes', 'occasionally', 'probably_not', 'no'] as const;

export type SituationKey = (typeof situationKeys)[number];
export type PriorityKey = (typeof priorityKeys)[number];
export type TimingKey = (typeof timingKeys)[number];
export type HomeServiceKey = (typeof homeServiceKeys)[number];

const uniqueValues = <T>(values: T[]) => new Set(values).size === values.length;

export const questionnaireSubmissionSchema = z
  .object({
    locale: z.enum(['nl', 'en', 'hu']),
    situations: z.array(z.enum(situationKeys)).min(1).max(situationKeys.length).refine(uniqueValues),
    situationsOther: z.string().trim().max(300).optional(),
    priorities: z.array(z.enum(priorityKeys)).min(1).max(priorityKeys.length).refine(uniqueValues),
    prioritiesOther: z.string().trim().max(300).optional(),
    timing: z.array(z.enum(timingKeys)).min(1).max(timingKeys.length).refine(uniqueValues),
    homeService: z.enum(homeServiceKeys),
    website: z.string().max(0).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.situations.includes('other') && (!value.situationsOther || value.situationsOther.length < 2)) {
      context.addIssue({
        code: 'custom',
        path: ['situationsOther'],
        message: 'Other answer is required.',
      });
    }
    if (value.priorities.includes('other') && (!value.prioritiesOther || value.prioritiesOther.length < 2)) {
      context.addIssue({
        code: 'custom',
        path: ['prioritiesOther'],
        message: 'Other answer is required.',
      });
    }
  })
  .transform((value) => ({
    locale: value.locale,
    situations: value.situations,
    situationsOther: value.situations.includes('other') ? value.situationsOther : undefined,
    priorities: value.priorities,
    prioritiesOther: value.priorities.includes('other') ? value.prioritiesOther : undefined,
    timing: value.timing,
    homeService: value.homeService,
  }));

export type QuestionnaireSubmission = z.infer<typeof questionnaireSubmissionSchema>;
export interface QuestionnaireAnswers {
  situations: SituationKey[];
  situationsOther?: string;
  priorities: PriorityKey[];
  prioritiesOther?: string;
  timing: TimingKey[];
  homeService: HomeServiceKey;
}
