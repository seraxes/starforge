/**
 * product:social discover — public posts outside the friends / following graphs.
 *
 * Candidates are personal public posts only. Friends-only (and other audiences)
 * are absent. canViewPost still applies (block / hidden / staff-hide).
 */

import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'
import { paginateFeedPosts } from './feed'

/**
 * Candidate for Discover: personal public post (not a page wall).
 * Friends-only / only_me / group are never candidates.
 */
export function isDiscoverFeedCandidate(post: PostRecord): boolean {
  if (post.pageId) return false
  return post.audience === 'public'
}

/**
 * Discover page: public posts the viewer may read.
 * Filter with canViewPost, then paginate (no short page from drop-in-memory).
 */
export function selectDiscoverFeedPage(
  postsNewestFirst: readonly PostRecord[],
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
): PostRecord[] {
  const visible = postsNewestFirst.filter((post) => {
    if (!isDiscoverFeedCandidate(post)) return false
    return canViewPost(post, ctxForPost(post))
  })
  return paginateFeedPosts(visible, limit)
}
