// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.relaxbridge.nl',
  trailingSlash: 'never',
  i18n: {
    locales: ['nl', 'en', 'hu'],
    defaultLocale: 'nl',
    routing: {
      // A holland a fooldal (/), az angol es a magyar /en es /hu ala kerul.
      prefixDefaultLocale: false,
    },
  },
  integrations: [sitemap({ i18n: { defaultLocale: 'nl', locales: { nl: 'nl-NL', en: 'en', hu: 'hu-HU' } } })],
});
