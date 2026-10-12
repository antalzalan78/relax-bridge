import type { Locale } from '../data/site';

const copy = {
  nl: {
    title: 'Blog', description: 'Wat kun je verwachten van een massage? Hoe kies je een behandeling? Ik deel mijn ervaring, praktische tips en bijzondere verhalen met je.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Meer weten.\nMeer ontspannen.', backToAll: 'Alle artikelen', byline: 'Door',
    topics: 'Onderwerpen', latest: 'Nieuwste artikelen', empty: 'De eerste artikelen komen binnenkort online.',
    topicEmpty: 'Over dit onderwerp verschijnen binnenkort artikelen.', read: 'Lees artikel',
    readTime: 'min leestijd', related: 'Verder lezen', sources: 'Bronnen', music: 'Muziektip',
    video: 'Bijbehorende video', series: 'Serie', previous: 'Vorig deel', next: 'Volgend deel',
    homeEyebrow: 'Uit de blog van Brigitta', homeTitle: 'Even tijd om te ontdekken.', homeLink: 'Bekijk alle artikelen', homeIntro: 'Verhalen, praktische tips en inspiratie uit de wereld van massage.',
    topicLabel: 'Onderwerp', articleNotFound: 'Dit artikel is niet beschikbaar.',
  },
  en: {
    title: 'Blog', description: 'What can you expect from a massage? How do you choose a treatment? I share my experience, practical tips, and stories with you.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Learn more.\nRelax more.', backToAll: 'All articles', byline: 'By',
    topics: 'Topics', latest: 'Latest articles', empty: 'The first articles are coming soon.',
    topicEmpty: 'Articles on this topic are coming soon.', read: 'Read article',
    readTime: 'min read', related: 'Keep reading', sources: 'Sources', music: 'Music suggestion',
    video: 'Related video', series: 'Series', previous: 'Previous part', next: 'Next part',
    homeEyebrow: 'From Brigitta’s blog', homeTitle: 'Take a moment to explore.', homeLink: 'See all articles', homeIntro: 'Stories, practical tips, and inspiration from the world of massage.',
    topicLabel: 'Topic', articleNotFound: 'This article is not available.',
  },
  hu: {
    title: 'Blog', description: 'Mire számíthatsz egy masszázson? Hogyan válassz kezelést? Megosztom veled a tapasztalataimat, gyakorlati tanácsaimat és érdekes történeteimet.',
    indexEyebrow: 'Relax Bridge · Blog', indexHeadline: 'Több tudás.\nTöbb pihenés.', backToAll: 'Összes cikk', byline: 'Szerző:',
    topics: 'Témák', latest: 'Legfrissebb cikkek', empty: 'Az első cikkek hamarosan megjelennek.',
    topicEmpty: 'Ebben a témában hamarosan lesznek cikkek.', read: 'Cikk olvasása',
    readTime: 'perc olvasás', related: 'Kapcsolódó írások', sources: 'Források', music: 'Zeneajánló',
    video: 'Kapcsolódó videó', series: 'Sorozat', previous: 'Előző rész', next: 'Következő rész',
    homeEyebrow: 'Brigitta blogjából', homeTitle: 'Egy kis idő a felfedezésre.', homeLink: 'Összes cikk', homeIntro: 'Történetek, gyakorlati tippek és inspiráció a masszázs világából.',
    topicLabel: 'Téma', articleNotFound: 'Ez a cikk nem érhető el.',
  },
} as const;

export function blogText(locale: Locale) { return copy[locale]; }
