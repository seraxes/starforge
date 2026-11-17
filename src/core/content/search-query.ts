import type { AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { barePathForSlug, type RootPageSlug } from '@/core/nav/root-target'

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
 * Locale-prefixed public path for a published page slug (`home` → `/{locale}`).
 */
export function publishedPagePath(
  slug: string,
  locale: AppLocale,
  rootPageSlug?: RootPageSlug,
): string {
  return withLocalePrefix(barePathForSlug(slug, rootPageSlug), locale)
}
