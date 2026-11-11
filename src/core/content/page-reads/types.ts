/**
 * PageReadsPort — layout-host page reads (Core finish slice 9).
 *
 * Four reads only. Callers use `getPageReads()`; they never call `getPayload()`.
 * The Payload adapter is the sole `getPayload()` home for these four.
 */

import type { AppLocale } from '@/core/i18n/locales'
import type { Page } from '@/payload-types'

/** Published page fields search needs (title / slug / meta). */
export type PageReadsSearchDoc = {
  id: string | number
  title?: string | null
  slug?: string | null
  meta?: {
    title?: string | null
    description?: string | null
  } | null
}

export type PageReadsSearchResult = {
  docs: PageReadsSearchDoc[]
  totalDocs: number
}

/**
 * Published page summary for the sitemap and Nav slug resolve.
 * `id` lets Nav map page binds → slugs without a fifth read.
 */
export type PageReadsPublishedSummary = {
  id: number
  slug: string
  updatedAt: string
}

export interface PageReadsPort {
  /** Published page by slug + locale. Drafts never returned. */
  findPublishedBySlug(slug: string, locale: AppLocale): Promise<Page | null>

  /**
   * Latest draft (or published) by slug + locale for `/preview`.
   * Auth gating stays in the route — the adapter uses overrideAccess.
   */
  findDraftBySlug(slug: string, locale: AppLocale): Promise<Page | null>

  /** Published pages matching title / slug / meta for public search. */
  searchPublished(
    query: string,
    locale: AppLocale,
    options: { limit: number },
  ): Promise<PageReadsSearchResult>

  /** Published pages for sitemap.xml and Nav page-link slug resolve. */
  listPublishedSummaries(): Promise<PageReadsPublishedSummary[]>
}
