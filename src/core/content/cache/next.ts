import { unstable_cache } from 'next/cache'

import { revalidateTagNow } from '../defer-revalidate'

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

  async invalidateTags(tags: readonly string[]): Promise<void> {
    // Stale-while-revalidate. Immediate expiry blocks the next read and
    // leaves /admin/media hung after upload.
    for (const tag of tags) revalidateTagNow(tag)
  },
}
