import type { MetadataRoute } from 'next'

import { appOrigin } from '@/core/content/metadata'
import { listPublishedPagesForSitemap } from '@/core/content/sitemap'
import { buildLanguageAlternates } from '@/core/i18n/alternates'
import { getEnabledPublicLocales } from '@/core/i18n/enabled'

/**
 * Public sitemap over published Payload pages (SF-130 + i18n P1/P2).
 * One URL per enabled locale × page, with hreflang alternates for siblings.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin()
  const [pages, locales] = await Promise.all([
    listPublishedPagesForSitemap(),
    getEnabledPublicLocales(),
  ])

  return pages.map((page) => ({
    url: `${origin}${page.path}`,
    lastModified: page.lastModified,
    changeFrequency: page.barePath === '/' ? 'weekly' : 'monthly',
    priority: page.barePath === '/' ? 1 : 0.7,
    alternates: {
      languages: buildLanguageAlternates(page.barePath, locales, origin),
    },
  }))
}
