/**
 * product:social short-video persistence — video posts for /feed/watch.
 *
 * Same home-feed visibility as listHomeFeedPosts, restricted to posts that
 * have a video/* media bind. Non-video posts are never selected.
 */

import 'server-only'

import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'

import { db } from '@/core/db'
import { listProfileDirectory } from '@/modules/profiles/api.server'

import {
  listAcceptedFriendIds,
} from './feed-store'
import { listActiveMemberGroupIds } from './groups-store'
import { listSocialHiddenUserIds } from './members-store'
import { listAdminPageIds, listLikedPageIds } from './pages-store'
import { listBlockedPeerIds } from './people-store'
import { toPostRecord, type PostRecord } from './posts'
import { hydratePostsMedia } from './posts-store'
import { sfSocialPostMedia, sfSocialPosts } from './schema'

async function listHiddenAuthorIds(): Promise<Set<string>> {
  const [profileHidden, socialHidden] = await Promise.all([
    (async () => {
      try {
        const rows = await listProfileDirectory({ status: 'hidden', limit: 500 })
        return new Set(rows.map((row) => row.userId.trim()).filter(Boolean))
      } catch {
        return new Set<string>()
      }
    })(),
    listSocialHiddenUserIds(),
  ])
  for (const id of socialHidden) profileHidden.add(id)
  return profileHidden
}

/**
 * Short-video layout: single-video posts the viewer may read on the home graph.
 * Omits text / image-only posts, blocked peers, and hidden authors.
 */
export async function listShortVideoLayoutPosts(
  viewerUserId: string,
  opts?: { limit?: number; canManagePosts?: boolean },
): Promise<PostRecord[]> {
  const viewer = viewerUserId.trim()
  if (!viewer) return []
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)
  const canManagePosts = opts?.canManagePosts ?? false

  const [
    friendIds,
    blockedPeerIds,
    hiddenAuthorIds,
    memberGroupIds,
    likedPageIds,
    adminPageIds,
  ] = await Promise.all([
    listAcceptedFriendIds(viewer),
    listBlockedPeerIds(viewer),
    listHiddenAuthorIds(),
    listActiveMemberGroupIds(viewer),
    listLikedPageIds(viewer),
    listAdminPageIds(viewer),
  ])

  const visibleFriendIds = friendIds.filter(
    (id) => !blockedPeerIds.has(id) && !hiddenAuthorIds.has(id),
  )
  const hiddenList = [...hiddenAuthorIds]
  const blockedList = [...blockedPeerIds]
  const visiblePageIds = [...new Set([...likedPageIds, ...adminPageIds])]

  const staffOk = canManagePosts
    ? sql`true`
    : eq(sfSocialPosts.staffHidden, false)

  const friendVisible =
    visibleFriendIds.length > 0
      ? and(
          inArray(sfSocialPosts.authorUserId, visibleFriendIds),
          inArray(sfSocialPosts.audience, ['friends', 'public']),
          isNull(sfSocialPosts.pageId),
          staffOk,
        )
      : sql`false`

  const authorNotBlocked =
    blockedList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, blockedList)
      : sql`true`
  const authorNotHidden =
    hiddenList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, hiddenList)
      : sql`true`

  const groupVisible =
    memberGroupIds.length > 0
      ? and(
          eq(sfSocialPosts.audience, 'group'),
          inArray(sfSocialPosts.groupId, memberGroupIds),
          authorNotBlocked,
          authorNotHidden,
          staffOk,
        )
      : sql`false`

  const pageVisible =
    visiblePageIds.length > 0
      ? and(
          inArray(sfSocialPosts.pageId, visiblePageIds),
          authorNotBlocked,
          authorNotHidden,
          staffOk,
        )
      : sql`false`

  const visibility = or(
    eq(sfSocialPosts.authorUserId, viewer),
    friendVisible,
    groupVisible,
    pageVisible,
  )

  // Posts with at least one video/* bind (image-only / text never match).
  const videoPostIds = db
    .select({ postId: sfSocialPostMedia.postId })
    .from(sfSocialPostMedia)
    .where(sql`lower(coalesce(${sfSocialPostMedia.mimeType}, '')) like 'video/%'`)

  let rows: (typeof sfSocialPosts.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(sfSocialPosts)
      .where(and(visibility, inArray(sfSocialPosts.id, videoPostIds)))
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(limit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|sf_social_post_media|does not exist|relation/i.test(msg)) {
      return []
    }
    throw error
  }

  const posts = rows
    .map((row) => toPostRecord(row))
    .filter((p): p is PostRecord => Boolean(p))
  return hydratePostsMedia(posts)
}
