/**
 * PageReadsPort adapter for product:pages.
 * Same four reads as the Payload adapter: published slug, draft preview,
 * search (title / slug / meta title / meta description), sitemap summaries.
 */

import 'server-only'

import type { Page } from '@/payload-types'

import type { PageReadsPort, PageReadsSearchResult } from '@/core/content/page-reads/types'
import { buildPageKey } from '@/core/i18n/content-locale-keys'
import {
  loadContentLocaleCatalog,
  pickFromContentCatalog,
  type ContentLocaleCatalog,
} from '@/core/i18n/content-locales/store'
import { getLocalizationSettings } from '@/core/localization/store'

import { findPageRowBySlug, listPublishedPageRows } from './store'
import type { PageRecord } from './types'

type LocaleFields = {
  title: string
  body: string
  metaTitle: string
  metaDescription: string
}

async function catalogsFor(
  locale: string,
  defaultLocale: string,
  fallback: boolean,
  cache: Map<string, ContentLocaleCatalog>,
): Promise<{ current: ContentLocaleCatalog; fallback: ContentLocaleCatalog | null }> {
  const load = async (code: string) => {
    const hit = cache.get(code)
    if (hit) return hit
    const catalog = await loadContentLocaleCatalog(code)
    cache.set(code, catalog)
    return catalog
  }
  const current = await load(locale)
  if (!fallback || locale === defaultLocale) return { current, fallback: null }
  return { current, fallback: await load(defaultLocale) }
}

function pickField(
  current: ContentLocaleCatalog,
  fallback: ContentLocaleCatalog | null,
  key: string,
  column: string,
): string {
  const fromLocale = pickFromContentCatalog(current, key)
  if (fromLocale) return fromLocale
  if (fallback) {
    const fromDefault = pickFromContentCatalog(fallback, key)
    if (fromDefault) return fromDefault
  }
  return column
}

async function localizedFields(
  page: PageRecord,
  locale: string,
  defaultLocale: string,
  fallbackEnabled: boolean,
  cache: Map<string, ContentLocaleCatalog>,
): Promise<LocaleFields> {
  try {
    const { current, fallback } = await catalogsFor(locale, defaultLocale, fallbackEnabled, cache)
    return {
      title: pickField(current, fallback, buildPageKey(page.id, 'title'), page.title),
      body: pickField(current, fallback, buildPageKey(page.id, 'html'), page.body),
      metaTitle: pickField(
        current,
        fallback,
        buildPageKey(page.id, 'metaTitle'),
        page.metaTitle,
      ),
      metaDescription: pickField(
        current,
        fallback,
        buildPageKey(page.id, 'metaDescription'),
        page.metaDescription,
      ),
    }
  } catch {
    return {
      title: page.title,
      body: page.body,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
    }
  }
}

function toPage(page: PageRecord, fields: LocaleFields): Page {
  return {
    id: page.id,
    title: fields.title || page.slug,
    slug: page.slug,
    body: fields.body || null,
    tags: page.tags.map((tag) => ({
      id: tag.id,
      title: tag.title,
      slug: tag.slug,
    })),
    meta: {
      title: fields.metaTitle || null,
      description: fields.metaDescription || null,
      mediaId: page.metaMediaId || null,
    },
    updatedAt: page.updatedAt.toISOString(),
    createdAt: page.createdAt.toISOString(),
    _status: page.status,
  } as unknown as Page
}

function missingPagesTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /sf_pages/i.test(msg) && /does not exist|relation/i.test(msg)
}

export function createPagesPageReads(): PageReadsPort {
  return {
    async findPublishedBySlug(slug, locale) {
      try {
        const page = await findPageRowBySlug(slug, { publishedOnly: true })
        if (!page) return null
        const settings = await getLocalizationSettings()
        const fields = await localizedFields(
          page,
          locale,
          settings.defaultLocale,
          settings.localeFallback,
          new Map(),
        )
        return toPage(page, fields)
      } catch (error) {
        if (missingPagesTable(error)) return null
        throw error
      }
    },

    async findDraftBySlug(slug, locale) {
      try {
        const page = await findPageRowBySlug(slug, { publishedOnly: false })
        if (!page) return null
        const settings = await getLocalizationSettings()
        const fields = await localizedFields(
          page,
          locale,
          settings.defaultLocale,
          settings.localeFallback,
          new Map(),
        )
        return toPage(page, fields)
      } catch (error) {
        if (missingPagesTable(error)) return null
        throw error
      }
    },

    async searchPublished(query, locale, options): Promise<PageReadsSearchResult> {
      try {
        const needle = query.trim().toLowerCase()
        const settings = await getLocalizationSettings()
        const cache = new Map<string, ContentLocaleCatalog>()
        const pages = await listPublishedPageRows()
        const matched: PageReadsSearchResult['docs'] = []
        for (const page of pages) {
          const fields = await localizedFields(
            page,
            locale,
            settings.defaultLocale,
            settings.localeFallback,
            cache,
          )
          const haystack = [fields.title, page.slug, fields.metaTitle, fields.metaDescription]
            .join('\n')
            .toLowerCase()
          if (needle && !haystack.includes(needle)) continue
          matched.push({
            id: page.id,
            title: fields.title || null,
            slug: page.slug,
            meta: {
              title: fields.metaTitle || null,
              description: fields.metaDescription || null,
            },
          })
        }
        matched.sort((a, b) => (a.title || a.slug || '').localeCompare(b.title || b.slug || ''))
        const limit = Math.max(0, options.limit)
        return {
          docs: matched.slice(0, limit),
          totalDocs: matched.length,
        }
      } catch (error) {
        if (missingPagesTable(error)) return { docs: [], totalDocs: 0 }
        throw error
      }
    },

    async listPublishedSummaries() {
      try {
        const pages = await listPublishedPageRows()
        return pages
          .filter((page) => page.slug.trim())
          .map((page) => ({
            id: page.id,
            slug: page.slug.trim(),
            updatedAt: page.updatedAt.toISOString(),
          }))
      } catch (error) {
        if (missingPagesTable(error)) return []
        throw error
      }
    },
  }
}
