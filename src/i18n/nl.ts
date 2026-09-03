export default {
  htmlLang: 'nl-NL',

  meta: {
    title: 'Relax Bridge — Massage in Tilburg | Studio & aan huis',
    description:
      'Ontspanningsmassage, nek-schouder-rugmassage, gezichts- en voetmassage in Tilburg. Kom naar de studio of ik kom met de fiets bij je thuis. Vanaf € 40.',
  },

  tagline: 'De brug tussen spanning en ontspanning.',

  accessibility: {
    skipToContent: 'Direct naar de inhoud',
  },

  nav: {
    home: 'Home',
    services: 'Services',
    studio: 'Studio Visit',
    homeService: 'Home service',
    prices: 'Prijzen',
    about: 'Over mij',
    contact: 'Contact',
    questionnaire: 'Vragenlijst',
    bookingsOpen: 'Boekingen geopend',
    bookingsOpenShort: 'Open',
    bookingsToday: 'Vandaag plek beschikbaar',
    bookingsTodayShort: 'Vandaag',
    bookingsNext: 'Volgende plek: {day}',
    bookingsNextShort: '{day}',
    bookingsNone: 'Geen vrije momenten',
    bookingsNoneShort: 'Vol',
    menu: 'Menu',
    language: 'Taal',
  },

  hero: {
    title: 'Massage in Tilburg',
    intro:
      'Even helemaal tot rust komen in mijn rustige studio in Tilburg. Liever in je eigen omgeving? Home service is ook mogelijk.',
    primaryCta: 'Afspraak maken',
    secondaryCta: 'Bekijk de prijzen',
  },

  heroProfile: {
    name: 'Brigitta',
    role: 'Massagetherapeut',
  },

  images: {
    profile:
      'Portret van de masseuse van Relax Bridge, zittend op een bankje in het bos.',
    studio:
      'De massageruimte van Relax Bridge in Tilburg, met massagetafel, handdoeken en massageolie.',
    homeService:
      'De fiets met de aanhanger waarin de massagetafel meegaat naar je huis.',
  },

  options: {
    studio: {
      label: 'Studio Visit',
      title: 'Je bent welkom bij mij thuis.',
      body: 'Een rustige plek in Tilburg waar je niets hoeft te doen.',
      subtitle:
        'Kies uit vier behandelingen, of stel je eigen behandeling samen met de Massage Creator.',
      cta: 'Bekijk de behandelingen',
      bookingCta: 'Studio Visit reserveren',
      personalization: {
        title: 'Massage Creator',
        intro:
          'Met een paar kleine details maak je jouw Studio Visit nog persoonlijker. Je kunt deze tijdens het reserveren kiezen.',
        items: [
          {
            title: 'Geur',
            body: 'Kies een geur die je prettig vindt, of vraag om een geurloze behandeling.',
          },
          {
            title: 'Muziek',
            body: 'Kies muziek die bij je stemming past, luister naar je eigen muziek of geniet van de massage in volledige stilte.',
          },
          {
            title: 'Bio & vegan',
            body: 'De behandeling is ook mogelijk met biologische en veganistische massageolie.',
          },
        ],
      },
    },
    homeService: {
      label: 'Home service',
      title: 'Ik kom met de fiets bij je thuis.',
      body: 'In Tilburg en Reeshof. De prijs is inclusief reistijd, voorbereiding en de behandeling.',
      cta: 'Bekijk de behandelingen',
      bookingCta: 'Home service reserveren',
    },
  },

  prices: {
    heading: 'Prijzen',
    intro: 'Betalen gebeurt na de behandeling met pin.',
    duration: 'Duur',
    price: 'Prijs',
    minutes: 'minuten',
    from: 'vanaf',
    studioHeading: 'Studio Visit',
    homeHeading: 'Home service',
  },

  goodToKnow: {
    heading: 'Goed om te weten',
    items: [
      {
        title: 'Afspraak maken',
        body: 'Kies bij Studio Visit of Home service het gewenste type massage en selecteer een geschikt tijdstip. Liever persoonlijk contact? Stuur me gerust een WhatsApp-bericht. Past het toch niet? Laat het me weten om je afspraak te wijzigen of te annuleren.',
      },
      {
        title: 'Prijzen en betaling',
        body: 'De betaling vindt plaats na de behandeling en kan eenvoudig met pin op locatie worden gedaan. Ook bij Home service is betalen met pin mogelijk.',
      },
      {
        title: 'Home service',
        body: 'Ik kom bij je thuis en neem alles mee wat nodig is — jij hoeft alleen maar te ontspannen. De prijs is inclusief reistijd, voorbereiding en de behandeling. Ik vraag je om je exacte adres en telefoonnummer, zodat ik je makkelijk kan bereiken. Let op: bij Home service zijn kortere behandelingen niet beschikbaar.',
      },
      {
        title: 'Korte vragenlijst',
        body: 'Welke momenten en mogelijkheden zijn voor jou belangrijk bij het boeken van een massage? Met vier korte, anonieme vragen help je mij het aanbod van Relax Bridge beter te laten aansluiten.',
      },
    ],
    questionnaireCta: 'Vul de vragenlijst in',
  },

  service: {
    pricesHeading: 'Prijzen',
    bookCta: 'Afspraak maken',
    whatsappCta: 'Vraag stellen via WhatsApp',
    backToAll: 'Alle behandelingen',
    studioBadge: 'In de studio, Tilburg',
    homeBadge: 'Bij je thuis, Tilburg en Reeshof',
    otherServices: 'Andere behandelingen',
  },

  contact: {
    heading: 'Contact',
    intro:
      'Een vraag, of meteen een afspraak maken? WhatsApp is de snelste manier om me te bereiken.',
    whatsapp: 'WhatsApp',
    whatsappCta: 'Stuur een WhatsApp-bericht',
    googleReview: 'Google-beoordeling',
    googleReviewCta: 'Schrijf een Google-beoordeling',
    email: 'E-mail',
    area: 'Werkgebied',
    areaBody: 'Studio in Tilburg. Home service in Tilburg en Reeshof.',
    follow: 'Volg me',
    playlists: 'Mijn playlists',
  },

  footer: {
    rights: 'Alle rechten voorbehouden.',
    cookies: 'Cookiebeleid',
    privacy: 'Privacyverklaring',
  },
} as const;
