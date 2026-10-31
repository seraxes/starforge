/**
 * Pluggable cache for **published** CMS reads (pages + site chrome).
 *
 * Today: Next.js `unstable_cache` + `revalidateTag` (local-friendly).
 * Later (DO): Redis-backed implementation behind the same interface —
 * callers (`getPublishedPageBySlug`, `getSiteSettings`) stay unchanged.
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
   * Safe to call from Payload hooks and server actions.
   */
  invalidateTags(tags: readonly string[]): void
}
