import type { Locale } from '../data/site';

const copy = {
  nl: {
    title: 'Blog', description: 'Wat kun je verwachten van een massage? Hoe kies je een behandeling? Ervaringen, praktische tips en bijzondere verhalen — even tijd om te lezen.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Meer weten.\nMeer ontspannen.', backToAll: 'Alle onderwerpen', byline: 'Door',
    topics: 'Onderwerpen', latest: 'Nieuwste artikelen', empty: 'De eerste artikelen komen binnenkort online.',
    topicEmpty: 'Over dit onderwerp verschijnen binnenkort artikelen.', read: 'Lees artikel',
    readTime: 'min leestijd', related: 'Verder lezen', sources: 'Bronnen', music: 'Muziektip',
    video: 'Bijbehorende video', series: 'Serie', previous: 'Vorig deel', next: 'Volgend deel',
    homeEyebrow: 'Uit de blog van Brigitta', homeTitle: 'Even tijd om te ontdekken.', homeLink: 'Bekijk de onderwerpen', homeIntro: 'Verhalen, praktische tips en inspiratie uit de wereld van massage.',
    indexBottomEyebrow: 'Er valt altijd iets te ontdekken', indexBottomTitle: 'De blog groeit verder.',
    indexBottomBody: 'Kom gerust terug voor nieuwe verhalen, gedachten en artikelen over ontspanning.', indexBottomCta: 'Bekijk de behandelingen',
    topicLabel: 'Onderwerp', articleNotFound: 'Dit artikel is niet beschikbaar.',
  },
  en: {
    title: 'Blog', description: 'What can you expect from a massage? How do you choose a treatment? Experiences, practical tips and interesting stories — a moment to read.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Learn more.\nRelax more.', backToAll: 'All topics', byline: 'By',
    topics: 'Topics', latest: 'Latest articles', empty: 'The first articles are coming soon.',
    topicEmpty: 'Articles on this topic are coming soon.', read: 'Read article',
    readTime: 'min read', related: 'Keep reading', sources: 'Sources', music: 'Music suggestion',
    video: 'Related video', series: 'Series', previous: 'Previous part', next: 'Next part',
    homeEyebrow: 'From Brigitta’s blog', homeTitle: 'Take a moment to explore.', homeLink: 'Explore the topics', homeIntro: 'Stories, practical tips, and inspiration from the world of massage.',
    indexBottomEyebrow: 'Always more to discover', indexBottomTitle: 'The blog is growing.',
    indexBottomBody: 'Come back for new stories, reflections and articles about relaxation.', indexBottomCta: 'Explore the treatments',
    topicLabel: 'Topic', articleNotFound: 'This article is not available.',
  },
  hu: {
    title: 'Blog', description: 'Mire számíthatsz egy masszázson? Hogyan válassz kezelést? Tapasztalatok, gyakorlati tanácsok és érdekes történetek – egy kis idő az olvasásra.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Több tudás.\nTöbb pihenés.', backToAll: 'Összes téma', byline: 'Szerző:',
    topics: 'Témák', latest: 'Legfrissebb cikkek', empty: 'Az első cikkek hamarosan megjelennek.',
    topicEmpty: 'Ebben a témában hamarosan lesznek cikkek.', read: 'Cikk olvasása',
    readTime: 'perc olvasás', related: 'Kapcsolódó írások', sources: 'Források', music: 'Zeneajánló',
    video: 'Kapcsolódó videó', series: 'Sorozat', previous: 'Előző rész', next: 'Következő rész',
    homeEyebrow: 'Brigitta blogjából', homeTitle: 'Egy kis idő a felfedezésre.', homeLink: 'Témák megtekintése', homeIntro: 'Történetek, gyakorlati tippek és inspiráció a masszázs világából.',
    indexBottomEyebrow: 'Mindig van mit felfedezni', indexBottomTitle: 'A blog folyamatosan bővül.',
    indexBottomBody: 'Új történetekkel, gondolatokkal és a pihenéshez kapcsolódó írásokkal várlak vissza.', indexBottomCta: 'Megnézem a kezelési lehetőségeket',
    topicLabel: 'Téma', articleNotFound: 'Ez a cikk nem érhető el.',
  },
} as const;

export function blogText(locale: Locale) { return copy[locale]; }
