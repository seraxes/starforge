/**
 * product:social home / member feed selection (pure).
 *
 * Slice 7b: the home feed uses a visibility predicate that matches canViewPost,
 * then paginates. It does not over-fetch and drop rows in memory (that shortens
 * a page). Slice 13: group membership set (memberGroupIds). Slice 15: liked /
 * admin page sets (likedPageIds / adminPageIds).
 */

import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'

/**
 * Set-shaped facts the home-feed SQL predicate uses (friend / block / hidden lists).
 * Later slices that add a feed audience extend this and the parity test.
 */
export type HomeFeedVisibilityFacts = {
  /** Accepted friends of the viewer. */
  friendIds: ReadonlySet<string>
  /** Peers with either blocker column set (or status blocked). */
  blockedPeerIds: ReadonlySet<string>
  /** Authors whose account / profile is hidden from others. */
  hiddenAuthorIds: ReadonlySet<string>
  /** `social.posts` manage — review queue may see staff-hidden posts. */
  canManagePosts?: boolean
  /** Group ids the viewer belongs to (slice 13). */
  memberGroupIds?: ReadonlySet<string>
  /** Page ids the viewer likes (slice 15). */
  likedPageIds?: ReadonlySet<string>
  /** Page ids the viewer admins (slice 15). */
  adminPageIds?: ReadonlySet<string>
}

/**
 * Candidate for the friends home feed before visibility.
 * Own posts always; accepted friends’ friends/public posts;
 * group wall posts for groups the viewer belongs to;
 * page wall posts for pages the viewer likes or admins.
 */
export function isHomeFeedCandidate(
  post: PostRecord,
  viewerUserId: string,
  friendIds: ReadonlySet<string>,
  memberGroupIds?: ReadonlySet<string>,
  likedPageIds?: ReadonlySet<string>,
  adminPageIds?: ReadonlySet<string>,
): boolean {
  const viewer = viewerUserId.trim()
  if (!viewer) return false
  if (post.authorUserId === viewer) return true
  if (post.pageId) {
    return Boolean(
      likedPageIds?.has(post.pageId) || adminPageIds?.has(post.pageId),
    )
  }
  if (post.audience === 'group') {
    return Boolean(post.groupId && memberGroupIds?.has(post.groupId))
  }
  if (!friendIds.has(post.authorUserId)) return false
  return post.audience === 'friends' || post.audience === 'public'
}

/** Build a canViewPost context from set-shaped feed facts for one post. */
export function canViewPostContextFromFeedFacts(
  post: PostRecord,
  viewerUserId: string | null,
  facts: HomeFeedVisibilityFacts,
): CanViewPostContext {
  const viewer = viewerUserId?.trim() || null
  const author = post.authorUserId
  return {
    viewerUserId: viewer,
    areFriends: Boolean(viewer) && facts.friendIds.has(author),
    isBlocked: Boolean(viewer) && facts.blockedPeerIds.has(author),
    authorHidden: facts.hiddenAuthorIds.has(author),
    isGroupMember: Boolean(
      post.groupId && facts.memberGroupIds?.has(post.groupId),
    ),
    isPageLiker: Boolean(post.pageId && facts.likedPageIds?.has(post.pageId)),
    isPageAdmin: Boolean(post.pageId && facts.adminPageIds?.has(post.pageId)),
    canManagePosts: facts.canManagePosts ?? false,
  }
}

/**
 * In-memory evaluation of the canViewPost SQL predicate (set facts).
 * Encodes the same branches as canViewPost without calling it — parity tests
 * compare both. Later feed audiences extend this and the SQL WHERE together.
 */
export function matchesCanViewPostPredicate(
  post: PostRecord,
  viewerUserId: string | null,
  facts: HomeFeedVisibilityFacts,
): boolean {
  const viewer = viewerUserId?.trim() || null
  if (viewer && viewer === post.authorUserId) return true

  if (viewer && facts.blockedPeerIds.has(post.authorUserId)) return false
  if (facts.hiddenAuthorIds.has(post.authorUserId)) return false
  if (post.staffHidden && !(facts.canManagePosts ?? false)) return false

  if (post.pageId) {
    return Boolean(
      facts.likedPageIds?.has(post.pageId) || facts.adminPageIds?.has(post.pageId),
    )
  }

  switch (post.audience) {
    case 'only_me':
      return false
    case 'friends':
      return Boolean(viewer) && facts.friendIds.has(post.authorUserId)
    case 'public':
      return true
    case 'group':
      return Boolean(
        viewer && post.groupId && facts.memberGroupIds?.has(post.groupId),
      )
    default:
      return false
  }
}

