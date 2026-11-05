import { defineRouting } from 'next-intl/routing'

import { DEFAULT_LOCALE, LOCALES } from './locales'

/**
 * next-intl routing — public App Router only.
 * Prefer localePrefix `always` for clear cache keys / sitemap / redirects (P0).
 *
 * Static `locales` here are the **bootstrap** catalog (`en`/`hu`) for
 * `createNavigation` + `generateStaticParams`. Runtime negotiation in
 * `src/proxy.ts` uses Localization admin enabled locales (including
 * admin-added codes). Message packs for unknown codes fall back to `en`.
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
})
