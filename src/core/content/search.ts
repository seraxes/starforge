import 'server-only'

import { getPayload } from 'payload'
import type { Where } from 'payload'

import config from '@payload-config'

import { DEFAULT_LOCALE, type AppLocale, toPayloadLocale } from '@/core/i18n/locales'

import {
  SEARCH_RESULT_LIMIT,
  normalizeSearchQuery,
  publishedPagePath,
} from './search-query'

export {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_RESULT_LIMIT,
  normalizeSearchQuery,
  publishedPagePath,
} from './search-query'

export type PublishedSearchHit = {
  id: string
  title: string
  slug: string
  /** Locale-prefixed public path (`/en` for home). */
  path: string
  /** Meta description when present; else empty. */
  excerpt: string
}

export type PublishedSearchResult = {
  query: string
  hits: PublishedSearchHit[]
  totalDocs: number
}

/**
 * Search **published** Payload pages by title / slug / meta title / meta description
 * for a given route locale (with fallback to default locale fields).
 * Uses Payload `contains` (Postgres ILIKE) — no Algolia/Meilisearch.
 * Empty query returns no hits (callers show the empty prompt).
 */
export async function searchPublishedPages(
  rawQuery: unknown,
  locale: AppLocale,
  options?: { limit?: number },
): Promise<PublishedSearchResult> {
  const query = normalizeSearchQuery(rawQuery)
  if (!query) {
    return { query: '', hits: [], totalDocs: 0 }
  }

  const limit = Math.min(
    Math.max(options?.limit ?? SEARCH_RESULT_LIMIT, 1),
    100,
  )

  try {
    const payload = await getPayload({ config })
    const where: Where = {
      and: [
        { _status: { equals: 'published' } },
        {
          or: [
            { title: { contains: query } },
            { slug: { contains: query } },
            { 'meta.title': { contains: query } },
            { 'meta.description': { contains: query } },
          ],
        },
      ],
    }

    const payloadLocale = toPayloadLocale(locale)
    const result = await payload.find({
      collection: 'pages',
      depth: 0,
      draft: false,
      limit,
      locale: payloadLocale,
      fallbackLocale: DEFAULT_LOCALE,
      pagination: true,
      overrideAccess: false,
      sort: 'title',
      where,
      select: {
        title: true,
        slug: true,
        meta: true,
      },
    })

    const hits: PublishedSearchHit[] = []
    for (const doc of result.docs) {
      const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
      if (!slug) continue
      const title =
        typeof doc.title === 'string' && doc.title.trim()
          ? doc.title.trim()
          : slug
      const meta = doc.meta && typeof doc.meta === 'object' ? doc.meta : null
      const excerpt =
        meta && typeof meta.description === 'string' && meta.description.trim()
          ? meta.description.trim()
          : ''
      hits.push({
        id: String(doc.id),
        title,
        slug,
        path: publishedPagePath(slug, locale),
        excerpt,
      })
    }

    return {
      query,
      hits,
      totalDocs: typeof result.totalDocs === 'number' ? result.totalDocs : hits.length,
    }
  } catch {
    return { query, hits: [], totalDocs: 0 }
  }
}
