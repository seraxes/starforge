/**
 * product:social short-video layout — fullscreen mode on the same media posts.
 *
 * Not a second module and not one of the four particles. Timeline stays the
 * default FB-like feed; short_video shows only single-video posts.
 * canViewPost still applies (block / hidden / staff-hide).
 */

import { paginateFeedPosts } from './feed'
import {
  canViewPost,
  classifyMediaMime,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

/** Layout modes on one Social pack — Hero brands them; admin default is slice 15b. */
export const FEED_LAYOUT_MODES = ['timeline', 'short_video'] as const
export type FeedLayoutMode = (typeof FEED_LAYOUT_MODES)[number]

export const DEFAULT_FEED_LAYOUT_MODE: FeedLayoutMode = 'timeline'

export type FeedLayoutRefuseReason = 'invalid_layout'

/**
 * True when the post carries exactly one video attachment (no image gallery).
 * Text-only and image-only posts are not short-video candidates.
 */
export function isShortVideoLayoutCandidate(post: PostRecord): boolean {
  if (post.media.length === 0) return false
  let videoCount = 0
  for (const item of post.media) {
    const kind = classifyMediaMime(item.mimeType)
    if (kind === 'image' || kind === 'other') return false
    if (kind === 'video') videoCount += 1
  }
  return videoCount === 1
}

export function isFeedLayoutMode(value: string): value is FeedLayoutMode {
  return (FEED_LAYOUT_MODES as readonly string[]).includes(value)
}

/**
 * Normalize a layout mode. Missing / blank → timeline.
 * Unknown non-blank → invalid_layout (named refuse for settings / toggles).
 */
export function resolveFeedLayoutMode(
  raw: unknown,
):
  | { ok: true; mode: FeedLayoutMode }
  | { ok: false; reason: FeedLayoutRefuseReason } {
  if (raw == null) return { ok: true, mode: DEFAULT_FEED_LAYOUT_MODE }
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid_layout' }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, mode: DEFAULT_FEED_LAYOUT_MODE }
  if (!isFeedLayoutMode(trimmed)) return { ok: false, reason: 'invalid_layout' }
  return { ok: true, mode: trimmed }
}

/**
 * Short-video page: video media posts the viewer may read.
 * Filter with isShortVideoLayoutCandidate + canViewPost, then paginate.
 */
export function selectShortVideoLayoutPage(
  postsNewestFirst: readonly PostRecord[],
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
): PostRecord[] {
  const visible = postsNewestFirst.filter((post) => {
    if (!isShortVideoLayoutCandidate(post)) return false
    return canViewPost(post, ctxForPost(post))
  })
  return paginateFeedPosts(visible, limit)
}
