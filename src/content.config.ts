import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Egy .md fajl = egy kezeles egy nyelven.
 * Fajlnev: src/content/services/<nyelv>/<kategoria>-<kulcs>.md
 *
 * A `key` a nyelvfuggetlen azonosito. Ezen keresztul talalja meg egymast a
 * harom nyelvi valtozat — ebbol keszul a hreflang es a nyelvvalto, ami a regi
 * oldalrol hianyzott.
 */
const services = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/services',
    /*
     * Alapbol az Astro a frontmatter `slug` mezojet hasznalna azonositonak, es
     * a studios meg a hazhoz meno valtozat ugyanazt a slugot kapja (kulon URL
     * ag ala kerulnek). Ezert a fajlnev az azonosito.
     */
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    lang: z.enum(['nl', 'en', 'hu']),
    key: z.enum(['relax', 'neck-shoulder-back', 'facial', 'foot']),
    category: z.enum(['studio', 'home']),
    /** Az URL utolso szegmense, nyelvenkent eltero. */
    slug: z.string(),
    title: z.string(),
    /** Rovid osszefoglalo a kartyakra es a meta description-be. */
    summary: z.string(),
    order: z.number(),
    prices: z
      .array(z.object({ minutes: z.number(), eur: z.number() }))
      .min(1),
  }),
});

export const collections = { services };
