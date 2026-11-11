import 'server-only'

import { getEnabledPublicLocales } from '@/core/i18n/enabled'
import { type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'

import { getPageReads } from './page-reads'

export type SitemapPageEntry = {
  /** Locale-prefixed public path (`/en`, `/hu/about`). */
  path: string
  /** Path without locale prefix (`/` or `/about`) — used for hreflang pairing. */
  barePath: string
  /** Content-manager slug. */
  slug: string
  locale: AppLocale
  lastModified: Date
}

/**
 * List published pages for sitemap.xml — one entry per enabled locale × page.
 * Home slug `home` maps to `/{locale}`; other slugs → `/{locale}/{slug}`.
 * Shared slug across locales (P1); hreflang alternates built in the route.
 * Enabled locales come from Localization admin (P2).
 * Goes through PageReadsPort — no direct `getPayload()` here.
 */
export async function listPublishedPagesForSitemap(): Promise<SitemapPageEntry[]> {
  const locales = await getEnabledPublicLocales()

  try {
    const docs = await getPageReads().listPublishedSummaries()

    const seenBare = new Set<string>()
    const bareEntries: Array<{ barePath: string; slug: string; lastModified: Date }> = []

    for (const doc of docs) {
      const slug = doc.slug.trim()
      if (!slug) continue
      const barePath = slug === HOME_PAGE_KEY ? '/' : `/${slug.replace(/^\/+/, '')}`
      if (seenBare.has(barePath)) continue
      seenBare.add(barePath)

      const updatedAt =
        doc.updatedAt && !Number.isNaN(new Date(doc.updatedAt).getTime())
          ? new Date(doc.updatedAt)
          : new Date()

      bareEntries.push({ barePath, slug, lastModified: updatedAt })
    }

    // Ensure `/` exists even if home is missing (still list other pages).
    if (!seenBare.has('/')) {
      bareEntries.unshift({
        barePath: '/',
        slug: HOME_PAGE_KEY,
        lastModified: new Date(),
      })
    }

    bareEntries.sort((a, b) => a.barePath.localeCompare(b.barePath))

    const entries: SitemapPageEntry[] = []
    for (const bare of bareEntries) {
      for (const locale of locales) {
        entries.push({
          path: withLocalePrefix(bare.barePath, locale),
          barePath: bare.barePath,
          slug: bare.slug,
          locale,
          lastModified: bare.lastModified,
        })
      }
    }

    return entries
  } catch {
    const now = new Date()
    return locales.map((locale) => ({
      path: withLocalePrefix('/', locale),
      barePath: '/',
      slug: HOME_PAGE_KEY,
      locale,
      lastModified: now,
    }))
  }
}
