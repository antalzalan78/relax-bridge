import type { Locale } from '../data/site';

const copy = {
  nl: {
    title: 'Blog', description: 'Verhalen en praktische tips over massage en ontspanning.',
    topics: 'Onderwerpen', latest: 'Nieuwste artikelen', empty: 'De eerste artikelen komen binnenkort online.',
    topicEmpty: 'Over dit onderwerp verschijnen binnenkort artikelen.', read: 'Lees artikel',
    readTime: 'min leestijd', related: 'Verder lezen', sources: 'Bronnen', music: 'Muziektip',
    video: 'Bijbehorende video', series: 'Serie', previous: 'Vorig deel', next: 'Volgend deel',
    homeTitle: 'Nieuw op de blog', homeLink: 'Bekijk alle artikelen', homeIntro: 'Lees meer over massage en ontspanning.',
    topicLabel: 'Onderwerp', articleNotFound: 'Dit artikel is niet beschikbaar.',
  },
  en: {
    title: 'Blog', description: 'Stories and practical tips about massage and relaxation.',
    topics: 'Topics', latest: 'Latest articles', empty: 'The first articles are coming soon.',
    topicEmpty: 'Articles on this topic are coming soon.', read: 'Read article',
    readTime: 'min read', related: 'Keep reading', sources: 'Sources', music: 'Music suggestion',
    video: 'Related video', series: 'Series', previous: 'Previous part', next: 'Next part',
    homeTitle: 'Latest from the blog', homeLink: 'See all articles', homeIntro: 'Read more about massage and relaxation.',
    topicLabel: 'Topic', articleNotFound: 'This article is not available.',
  },
  hu: {
    title: 'Blog', description: 'Masszázstörténeti érdekességek és gyakorlati tudnivalók a pihenésről.',
    topics: 'Témák', latest: 'Legfrissebb cikkek', empty: 'Az első cikkek hamarosan megjelennek.',
    topicEmpty: 'Ebben a témában hamarosan lesznek cikkek.', read: 'Cikk olvasása',
    readTime: 'perc olvasás', related: 'Kapcsolódó írások', sources: 'Források', music: 'Zeneajánló',
    video: 'Kapcsolódó videó', series: 'Sorozat', previous: 'Előző rész', next: 'Következő rész',
    homeTitle: 'Legfrissebb a blogon', homeLink: 'Összes cikk', homeIntro: 'Olvass többet a masszázsról és a pihenésről.',
    topicLabel: 'Téma', articleNotFound: 'Ez a cikk nem érhető el.',
  },
} as const;

export function blogText(locale: Locale) { return copy[locale]; }
