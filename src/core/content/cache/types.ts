/**
 * Pluggable cache for **published** CMS reads (pages + site chrome + layout/nav/page-chrome).
 *
 * Default: Next.js `unstable_cache` + `revalidateTag` (local-friendly).
 * Production (DO): Redis via `STARFORGE_CONTENT_CACHE=redis` + `REDIS_URL` —
 * callers (`getPublishedPageBySlug`, `getSiteSettings`, …) stay unchanged.
 */
export type ContentCacheGetOptions = {
  /** Stable key parts (include slug / resource id). */
  key: string[]
  /** Tags for on-demand invalidation (publish / settings save). */
  tags: string[]
  /**
   * Seconds until background revalidation, or `false` to keep until tag invalidate.
   * Prefer tag-driven invalidation for CMS content.
   */
  revalidate?: number | false
}

export interface PublishedContentCache {
  /**
   * Cache the result of `loader` across requests.
   * Must return JSON-serializable values (plain objects / null).
   */
  getCached<T>(options: ContentCacheGetOptions, loader: () => Promise<T>): Promise<T>

  /**
   * Invalidate entries that carry any of the given tags.
   * Callers **must await** this from server actions / Payload hooks so
   * save → redirect never races a stale Redis read on another instance.
   */
  invalidateTags(tags: readonly string[]): void | Promise<void>
}
