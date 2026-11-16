import type { LocaleTextMap } from '@/core/i18n/locale-text'

export type PageStatus = 'draft' | 'published' | 'unpublished'

export function isPageStatus(value: unknown): value is PageStatus {
  return value === 'draft' || value === 'published' || value === 'unpublished'
}

export type PageTagRecord = {
  id: string
  title: string
  slug: string
}

export type PageCategoryRecord = {
  id: string
  title: string
  slug: string
  description: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type PageRecord = {
  id: string
  slug: string
  status: PageStatus
  title: string
  body: string
  metaTitle: string
  metaDescription: string
  metaMediaId: string
  /** Empty = uncategorized. */
  categoryId: string
  tags: PageTagRecord[]
  /** Empty until the first publish. Kept after unpublish. */
  publishedAt: Date | null
  /** `sf_users.id`. Empty when the row was seeded or copied. */
  createdByUserId: string
  /** `sf_users.id` of the last publish. Empty until then. */
  publishedByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type PageLocaleMaps = {
  titleLocales: LocaleTextMap
  bodyLocales: LocaleTextMap
  metaTitleLocales: LocaleTextMap
  metaDescriptionLocales: LocaleTextMap
}

export type SavePageInput = {
  id?: string
  slug: string
  status: PageStatus
  title: string
  body: string
  metaTitle: string
  metaDescription: string
  metaMediaId: string
  /** Comma-separated tag titles. Shared across locales. */
  tags: string
  /** Empty = uncategorized. */
  categoryId?: string
  titleLocales?: LocaleTextMap
  bodyLocales?: LocaleTextMap
  metaTitleLocales?: LocaleTextMap
  metaDescriptionLocales?: LocaleTextMap
  /** Signed-in editor. Set by the action, not the form. */
  actorUserId?: string
}

export type PagesAdminActionState = {
  ok?: boolean
  error?: string
  message?: string
  id?: string
  deleted?: boolean
}

export type PageListSort = 'title' | 'slug' | 'status' | 'updated' | 'created' | 'published'

/** How many snapshots to keep per page. */
export const PAGE_VERSION_KEEP = 20

export type PageVersionLocales = {
  title: Record<string, string>
  body: Record<string, string>
  metaTitle: Record<string, string>
  metaDescription: Record<string, string>
}

export type PageVersionRecord = {
  id: string
  pageId: string
  title: string
  body: string
  metaTitle: string
  metaDescription: string
  metaMediaId: string
  slug: string
  status: PageStatus
  tags: string
  categoryId: string
  locales: PageVersionLocales
  createdAt: Date
}

export const PAGE_LIST_LIMITS = [10, 20, 50] as const
export type PageListLimit = (typeof PAGE_LIST_LIMITS)[number]

export function isPageListLimit(value: unknown): value is PageListLimit {
  return value === 10 || value === 20 || value === 50
}

export type PageListFilters = {
  q?: string
  sort?: PageListSort
  dir?: 'asc' | 'desc'
  status?: PageStatus | ''
  tagId?: string
  categoryId?: string
  /** Updated within this many days. Empty = any time. */
  updatedWithinDays?: number | null
  /** 1-based page index. */
  page?: number
  /** Rows per page: 10 | 20 | 50. */
  limit?: PageListLimit
}

export type PageListResult = {
  rows: PageRecord[]
  total: number
  page: number
  limit: PageListLimit
  totalPages: number
}

export type NavPageBind = {
  id: string
  title: string
  slug: string
}
