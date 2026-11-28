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
 * The next read can still render the previous entry, so a public reload shows
 * the old layout once and the saved one on the reload after that.
 * It also does not repaint dynamic data on the open page (a new Social post
 * stays invisible until a full reload). Call `refreshCurrentRoute()` from the
 * action when the page the person is looking at must show the write.
 *
 * `expire` uses a 1ms lifetime instead of `0`. The tag is already expired by
 * the time a person reloads, so `unstable_cache` misses, and the action is
 * not marked revalidated (that flag is `expire === 0` or `updateTag`).
 */
export type CacheInvalidateMode = 'stale' | 'expire'

/** Positive and below 1s so the next read misses without blocking the action. */
export const CACHE_EXPIRE_ON_NEXT_READ_SEC = 0.001

export function publishedCacheTagProfile(
  mode: CacheInvalidateMode = 'stale',
): 'max' | { expire: number } {
  if (mode === 'expire') return { expire: CACHE_EXPIRE_ON_NEXT_READ_SEC }
  return 'max'
}
const IMPLICIT_PATH_TAG = '_N_T_'

function implicitPathTag(path: string, type?: 'layout' | 'page'): string {
  const stripped = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  let tag = `${IMPLICIT_PATH_TAG}${stripped}`
  if (type) tag += tag.endsWith('/') ? type : `/${type}`
  return tag
}

function markTag(tag: string, mode: CacheInvalidateMode): void {
  try {
    revalidateTag(tag, publishedCacheTagProfile(mode))
  } catch {
    // Seed and hooks may run outside a Next request.
  }
}

export function revalidatePath(path: string, type?: 'layout' | 'page'): void {
  markTag(implicitPathTag(path, type), 'stale')
}

/**
 * Drop a content-cache tag without blocking the next page read.
 * `expire` makes the following read miss. `stale` may still serve one old copy.
 */
export function revalidateTagNow(tag: string, mode: CacheInvalidateMode = 'stale'): void {
  markTag(tag, mode)
}

/**
 * Repaint the route that submitted this Server Action.
 *
 * Next's `refresh()` sets dynamic-only revalidation. It does not expire cache
 * tags, so it does not block the next read the way `expire: 0` does. Safe to
 * call more than once in one action. Outside a Server Action it throws; that
 * is swallowed so seeds and unit tests can share callers.
 *
 * `refresh` is required lazily so this module (pulled in by the content-cache
 * adapter on every public paint) does not import a Server-Action-only export
 * at load time.
 */
export function refreshCurrentRoute(refreshImpl?: () => void): void {
  try {
    const run =
      refreshImpl ??
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Server Action API
      (require('next/cache') as { refresh: () => void }).refresh
    run()
  } catch {
    // Seed and hooks may run outside a Next Server Action.
  }
}
