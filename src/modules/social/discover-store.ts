/**
 * product:social discover persistence — public post list for /feed/discover.
 *
 * SQL filters audience=public + block/hidden/staff-hide, then LIMIT.
 * Friends-only posts are never selected (named failure: absent from discover).
 */

import 'server-only'

import { and, desc, eq, isNull, ne, notInArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { listSocialHiddenUserIds } from './members-store'
import { listBlockedPeerIds } from './people-store'
import { toPostRecord, type PostRecord } from './posts'
import { hydratePostsMedia } from './posts-store'
import {
  listHiddenPostIdsForViewer,
  listMutedAuthorIdsForViewer,
} from './quiet-store'
import { sfSocialPosts } from './schema'

/**
 * Discover: personal public posts the viewer may read.
 * Omits friends-only, page walls, staff-hidden, blocked peers, hidden authors,
 * muted authors, and viewer-hidden posts.
 */
export async function listDiscoverFeedPosts(
  viewerUserId: string | null,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const viewer = viewerUserId?.trim() || null
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)

  const [blockedPeerIds, hiddenAuthorIds, hiddenPostIds, mutedAuthorIds] =
    await Promise.all([
      viewer ? listBlockedPeerIds(viewer) : Promise.resolve(new Set<string>()),
      listSocialHiddenUserIds(),
      viewer ? listHiddenPostIdsForViewer(viewer) : Promise.resolve(new Set<string>()),
      viewer ? listMutedAuthorIdsForViewer(viewer) : Promise.resolve(new Set<string>()),
    ])

  const hiddenList = [...hiddenAuthorIds]
  const blockedList = [...blockedPeerIds]
  const mutedList = [...mutedAuthorIds]
  const hiddenPostList = [...hiddenPostIds]
  const authorNotBlocked =
    blockedList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, blockedList)
      : sql`true`
  const authorNotHidden =
    hiddenList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, hiddenList)
      : sql`true`
  const authorNotMuted =
    mutedList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, mutedList)
      : sql`true`
  const postNotHidden =
    hiddenPostList.length > 0
      ? notInArray(sfSocialPosts.id, hiddenPostList)
      : sql`true`

  let rows: (typeof sfSocialPosts.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(sfSocialPosts)
      .where(
        and(
          eq(sfSocialPosts.audience, 'public'),
          ne(sfSocialPosts.kind, 'conversation'),
          isNull(sfSocialPosts.pageId),
          eq(sfSocialPosts.staffHidden, false),
          eq(sfSocialPosts.pendingReview, false),
          authorNotBlocked,
          authorNotHidden,
          authorNotMuted,
          postNotHidden,
        ),
      )
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(limit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return []
    }
    throw error
  }

  const posts = rows
    .map((row) => toPostRecord(row))
    .filter((p): p is PostRecord => Boolean(p))
  return hydratePostsMedia(posts)
}
