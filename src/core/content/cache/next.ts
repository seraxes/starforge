import { revalidateTag, unstable_cache } from 'next/cache'

import type { ContentCacheGetOptions, PublishedContentCache } from './types'

/**
 * Next.js App Router cache — default for local and single-node runs.
 * Uses `unstable_cache` + `revalidateTag` (no Redis required).
 */
export const nextPublishedContentCache: PublishedContentCache = {
  getCached<T>(options: ContentCacheGetOptions, loader: () => Promise<T>): Promise<T> {
    const cached = unstable_cache(loader, options.key, {
      tags: [...options.tags],
      revalidate: options.revalidate ?? false,
    })
    return cached()
  },

  invalidateTags(tags: readonly string[]): void {
    for (const tag of tags) {
      try {
        // expire: 0 — next request blocks for fresh CMS data (editors expect publish → refresh).
        revalidateTag(tag, { expire: 0 })
      } catch {
        // Hooks / seed may run outside a Next request context; ignore quietly.
      }
    }
  },
}
