/**
 * PageReadsPort — layout-host page reads (Core finish slice 9).
 *
 * Four reads only. Callers use `getPageReads()`.
 * `product:pages` is the only adapter. Pack off → empty reads.
 */

import type { AppLocale } from '@/core/i18n/locales'

/**
 * Public page shape served by PageReadsPort.
 * `product:pages` fills it. Callers do not import a CMS package.
 */
export type Page = {
  id: string | number
  title: string
  slug: string
  body?: string | null
  tags?: { id: string | number; title: string; slug: string }[] | null
  meta?: {
    title?: string | null
    description?: string | null
    mediaId?: string | null
  }
  updatedAt: string
  createdAt: string
  /** ISO time of the last publish. Null until the page has been published. */
  publishedAt?: string | null
  /** Account name of the creator. Null when the user id is empty or gone. */
  creatorName?: string | null
  /** Account name of the last publisher. */
  publisherName?: string | null
  _status?: 'draft' | 'published' | 'unpublished' | null
}

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
  /** Starforge text id (`product:pages`). */
  id: string | number
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
