export const creatorMaximumMinutes = 120;

export const creatorBases = {
  relax: { minutes: 60, priceEur: 65, serviceKey: 'relax' },
  back: { minutes: 60, priceEur: 70, serviceKey: 'neck-shoulder-back' },
} as const;

export const creatorAddons = {
  back: { 30: 45 },
  face: { 15: 20, 30: 40 },
  foot: { 15: 20, 30: 40 },
} as const;

export type CreatorBase = keyof typeof creatorBases;
export type CreatorBackMinutes = 0 | 30;
export type CreatorAddonMinutes = 0 | 15 | 30;

export interface CreatorSelection {
  base: CreatorBase;
  back?: CreatorBackMinutes;
  face?: CreatorAddonMinutes;
  foot?: CreatorAddonMinutes;
}

export interface CreatorCalculation {
  base: CreatorBase;
  back: CreatorBackMinutes;
  face: CreatorAddonMinutes;
  foot: CreatorAddonMinutes;
  minutes: number;
  priceEur: number;
  serviceKey: 'relax' | 'neck-shoulder-back';
}

export function calculateCreatorSelection(selection: CreatorSelection): CreatorCalculation | null {
  const base = creatorBases[selection.base];
  if (!base) return null;

  const back = selection.back ?? 0;
  const face = selection.face ?? 0;
  const foot = selection.foot ?? 0;

  if (![0, 30].includes(back) || ![0, 15, 30].includes(face) || ![0, 15, 30].includes(foot)) {
    return null;
  }
  if (selection.base === 'back' && back !== 0) return null;

  const minutes = base.minutes + back + face + foot;
  if (minutes > creatorMaximumMinutes) return null;

  const backPrice = back === 30 ? creatorAddons.back[30] : 0;
  const facePrice = face ? creatorAddons.face[face] : 0;
  const footPrice = foot ? creatorAddons.foot[foot] : 0;

  return {
    base: selection.base,
    back,
    face,
    foot,
    minutes,
    priceEur: base.priceEur + backPrice + facePrice + footPrice,
    serviceKey: base.serviceKey,
  };
}
