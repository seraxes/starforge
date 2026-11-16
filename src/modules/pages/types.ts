import type { LocaleTextMap } from '@/core/i18n/locale-text'

export type PageStatus = 'draft' | 'published'

export function isPageStatus(value: unknown): value is PageStatus {
  return value === 'draft' || value === 'published'
}

export type PageTagRecord = {
  id: string
  title: string
  slug: string
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
  tags: PageTagRecord[]
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
  titleLocales?: LocaleTextMap
  bodyLocales?: LocaleTextMap
  metaTitleLocales?: LocaleTextMap
  metaDescriptionLocales?: LocaleTextMap
}

export type PagesAdminActionState = {
  ok?: boolean
  error?: string
  message?: string
  id?: string
  deleted?: boolean
}

export type PageListSort = 'title' | 'slug' | 'status' | 'updated'

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
  locales: PageVersionLocales
  createdAt: Date
}

export type PageListFilters = {
  q?: string
  sort?: PageListSort
  dir?: 'asc' | 'desc'
  status?: PageStatus | ''
  tagId?: string
  /** Updated within this many days. Empty = any time. */
  updatedWithinDays?: number | null
}

export type NavPageBind = {
  id: string
  title: string
  slug: string
}
