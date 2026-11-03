import type { MetadataRoute } from 'next'

import { appOrigin } from '@/core/content/metadata'
import { listPublishedPageSitemapEntries } from '@/core/content/pages'
import { HOME_PAGE_KEY } from '@/core/page-settings'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

export const dynamic = 'force-dynamic'

/**
 * Public /sitemap.xml — published Payload pages when product:redirects is on.
 * `home` slug maps to `/`; other slugs to `/{slug}`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    return []
  }

  const origin = appOrigin()
  const entries = await listPublishedPageSitemapEntries()
  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []

  for (const entry of entries) {
    const path = entry.slug === HOME_PAGE_KEY ? '/' : `/${entry.slug}`
    if (seen.has(path)) continue
    seen.add(path)
    const lastModified = entry.updatedAt ? new Date(entry.updatedAt) : undefined
    out.push({
      url: `${origin}${path === '/' ? '/' : path}`,
      ...(lastModified && !Number.isNaN(lastModified.getTime())
        ? { lastModified }
        : {}),
      changeFrequency: path === '/' ? 'weekly' : 'monthly',
      priority: path === '/' ? 1 : 0.7,
    })
  }

  // Ensure `/` appears even when home page is missing from CMS.
  if (!seen.has('/')) {
    out.unshift({
      url: `${origin}/`,
      changeFrequency: 'weekly',
      priority: 1,
    })
  }

  return out
}
