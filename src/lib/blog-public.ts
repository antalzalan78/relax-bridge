import type { Locale } from '../data/site';
import type { BlogPost, BlogTopic } from './server/blog';

/** Public presentation only. Existing CMS topics, articles, translations and URLs stay intact. */
const curated = [
  {
    id: 'everyday-rest',
    names: { hu: 'Masszázs a Relax Bridge-nél', nl: 'Massage bij Relax Bridge', en: 'Massage at Relax Bridge' },
    descriptions: {
      hu: 'Az első masszázstól a zene és az illatok kiválasztásáig: gyakorlati tudnivalók a személyes pihenéshez.',
      nl: 'Van je eerste massage tot de keuze voor muziek en geur: praktische informatie voor een persoonlijk rustmoment.',
      en: 'From your first massage to choosing music and scent: practical guidance for a personal moment of rest.',
    },
    cover: '/blog/topics/design-topic-rest.webp',
  },
  {
    id: 'relax-bridge-philosophy',
    names: { hu: 'foCus · ConneCt · balanCe', nl: 'foCus · ConneCt · balanCe', en: 'foCus · ConneCt · balanCe' },
    descriptions: {
      hu: 'Észreveszem, komolyan veszem, teszek érte — a Relax Bridge gondolatvilága.',
      nl: 'Opmerken, serieus nemen en er iets mee doen — de gedachte achter Relax Bridge.',
      en: 'Notice, take seriously and act — the thinking behind Relax Bridge.',
    },
    cover: '/blog/topics/design-topic-philosophy.webp',
  },
  {
    id: 'massage-history',
    names: { hu: 'Masszázstörténet', nl: 'Massagegeschiedenis', en: 'Massage history' },
    descriptions: {
      hu: 'Régi ábrázolások, írott emlékek és érdekes történetek nyomán fedezzük fel a masszázs múltját.',
      nl: 'Ontdek de geschiedenis van massage aan de hand van oude afbeeldingen, geschreven bronnen en verhalen.',
      en: 'Explore the history of massage through ancient images, written sources and stories.',
    },
    cover: '/blog/topics/design-topic-history.webp',
  },
] as const;

export type PublicBlogTopic = { id: string; names: Record<Locale, string>; descriptions: Record<Locale, string>; cover: string | undefined };

export function publicTopicId(id: string): string {
  return id === 'preparing-for-massage' ? 'everyday-rest' : id;
}

export function publicTopics(topics: BlogTopic[]): PublicBlogTopic[] {
  const curatedIds = new Set<string>([...curated.map((topic) => topic.id), 'preparing-for-massage']);
  return [
    ...curated.map((topic) => {
      const actual = topics.find((item) => item.id === topic.id);
      return { id: topic.id, names: { ...topic.names }, descriptions: { ...topic.descriptions }, cover: actual?.cover_image_id ? `/api/blog/media/${actual.cover_image_id}` : topic.cover };
    }),
    ...topics.filter((topic) => !curatedIds.has(topic.id)).map((topic) => ({
      id: topic.id, names: topic.names,
      descriptions: { nl: topic.descriptions.nl || '', en: topic.descriptions.en || '', hu: topic.descriptions.hu || '' },
      cover: topic.cover_image_id ? `/api/blog/media/${topic.cover_image_id}` : undefined,
    })),
  ];
}

export function postsForPublicTopic(posts: BlogPost[], topicId: string): BlogPost[] {
  return posts.filter((post) => publicTopicId(post.topic_id) === topicId);
}

export function publicTopicName(locale: Locale, id: string, fallback: string): string {
  return curated.find((topic) => topic.id === publicTopicId(id))?.names[locale] || fallback;
}

/** Keep the history series in the approved reading sequence; retain CMS order elsewhere. */
export function orderPublicTopicPosts(posts: BlogPost[], topicId: string): BlogPost[] {
  const byCmsOrder = [...posts].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  if (topicId !== 'massage-history') return byCmsOrder;
  const rank = (post: BlogPost): number => {
    const text = `${post.id} ${post.slug} ${post.title}`.toLocaleLowerCase();
    if (post.id === 'seed-massage-history' || /ki-talalta|origin|oorsprong|eredet/.test(text)) return 0;
    if (/egyipt|egypt|egypte/.test(text)) return 1;
    if (/india|indie|indië/.test(text)) return 2;
    return 3;
  };
  return byCmsOrder.sort((a, b) => rank(a) - rank(b));
}