/**
 * Home-feed row predicate: candidate scope plus canViewPost.
 * This is what the SQL WHERE encodes before LIMIT.
 */
export function matchesHomeFeedVisibilityPredicate(
  post: PostRecord,
  viewerUserId: string,
  facts: HomeFeedVisibilityFacts,
): boolean {
  if (
    !isHomeFeedCandidate(
      post,
      viewerUserId,
      facts.friendIds,
      facts.memberGroupIds,
      facts.likedPageIds,
      facts.adminPageIds,
    )
  ) {
    return false
  }
  return matchesCanViewPostPredicate(post, viewerUserId, facts)
}

/** Keep posts the viewer may read, newest first. */
export function selectVisibleFeedPosts(
  posts: readonly PostRecord[],
  ctxForPost: (post: PostRecord) => CanViewPostContext,
): PostRecord[] {
  return posts
    .filter((post) => canViewPost(post, ctxForPost(post)))
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Home feed: filter candidates with canViewPost.
 * Prefer matchesHomeFeedVisibilityPredicate + paginateFeedPosts for paged reads.
 */
export function selectHomeFeedPosts(
  posts: readonly PostRecord[],
  viewerUserId: string,
  friendIds: ReadonlySet<string>,
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  memberGroupIds?: ReadonlySet<string>,
  likedPageIds?: ReadonlySet<string>,
  adminPageIds?: ReadonlySet<string>,
): PostRecord[] {
  const candidates = posts.filter((post) =>
    isHomeFeedCandidate(
      post,
      viewerUserId,
      friendIds,
      memberGroupIds,
      likedPageIds,
      adminPageIds,
    ),
  )
  return selectVisibleFeedPosts(candidates, ctxForPost)
}

/**
 * Paginate posts already filtered by the visibility predicate (newest first).
 * Does not over-fetch and drop — that is the short-page failure path.
 */
export function paginateFeedPosts(
  visibleNewestFirst: readonly PostRecord[],
  limit: number,
): PostRecord[] {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  return visibleNewestFirst.slice(0, capped)
}

/**
 * Full home-feed page: filter with the SQL-shaped predicate, then LIMIT.
 * Scan the whole ordered list so a page does not come back short.
 */
export function selectHomeFeedPageByPredicate(
  postsNewestFirst: readonly PostRecord[],
  viewerUserId: string,
  facts: HomeFeedVisibilityFacts,
  limit: number,
): PostRecord[] {
  const visible = postsNewestFirst.filter((post) =>
    matchesHomeFeedVisibilityPredicate(post, viewerUserId, facts),
  )
  return paginateFeedPosts(visible, limit)
}

/**
 * Old load-then-filter page: take only the first overfetch window, then filter.
 * Can return fewer than `limit` even when more visible posts exist (failure path).
 */
export function loadThenFilterHomeFeedPage(
  postsNewestFirst: readonly PostRecord[],
  viewerUserId: string,
  facts: HomeFeedVisibilityFacts,
  limit: number,
  overfetchMultiplier = 3,
): PostRecord[] {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  const windowSize = Math.min(capped * overfetchMultiplier, 300)
  const window = postsNewestFirst.slice(0, windowSize)
  const visible: PostRecord[] = []
  for (const post of window) {
    if (matchesHomeFeedVisibilityPredicate(post, viewerUserId, facts)) {
      visible.push(post)
      if (visible.length >= capped) break
    }
  }
  return visible
}

/** Member wall: that author’s posts the viewer may see. */
export function selectMemberFeedPosts(
  posts: readonly PostRecord[],
  authorUserId: string,
  ctxForPost: (post: PostRecord) => CanViewPostContext,
): PostRecord[] {
  const author = authorUserId.trim()
  const candidates = posts.filter((post) => post.authorUserId === author)
  return selectVisibleFeedPosts(candidates, ctxForPost)
}
