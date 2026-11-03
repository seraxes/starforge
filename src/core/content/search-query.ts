import { HOME_PAGE_KEY } from '@/core/page-settings/defaults'

/** Cap query length so ILIKE stays cheap. */
export const SEARCH_QUERY_MAX_LENGTH = 100

/** Default page size for public search results. */
export const SEARCH_RESULT_LIMIT = 25

/**
 * Normalize a public search query (trim + length cap). Empty → ''.
 */
export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, SEARCH_QUERY_MAX_LENGTH)
}

/**
 * Public path for a published page slug (`home` → `/`).
 */
export function publishedPagePath(slug: string): string {
  const trimmed = slug.trim().replace(/^\/+/, '')
  if (!trimmed || trimmed === HOME_PAGE_KEY) return '/'
  return `/${trimmed}`
}
