/**
 * product:social discover — public posts outside the friends / following graphs.
 *
 * Candidates are personal public posts only. Friends-only (and other audiences)
 * are absent. canViewPost still applies (block / hidden / staff-hide).
 */

import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'
import { paginateFeedPosts } from './feed'
import { matchesFeedQuietExclusion } from './quiet'

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
 * Filter with canViewPost, then quiet cut, then paginate.
 */
export function selectDiscoverFeedPage(
  postsNewestFirst: readonly PostRecord[],
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
  quiet?: {
    viewerUserId?: string | null
    hiddenPostIds?: ReadonlySet<string>
    mutedAuthorIds?: ReadonlySet<string>
  },
): PostRecord[] {
  const viewer = quiet?.viewerUserId ?? null
  const visible = postsNewestFirst.filter((post) => {
    if (!isDiscoverFeedCandidate(post)) return false
    if (!canViewPost(post, ctxForPost(post))) return false
    if (
      matchesFeedQuietExclusion(post, viewer, {
        hiddenPostIds: quiet?.hiddenPostIds,
        mutedAuthorIds: quiet?.mutedAuthorIds,
      })
    ) {
      return false
    }
    return true
  })
  return paginateFeedPosts(visible, limit)
}
