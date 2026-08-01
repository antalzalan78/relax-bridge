import type { Locale } from '../data/site';
import nl from './nl';
import en from './en';
import hu from './hu';

const dictionaries = { nl, en, hu };

/** A holland szotar adja a tipust — a masik ketto ugyanezt a szerkezetet koveti. */
export type Dictionary = typeof nl;

export function t(locale: Locale): Dictionary {
  return dictionaries[locale] as unknown as Dictionary;
}
