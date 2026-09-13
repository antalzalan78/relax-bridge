import type { BookingOption } from './types';

export const homeServiceMaximumGuests = 3;
export const homeServiceMinimumMinutes = 60;
export const homeServiceMaximumMinutes = 180;
export const homeServicePreparationMinutes = 15;
export const homeServiceTravelFeeEur = 15;

export type HomeServiceTreatment = Pick<
  BookingOption,
  'key' | 'minutes'
>;

export interface HomeServiceCalculation {
  treatmentMinutes: number;
  preparationMinutes: number;
  reservedMinutes: number;
}

export function calculateHomeServicePrice(
  treatmentPricesEur: number[],
): number | null {
  if (
    treatmentPricesEur.length < 1 ||
    treatmentPricesEur.length > homeServiceMaximumGuests ||
    treatmentPricesEur.some((price) => !Number.isFinite(price) || price < 0)
  ) {
    return null;
  }

  return (
    treatmentPricesEur.reduce((total, price) => total + price, 0) +
    homeServiceTravelFeeEur
  );
}

export function calculateHomeServiceSelection(
  treatments: HomeServiceTreatment[],
): HomeServiceCalculation | null {
  if (
    treatments.length < 1 ||
    treatments.length > homeServiceMaximumGuests
  ) {
    return null;
  }

  const valid = treatments.every(
    (treatment) =>
      (treatment.key === 'relax' && [60, 90].includes(treatment.minutes)) ||
      (treatment.key === 'neck-shoulder-back' && [30, 60].includes(treatment.minutes)),
  );
  if (!valid) return null;

  const treatmentMinutes = treatments.reduce(
    (total, treatment) => total + treatment.minutes,
    0,
  );
  if (
    treatmentMinutes < homeServiceMinimumMinutes ||
    treatmentMinutes > homeServiceMaximumMinutes
  ) {
    return null;
  }

  const preparationMinutes =
    (treatments.length - 1) * homeServicePreparationMinutes;

  return {
    treatmentMinutes,
    preparationMinutes,
    reservedMinutes: treatmentMinutes + preparationMinutes,
  };
}
