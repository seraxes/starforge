import { cache } from 'react'

import type { Page } from '@/payload-types'

import {
  type AppLocale,
  isValidLocaleCode,
  toPayloadLocale,
} from '@/core/i18n/locales'

import { contentCacheTags, getPublishedContentCache } from './cache'
import { getPageReads } from './page-reads'

/** Require a valid locale code — no silent default on public content paths. */
export function requireContentLocale(locale: string): AppLocale {
  if (!isValidLocaleCode(locale)) {
    throw new Error(`Invalid content locale: ${locale}`)
  }
  return locale
}

export { toPayloadLocale }

/**
 * Load a published CMS page by slug + route locale for the public site.
 *
 * Uses the published-content cache (Next.js tags locally; Redis when selected).
 * Drafts are never returned here (port + draft: false).
 * For preview, use `getDraftPageBySlug` (uncached + auth-gated).
 */
export const getPublishedPageBySlug = cache(
  async (slug: string, locale: AppLocale): Promise<Page | null> => {
    return getPublishedContentCache().getCached(
      {
        key: ['sf', 'published-page', locale, slug],
        tags: [contentCacheTags.pages, contentCacheTags.page(slug, locale)],
        revalidate: false,
      },
      () => getPageReads().findPublishedBySlug(slug, locale),
    )
  },
)

/**
 * Load the latest draft (or published) version of a page by slug + locale.
 *
 * Used only by `/[locale]/preview/[slug]` after core auth + feature-flag checks.
 * Intentionally **not** cached — editors must see the latest draft.
 * Access override lives in the Payload adapter — the public route has a Better Auth
 * session, not a Payload `req.user`, so collection access would otherwise hide drafts.
 */
export const getDraftPageBySlug = cache(
  async (slug: string, locale: AppLocale): Promise<Page | null> => {
    return getPageReads().findDraftBySlug(slug, locale)
  },
)
