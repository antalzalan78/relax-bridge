// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.relaxbridge.nl',
  adapter: vercel(),
  trailingSlash: 'never',
  i18n: {
    locales: ['nl', 'en', 'hu'],
    defaultLocale: 'nl',
    routing: {
      // A nyelv nelkuli URL mindig holland; csak az angol es a magyar kap elotagot.
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      // Only Dutch pages are advertised to search engines. English and
      // Hungarian remain available through direct URLs and the language switcher.
      filter: (page) => !/^\/(?:en|hu)(?:\/|$)/.test(new URL(page).pathname),
    }),
  ],
});
