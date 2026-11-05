import type { MetadataRoute } from 'next'

import { appOrigin } from '@/core/content/metadata'
import { listPublishedPagesForSitemap } from '@/core/content/sitemap'
import { LOCALES } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'

/**
 * Public sitemap over published Payload pages (SF-130 + i18n P1).
 * One URL per locale × page, with hreflang alternates for sibling locales.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin()
  const pages = await listPublishedPagesForSitemap()

  return pages.map((page) => {
    const languages: Record<string, string> = {}
    for (const locale of LOCALES) {
      languages[locale] = `${origin}${withLocalePrefix(page.barePath, locale)}`
    }

    return {
      url: `${origin}${page.path}`,
      lastModified: page.lastModified,
      changeFrequency: page.barePath === '/' ? 'weekly' : 'monthly',
      priority: page.barePath === '/' ? 1 : 0.7,
      alternates: {
        languages,
      },
    }
  })
}
