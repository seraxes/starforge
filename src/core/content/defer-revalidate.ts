import { revalidateTag } from 'next/cache'

/**
 * Stale-while-revalidate invalidation.
 *
 * `revalidatePath()` and `revalidateTag(tag, { expire: 0 })` mark the Server
 * Action as revalidated and make the next request wait for a fresh render.
 * That wait deadlocks this app: the Media library stays disabled after upload,
 * a reload of `/admin/media` never finishes, and a layout save hard-reloads
 * the public front page into the offline 503 loop.
 *
 * Profile `max` only marks the cache stale. The action returns immediately.
 * The next read can render without blocking on the invalidation.
 */
const IMPLICIT_PATH_TAG = '_N_T_'

function implicitPathTag(path: string, type?: 'layout' | 'page'): string {
  const stripped = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  let tag = `${IMPLICIT_PATH_TAG}${stripped}`
  if (type) tag += tag.endsWith('/') ? type : `/${type}`
  return tag
}

function markStale(tag: string): void {
  try {
    revalidateTag(tag, 'max')
  } catch {
    // Seed and hooks may run outside a Next request.
  }
}

export function revalidatePath(path: string, type?: 'layout' | 'page'): void {
  markStale(implicitPathTag(path, type))
}

/** Drop a content-cache tag without blocking the next page read. */
export function revalidateTagNow(tag: string): void {
  markStale(tag)
}
