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
      // Existing static pages advertise only Dutch. Published blog translations
      // use the separate dynamic blog sitemap. Never list admin/API routes.
      filter: (page) => !/^\/(?:en|hu|admin|api|blog)(?:\/|$)/.test(new URL(page).pathname),
    }),
  ],
});
