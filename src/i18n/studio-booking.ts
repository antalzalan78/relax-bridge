import type { Locale } from '../data/site';

const studioBooking = {
  nl: {
    eyebrow: 'Studio Visit',
    title: 'Hoe wil je je behandeling kiezen?',
    intro:
      'Kies een van de vaste behandelingen, of scroll verder en stel bij onderdeel 2 je eigen behandeling samen met de Massage Creator.',
    readyHeading: 'Vaste behandelingen',
    readyCta: 'Ik kies een vaste behandeling',
    creatorNumber: '02',
    services: {
      relax: {
        headline: 'Zachte, vloeiende bewegingen die spanning losmaken en je weer opladen.',
        detail:
          'Een goede keuze als je geen specifieke klacht hebt, maar gewoon behoefte hebt aan wat rust en ontspanning.',
      },
      'neck-shoulder-back': {
        headline: 'Gerichte, diepere technieken bij zittend werk, stress of langdurige belasting.',
        detail:
          'Tijdens de behandeling werk ik met gerichte, diepere technieken op gespannen en overbelaste spieren. De massage kan helpen spierspanning los te laten en een stijf gevoel te verminderen.',
      },
      facial: {
        headline:
          'Helpt de gezichtsspieren te ontspannen, verfrist de huid en geeft een frisser, meer uitgerust gevoel.',
        detail:
          'Vooral aanbevolen tijdens stressvolle periodes, bij vermoeidheid of wanneer je behoefte hebt aan wat extra verzorging en vernieuwing. Goed te combineren met een relaxmassage of nek-schouder-rugmassage.',
      },
      foot: {
        headline: 'Ontspannende verzorging voor vermoeide voeten en onderbenen.',
        detail:
          'Ideaal na lang staan, veel lopen of lichamelijke inspanning. Helpt vermoeide voeten en onderbenen te ontspannen en te verfrissen.',
      },
    },
  },
  en: {
    eyebrow: 'Studio Visit',
    title: 'How would you like to choose your treatment?',
    intro:
      'Choose one of the ready-made treatments, or scroll down and create your own in section 2 with the Massage Creator.',
    readyHeading: 'Ready-made treatments',
    readyCta: 'Choose a ready-made treatment',
    creatorNumber: '02',
    services: {
      relax: {
        headline: 'Gentle, flowing movements that release tension and help you recharge.',
        detail:
          'A good choice when you have no specific complaint and simply need some rest and relaxation.',
      },
      'neck-shoulder-back': {
        headline: 'Targeted, deeper techniques for desk work, stress or prolonged strain.',
        detail:
          'During the treatment I use targeted, deeper techniques on tight, overworked muscles. The massage can help release muscle tension and ease feelings of stiffness.',
      },
      facial: {
        headline:
          'Helps relax the facial muscles, refreshes the skin and leaves you looking and feeling more rested.',
        detail:
          'Especially recommended during stressful periods, when you feel tired or when you need a little extra care and renewal. It combines well with a relax massage or neck, shoulder and back massage.',
      },
      foot: {
        headline: 'Relaxing care for tired feet and lower legs.',
        detail:
          'Ideal after long periods of standing, walking or physical strain. It helps relax and refresh tired feet and lower legs.',
      },
    },
  },
  hu: {
    eyebrow: 'Studio Visit',
    title: 'Hogyan szeretnéd kiválasztani a kezelésedet?',
    intro:
      'Válassz egyet a kész kezelések közül, vagy görgess lejjebb, és a 2. menüpontban alkosd meg a sajátodat a Massage Creator segítségével.',
    readyHeading: 'Kész kezelések',
    readyCta: 'Kész kezelést választok',
    creatorNumber: '02',
    services: {
      relax: {
        headline: 'Lágy, folyamatos mozdulatok, amelyek oldják a feszültséget és feltöltenek.',
        detail:
          'Jó választás akkor, ha nincs konkrét panaszod, csak egyszerűen szükséged van egy kis pihenésre és kikapcsolódásra.',
      },
      'neck-shoulder-back': {
        headline: 'Célzott, mélyebb technikák ülőmunka, stressz vagy tartós megterhelés esetén.',
        detail:
          'A kezelés során célzott, mélyebb technikákkal dolgozom a feszes, túlterhelt izmokon. A masszázs segíthet oldani az izomfeszültséget és enyhíteni a merevségérzetet.',
      },
      facial: {
        headline:
          'Segít ellazítani az arc izmait, felfrissíti az arcbőrt, és üdébb, kipihentebb érzetet ad.',
        detail:
          'Különösen ajánlott stresszes időszakokban, fáradtság esetén, vagy amikor egy kis extra törődésre és megújulásra vágysz. Jól kombinálható relax- vagy nyak–váll–hátmasszázzsal.',
      },
      foot: {
        headline: 'Pihentető törődés a fáradt lábfejeknek és lábszáraknak.',
        detail:
          'Ideális sok állás, gyaloglás vagy fizikai megterhelés után. Segít ellazítani és felfrissíteni a fáradt lábfejeket és lábszárakat.',
      },
    },
  },
} as const;

export function studioBookingText(locale: Locale) {
  return studioBooking[locale];
}
