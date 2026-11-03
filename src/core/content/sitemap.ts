import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'

import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'

export type SitemapPageEntry = {
  /** Public path (`/` for home). */
  path: string
  /** Payload slug. */
  slug: string
  lastModified: Date
}

/**
 * List published Payload pages for sitemap.xml.
 * Home slug `home` maps to `/`; other slugs → `/{slug}`.
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

    const seen = new Set<string>()
    const entries: SitemapPageEntry[] = []

    for (const doc of result.docs) {
      const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
      if (!slug) continue
      const path = slug === HOME_PAGE_KEY ? '/' : `/${slug.replace(/^\/+/, '')}`
      if (seen.has(path)) continue
      seen.add(path)

      const updatedAt =
        doc.updatedAt && !Number.isNaN(new Date(doc.updatedAt).getTime())
          ? new Date(doc.updatedAt)
          : new Date()

      entries.push({ path, slug, lastModified: updatedAt })
    }

    // Ensure `/` exists even if home is missing (still list other pages).
    if (!seen.has('/')) {
      entries.unshift({
        path: '/',
        slug: HOME_PAGE_KEY,
        lastModified: new Date(),
      })
    }

    return entries.sort((a, b) => a.path.localeCompare(b.path))
  } catch {
    return [
      {
        path: '/',
        slug: HOME_PAGE_KEY,
        lastModified: new Date(),
      },
    ]
  }
}
