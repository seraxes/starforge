import { unstable_cache } from 'next/cache'

import { revalidateTagNow, type CacheInvalidateMode } from '../defer-revalidate'

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

  async invalidateTags(
    tags: readonly string[],
    mode: CacheInvalidateMode = 'stale',
  ): Promise<void> {
    // `stale` keeps the action from blocking the next read (media upload hang,
    // layout save → public 503). `expire` still returns immediately, but the
    // following read misses instead of painting one stale copy.
    for (const tag of tags) revalidateTagNow(tag, mode)
  },
}
