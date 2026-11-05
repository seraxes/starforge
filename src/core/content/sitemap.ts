import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'

import { DEFAULT_LOCALE, LOCALES, type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'

export type SitemapPageEntry = {
  /** Locale-prefixed public path (`/en`, `/hu/about`). */
  path: string
  /** Path without locale prefix (`/` or `/about`) — used for hreflang pairing. */
  barePath: string
  /** Payload slug. */
  slug: string
  locale: AppLocale
  lastModified: Date
}

/**
 * List published Payload pages for sitemap.xml — one entry per locale × page.
 * Home slug `home` maps to `/{locale}`; other slugs → `/{locale}/{slug}`.
 * Shared slug across locales (P1); hreflang alternates built in the route.
 */
export async function listPublishedPagesForSitemap(): Promise<SitemapPageEntry[]> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'pages',
      depth: 0,
      draft: false,
      limit: 1000,
      pagination: false,
      overrideAccess: false,
      // Slug is not localized — any locale returns the same slug set; use default.
      locale: DEFAULT_LOCALE,
      fallbackLocale: DEFAULT_LOCALE,
      sort: 'slug',
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const seenBare = new Set<string>()
    const bareEntries: Array<{ barePath: string; slug: string; lastModified: Date }> = []

    for (const doc of result.docs) {
      const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
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
      for (const locale of LOCALES) {
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
    return LOCALES.map((locale) => ({
      path: withLocalePrefix('/', locale),
      barePath: '/',
      slug: HOME_PAGE_KEY,
      locale,
      lastModified: now,
    }))
  }
}
