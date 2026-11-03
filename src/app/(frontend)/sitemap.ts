import type { MetadataRoute } from 'next'

import { appOrigin } from '@/core/content/metadata'
import { listPublishedPagesForSitemap } from '@/core/content/sitemap'

/**
 * Public sitemap over published Payload pages (SF-130).
 * Home slug `home` → `/`; others → `/{slug}`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin()
  const pages = await listPublishedPagesForSitemap()

  return pages.map((page) => ({
    url: page.path === '/' ? `${origin}/` : `${origin}${page.path}`,
    lastModified: page.lastModified,
    changeFrequency: page.path === '/' ? 'weekly' : 'monthly',
    priority: page.path === '/' ? 1 : 0.7,
  }))
}
