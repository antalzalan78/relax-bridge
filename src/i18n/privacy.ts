import type { Locale } from '../data/site';

export const privacyAuthorityUrl =
  'https://autoriteitpersoonsgegevens.nl/een-tip-of-klacht-indienen-bij-de-ap';

const privacy = {
  nl: {
    eyebrow: 'Privacy & persoonsgegevens',
    title: 'Privacyverklaring',
    metaDescription:
      'Lees welke persoonsgegevens Relax Bridge verwerkt voor afspraken, waarom dat gebeurt en welke privacyrechten je hebt.',
    intro:
      'Relax Bridge gaat zorgvuldig om met je persoonsgegevens. Hier lees je welke gegevens we verwerken wanneer je een afspraak maakt, waarom we dat doen en welke keuzes en rechten je hebt.',
    updated: 'Laatst bijgewerkt: 15 augustus 2026',
    controllerTitle: 'Wie is verantwoordelijk?',
    controllerBody:
      'Relax Bridge in Tilburg is de verwerkingsverantwoordelijke voor de persoonsgegevens die via deze website en het boekingssysteem worden verwerkt.',
    sections: [
      {
        id: 'gegevens',
        title: 'Welke gegevens verwerken we?',
        paragraphs: [
          'We verwerken alleen gegevens die nodig zijn om de afspraak te plannen, uit te voeren, te wijzigen of te annuleren.',
        ],
        items: [
          'naam, e-mailadres en telefoonnummer;',
          'bij een afspraak aan huis: het opgegeven adres;',
          'de gekozen behandeling, duur, prijs, datum, tijd, reserveringsnummer en status;',
          'een eventuele vrijwillige opmerking bij de reservering;',
          'technische verzendinformatie over de bevestigingsmails;',
          'een eenrichtingshash van het netwerkadres voor beveiliging en het beperken van misbruik.',
        ],
        note:
          'Vul in het vrije opmerkingenveld geen medische gegevens of andere gevoelige informatie in. Bespreek informatie die voor de behandeling nodig is liever rechtstreeks met Relax Bridge.',
      },
      {
        id: 'doelen',
        title: 'Doelen en rechtsgronden',
        paragraphs: [
          'Boekings- en contactgegevens worden verwerkt om je verzoek uit te voeren, de afspraak vast te leggen en daarover te communiceren. De rechtsgrond is het uitvoeren van een overeenkomst of het nemen van stappen vóór het sluiten daarvan.',
          'Gegevens die deel uitmaken van de financiële administratie worden verwerkt om aan wettelijke verplichtingen te voldoen. Beperkte technische gegevens worden verwerkt op basis van het gerechtvaardigde belang om de website en het boekingssysteem te beveiligen en misbruik te voorkomen.',
          'De boekingsgegevens worden niet gebruikt voor nieuwsbrieven of andere marketing zonder een afzonderlijke, vrijwillige toestemming.',
        ],
      },
      {
        id: 'ontvangers',
        title: 'Met wie delen we gegevens?',
        paragraphs: [
          'Alleen Relax Bridge en dienstverleners die nodig zijn voor hosting, databasebeheer en transactionele e-mail kunnen de gegevens verwerken. Deze partijen werken in opdracht van Relax Bridge en krijgen alleen toegang voor zover dat nodig is voor hun taak.',
          'Persoonsgegevens worden niet verkocht. Als een dienstverlener gegevens buiten de Europese Economische Ruimte verwerkt, worden passende AVG-waarborgen gebruikt, zoals een adequaatheidsbesluit of standaardcontractbepalingen.',
        ],
      },
      {
        id: 'bewaren',
        title: 'Hoe lang bewaren we gegevens?',
        paragraphs: [
          'Boekings- en contactgegevens die niet bij de fiscale administratie horen, worden in beginsel uiterlijk twee jaar na de afspraak verwijderd of geanonimiseerd. Gegevens die onderdeel zijn van de wettelijk verplichte financiële administratie kunnen zeven jaar worden bewaard.',
          'Technische beveiligings- en e-mailverzendgegevens worden niet langer bewaard dan nodig voor beveiliging, foutoplossing en betrouwbare aflevering. Een langere bewaartermijn geldt alleen wanneer dat nodig is voor een wettelijke verplichting of een juridisch geschil.',
        ],
      },
      {
        id: 'beveiliging',
        title: 'Beveiliging',
        paragraphs: [
          'Relax Bridge gebruikt passende technische en organisatorische maatregelen, waaronder versleutelde verbindingen, toegangsbeperking tot het beheergedeelte, beveiligde wachtwoorden en verzoekbegrenzing. Geen enkele online dienst kan absolute veiligheid garanderen.',
        ],
      },
      {
        id: 'cookies',
        title: 'Cookies',
        paragraphs: [
          'De openbare website gebruikt geen advertentie- of analysecookies. Het afgeschermde beheergedeelte gebruikt uitsluitend een strikt noodzakelijke sessiecookie voor het ingelogd houden van de beheerder; deze wordt niet gebruikt om bezoekers te volgen.',
        ],
      },
      {
        id: 'rechten',
        title: 'Je privacyrechten',
        paragraphs: [
          'Je kunt vragen om inzage, correctie, verwijdering, beperking of overdracht van je persoonsgegevens. Je kunt ook bezwaar maken tegen een verwerking op basis van een gerechtvaardigd belang. Wanneer een verwerking op toestemming berust, kun je die toestemming altijd intrekken. Een wettelijke bewaarplicht kan betekenen dat sommige gegevens niet direct mogen worden verwijderd.',
          'Relax Bridge gebruikt de boekingsgegevens niet voor geautomatiseerde besluitvorming of profilering.',
        ],
      },
      {
        id: 'wijzigingen',
        title: 'Wijzigingen',
        paragraphs: [
          'Deze privacyverklaring kan worden aangepast als de website, het boekingssysteem of de wettelijke regels veranderen. Op deze pagina staat altijd de meest recente versie.',
        ],
      },
    ],
    contactTitle: 'Vragen of een privacyverzoek?',
    contactBody:
      'Stuur een e-mail naar info@relaxbridge.nl. Om gegevens niet aan de verkeerde persoon te verstrekken, kan Relax Bridge om passende identificatie vragen. Je ontvangt in beginsel binnen één maand een reactie.',
    complaint: 'Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.',
    complaintLink: 'Klacht indienen bij de Autoriteit Persoonsgegevens',
  },
  en: {
    eyebrow: 'Privacy & personal data',
    title: 'Privacy notice',
    metaDescription:
      'Learn which personal data Relax Bridge processes for appointments, why it is used and which privacy rights you have.',
    intro:
      'Relax Bridge handles your personal data with care. This notice explains which information is processed when you book an appointment, why it is needed and which choices and rights you have.',
    updated: 'Last updated: 15 August 2026',
    controllerTitle: 'Who is responsible?',
    controllerBody:
      'Relax Bridge in Tilburg is the data controller for personal data processed through this website and booking system.',
    sections: [
      {
        id: 'data',
        title: 'Which data do we process?',
        paragraphs: [
          'We process only the information needed to schedule, provide, change or cancel an appointment.',
        ],
        items: [
          'name, email address and telephone number;',
          'for a home appointment: the address you provide;',
          'the selected treatment, duration, price, date, time, booking reference and status;',
          'any optional note added to the booking;',
          'technical delivery information for confirmation emails;',
          'a one-way hash of the network address for security and abuse prevention.',
        ],
        note:
          'Do not enter medical information or other sensitive data in the optional notes field. Please discuss information needed for the treatment directly with Relax Bridge.',
      },
      {
        id: 'purposes',
        title: 'Purposes and legal bases',
        paragraphs: [
          'Booking and contact details are processed to handle your request, record the appointment and communicate with you about it. The legal basis is the performance of a contract or steps taken before entering into one.',
          'Information forming part of the financial administration is processed to comply with legal obligations. Limited technical data is processed on the basis of the legitimate interest in securing the website and booking system and preventing abuse.',
          'Booking details are not used for newsletters or other marketing without separate, freely given consent.',
        ],
      },
      {
        id: 'recipients',
        title: 'Who receives the data?',
        paragraphs: [
          'Only Relax Bridge and service providers needed for hosting, database management and transactional email may process the data. These providers act on behalf of Relax Bridge and receive access only as needed for their task.',
          'Personal data is not sold. If a provider processes data outside the European Economic Area, appropriate GDPR safeguards are used, such as an adequacy decision or standard contractual clauses.',
        ],
      },
      {
        id: 'retention',
        title: 'How long is data retained?',
        paragraphs: [
          'Booking and contact details that do not form part of the tax administration are generally deleted or anonymised no later than two years after the appointment. Information that forms part of legally required financial records may be retained for seven years.',
          'Technical security and email-delivery data is kept only as long as needed for security, troubleshooting and reliable delivery. A longer period applies only where required by law or needed for a legal dispute.',
        ],
      },
      {
        id: 'security',
        title: 'Security',
        paragraphs: [
          'Relax Bridge uses appropriate technical and organisational measures, including encrypted connections, restricted access to the administration area, protected passwords and request rate limiting. No online service can guarantee absolute security.',
        ],
      },
      {
        id: 'cookies',
        title: 'Cookies',
        paragraphs: [
          'The public website does not use advertising or analytics cookies. The protected administration area uses only a strictly necessary session cookie to keep the administrator signed in; it is not used to track visitors.',
        ],
      },
      {
        id: 'rights',
        title: 'Your privacy rights',
        paragraphs: [
          'You may request access, correction, erasure, restriction or portability of your personal data. You may also object to processing based on a legitimate interest. Where processing relies on consent, you may withdraw it at any time. A legal retention duty may mean that some information cannot be erased immediately.',
          'Relax Bridge does not use booking details for automated decision-making or profiling.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes',
        paragraphs: [
          'This privacy notice may be updated when the website, booking system or legal requirements change. The latest version is always published on this page.',
        ],
      },
    ],
    contactTitle: 'Questions or a privacy request?',
    contactBody:
      'Email info@relaxbridge.nl. Relax Bridge may request appropriate identification to avoid disclosing data to the wrong person. You will normally receive a response within one month.',
    complaint: 'You may also lodge a complaint with the Dutch Data Protection Authority.',
    complaintLink: 'Lodge a complaint with the Dutch Data Protection Authority',
  },
  hu: {
    eyebrow: 'Adatvédelem & személyes adatok',
    title: 'Adatvédelmi tájékoztató',
    metaDescription:
      'Ismerd meg, milyen személyes adatokat kezel a Relax Bridge a foglalásokhoz, miért használja azokat, és milyen jogaid vannak.',
    intro:
      'A Relax Bridge gondosan kezeli a személyes adataidat. Itt megtudhatod, milyen adatokat kezelünk az időpontfoglalás során, miért van rájuk szükség, és milyen jogaid vannak.',
    updated: 'Utolsó frissítés: 2026. augusztus 15.',
    controllerTitle: 'Ki felel az adatkezelésért?',
    controllerBody:
      'A tilburgi Relax Bridge az adatkezelő a weboldalon és a foglalási rendszerben kezelt személyes adatok tekintetében.',
    sections: [
      {
        id: 'adatok',
        title: 'Milyen adatokat kezelünk?',
        paragraphs: [
          'Csak az időpont megszervezéséhez, teljesítéséhez, módosításához vagy lemondásához szükséges adatokat kezeljük.',
        ],
        items: [
          'név, e-mail-cím és telefonszám;',
          'házhoz kért kezelésnél a megadott cím;',
          'a kiválasztott kezelés, időtartam, ár, dátum, időpont, foglalási azonosító és állapot;',
          'a foglaláshoz írt nem kötelező megjegyzés;',
          'a visszaigazoló e-mailek technikai kézbesítési adatai;',
          'a hálózati címből készült egyirányú lenyomat a biztonság és a visszaélések megelőzése érdekében.',
        ],
        note:
          'A szabad szöveges megjegyzésben ne adj meg egészségügyi vagy más érzékeny adatot. A kezeléshez szükséges információt inkább közvetlenül egyeztesd a Relax Bridge-dzsel.',
      },
      {
        id: 'celok',
        title: 'Célok és jogalapok',
        paragraphs: [
          'A foglalási és kapcsolattartási adatokat a kérésed teljesítéséhez, az időpont rögzítéséhez és az ezzel kapcsolatos kommunikációhoz kezeljük. A jogalap a szerződés teljesítése, illetve a szerződéskötést megelőző lépések megtétele.',
          'A pénzügyi nyilvántartás részét képező adatokat jogi kötelezettség teljesítéséhez kezeljük. Korlátozott technikai adatokat jogos érdek alapján használunk a weboldal és a foglalási rendszer védelmére, valamint a visszaélések megelőzésére.',
          'A foglalási adatokat külön, önkéntes hozzájárulás nélkül nem használjuk hírlevélhez vagy más marketinghez.',
        ],
      },
      {
        id: 'cimzettek',
        title: 'Kik kapják meg az adatokat?',
        paragraphs: [
          'Az adatokat kizárólag a Relax Bridge, valamint a tárhelyhez, az adatbázis-kezeléshez és a tranzakciós e-mailekhez szükséges szolgáltatók kezelhetik. Ezek a szolgáltatók a Relax Bridge megbízásából, csak a feladatukhoz szükséges mértékben férnek hozzá az adatokhoz.',
          'Személyes adatokat nem értékesítünk. Ha egy szolgáltató az Európai Gazdasági Térségen kívül kezel adatot, megfelelő GDPR-garanciákat alkalmazunk, például megfelelőségi határozatot vagy általános adatvédelmi kikötéseket.',
        ],
      },
      {
        id: 'megorzes',
        title: 'Meddig őrizzük meg az adatokat?',
        paragraphs: [
          'Az adóügyi nyilvántartás részét nem képező foglalási és kapcsolattartási adatokat főszabály szerint legkésőbb az időpont után két évvel töröljük vagy anonimizáljuk. A jogszabály alapján megőrzendő pénzügyi nyilvántartás adatait hét évig őrizhetjük meg.',
          'A technikai biztonsági és e-mail-kézbesítési adatokat csak a biztonsághoz, a hibakereséshez és a megbízható kézbesítéshez szükséges ideig tartjuk meg. Hosszabb megőrzésre csak jogi kötelezettség vagy jogvita esetén kerül sor.',
        ],
      },
      {
        id: 'biztonsag',
        title: 'Biztonság',
        paragraphs: [
          'A Relax Bridge megfelelő technikai és szervezési intézkedéseket alkalmaz, ideértve a titkosított kapcsolatot, az adminfelület korlátozott hozzáférését, a védett jelszavakat és a kérések gyakoriságának korlátozását. Egyetlen online szolgáltatás sem garantálhat teljes biztonságot.',
        ],
      },
      {
        id: 'cookies',
        title: 'Sütik',
        paragraphs: [
          'A nyilvános weboldal nem használ hirdetési vagy analitikai sütiket. A védett adminfelület kizárólag a bejelentkezés fenntartásához feltétlenül szükséges munkamenet-sütit használ; ez nem szolgál a látogatók követésére.',
        ],
      },
      {
        id: 'jogok',
        title: 'Adatvédelmi jogaid',
        paragraphs: [
          'Kérhetsz hozzáférést, helyesbítést, törlést, korlátozást vagy adathordozhatóságot. Tiltakozhatsz a jogos érdeken alapuló adatkezelés ellen. Ha egy adatkezelés hozzájáruláson alapul, azt bármikor visszavonhatod. Jogi megőrzési kötelezettség esetén előfordulhat, hogy egyes adatok nem törölhetők azonnal.',
          'A Relax Bridge nem használja a foglalási adatokat automatizált döntéshozatalhoz vagy profilalkotáshoz.',
        ],
      },
      {
        id: 'valtozasok',
        title: 'Változások',
        paragraphs: [
          'A tájékoztató a weboldal, a foglalási rendszer vagy a jogszabályok változásakor frissülhet. Ezen az oldalon mindig a legújabb változat olvasható.',
        ],
      },
    ],
    contactTitle: 'Kérdésed vagy adatvédelmi kérelmed van?',
    contactBody:
      'Írj az info@relaxbridge.nl címre. Annak érdekében, hogy az adatok ne kerüljenek illetéktelenhez, a Relax Bridge megfelelő azonosítást kérhet. Főszabály szerint egy hónapon belül választ kapsz.',
    complaint: 'Panaszt tehetsz a holland adatvédelmi hatóságnál is.',
    complaintLink: 'Panasz benyújtása a holland adatvédelmi hatósághoz',
  },
} as const;

export function privacyText(locale: Locale) {
  return privacy[locale];
}
