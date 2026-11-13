import type { Locale } from '../data/site';

const pricePage = {
  nl: {
    eyebrow: 'Relax Bridge · Tarieven',
    title: 'Alle prijzen op één plek.',
    metaDescription: 'Bekijk de prijzen van Studio Visit-behandelingen en de Massage Creator in Tilburg.',
    intro: 'Een overzicht van de behandelingen in de studio en jouw eigen samenstelling met de Massage Creator.',
    categoriesLabel: 'Spring naar een categorie',
    readyHeading: 'Vaste behandelingen',
    readyIntro: 'Kies een bestaande behandeling in de studio. De prijzen gelden per persoon en per behandeling.',
    readyCta: 'Vaste behandeling reserveren',
    creatorHeading: 'Massage Creator (Studio Visit)',
    creatorIntro: 'Kies een basisbehandeling en voeg eventueel onderdelen toe. Tijdens het samenstellen zie je de totale duur en prijs.',
    baseHeading: 'Basisbehandelingen',
    addonsHeading: 'Aanvullingen',
    creatorRule: 'De totale behandeling duurt maximaal 120 minuten. De gerichte rug-, nek- en schouderaanvulling is alleen beschikbaar bij een Relaxmassage als basis; niet elke combinatie is mogelijk.',
    creatorCta: 'Stel je massage samen',
  },
  en: {
    eyebrow: 'Relax Bridge · Price list',
    title: 'All prices in one place.',
    metaDescription: 'See prices for Studio Visit treatments and the Massage Creator in Tilburg.',
    intro: 'An overview of studio treatments and a custom treatment with the Massage Creator.',
    categoriesLabel: 'Jump to a category',
    readyHeading: 'Ready-made treatments',
    readyIntro: 'Choose an existing studio treatment. Prices are per person and per treatment.',
    readyCta: 'Book a ready-made treatment',
    creatorHeading: 'Massage Creator (Studio Visit)',
    creatorIntro: 'Choose a base treatment and add optional elements. The builder shows the total duration and price as you go.',
    baseHeading: 'Base treatments',
    addonsHeading: 'Add-ons',
    creatorRule: 'The complete treatment lasts no more than 120 minutes. The focused back, neck and shoulder add-on is available only with a Relax Massage base; not every combination is possible.',
    creatorCta: 'Create your massage',
  },
  hu: {
    eyebrow: 'Relax Bridge · Árlista',
    title: 'Minden ár egy helyen.',
    metaDescription: 'A Studio Visit kezelések és a Massage Creator árai egy helyen.',
    intro: 'A stúdióban választható kész kezelések és a Massage Creator árainak áttekintése.',
    categoriesLabel: 'Ugrás a kategóriához',
    readyHeading: 'Kész kezelések',
    readyIntro: 'Válassz egy kész stúdiókezelést. Az árak személyenként és kezelésenként értendők.',
    readyCta: 'Kész kezelés foglalása',
    creatorHeading: 'Massage Creator (Studio Visit)',
    creatorIntro: 'Válassz alapkezelést, majd igény szerint kiegészítőket. Az összeállítás közben látod a teljes időtartamot és árat.',
    baseHeading: 'Alapkezelések',
    addonsHeading: 'Kiegészítők',
    creatorRule: 'A teljes kezelés legfeljebb 120 perc lehet. A célzott hát-, nyak- és vállkiegészítő csak relaxmasszázs alapkezelés mellett választható; nem minden kombináció lehetséges.',
    creatorCta: 'Saját masszázs összeállítása',
  },
} as const;

export function pricesText(locale: Locale) {
  return pricePage[locale];
}
