/**
 * product:social feed persistence — home feed, member wall, friends particle lists.
 *
 * Slice 7b: home feed applies a SQL visibility predicate that matches canViewPost,
 * then LIMIT — no over-fetch + drop (that shortens a page).
 */

import 'server-only'

import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'

import { db } from '@/core/db'
import { listProfileDirectory } from '@/modules/profiles/api.server'

import { areBlocked, areFriends } from './friends-store'
import { isUserActiveGroupMember, listActiveMemberGroupIds } from './groups-store'
import { isMemberAccountHidden, listSocialHiddenUserIds } from './members-store'
import {
  isUserPageAdmin,
  isUserPageLiker,
  listAdminPageIds,
  listLikedPageIds,
} from './pages-store'
import { listBlockedPeerIds } from './people-store'
import {
  canViewPost,
  toPostRecord,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import { hydratePostsMedia } from './posts-store'
import { sfSocialFriendships, sfSocialPosts } from './schema'
import { viewerMayModerateSocialContent } from './staff-grant'

function mapPostRow(row: typeof sfSocialPosts.$inferSelect): PostRecord | null {
  return toPostRecord(row)
}

function otherUserId(row: typeof sfSocialFriendships.$inferSelect, selfId: string): string {
  return row.requesterId === selfId ? row.addresseeId : row.requesterId
}

async function viewCtxForPost(
  viewerUserId: string | null,
  post: PostRecord,
): Promise<CanViewPostContext> {
  const viewer = viewerUserId?.trim() || null
  const author = post.authorUserId
  const [
    friends,
    blocked,
    authorHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
  ] = await Promise.all([
    viewer && viewer !== author ? areFriends(viewer, author) : Promise.resolve(false),
    viewer && viewer !== author ? areBlocked(viewer, author) : Promise.resolve(false),
    // Author may always see own posts (canViewPost); hidden still blocks others.
    viewer === author ? Promise.resolve(false) : isMemberAccountHidden(author),
    viewer && post.groupId
      ? isUserActiveGroupMember(viewer, post.groupId)
      : Promise.resolve(false),
    viewer && post.pageId
      ? isUserPageLiker(viewer, post.pageId)
      : Promise.resolve(false),
    viewer && post.pageId
      ? isUserPageAdmin(viewer, post.pageId)
      : Promise.resolve(false),
    viewer ? viewerMayModerateSocialContent(viewer) : Promise.resolve(false),
  ])
  return {
    viewerUserId: viewer,
    areFriends: friends,
    isBlocked: blocked,
    authorHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
  }
}

/** Accepted friend user ids for a member (unordered). */
export async function listAcceptedFriendIds(userId: string): Promise<string[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.status, 'accepted'),
          or(
            eq(sfSocialFriendships.requesterId, self),
            eq(sfSocialFriendships.addresseeId, self),
          ),
        ),
      )
    return rows.map((row) => otherUserId(row, self)).filter(Boolean)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Incoming pending friend requests for the addressee. */
export async function countIncomingFriendRequests(userId: string): Promise<number> {
  const self = userId.trim()
  if (!self) return 0
  try {
    const rows = await db
      .select({ id: sfSocialFriendships.id })
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.status, 'pending'),
          eq(sfSocialFriendships.addresseeId, self),
        ),
      )
    return rows.length
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return 0
    throw error
  }
}

export type SocialFriendListItem = {
  userId: string
  friendshipId: string
}

/** Accepted friends for the social-friends particle (newest first). */
export async function listAcceptedFriends(
  userId: string,
  limit = 20,
): Promise<SocialFriendListItem[]> {
  const self = userId.trim()
  if (!self) return []
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.status, 'accepted'),
          or(
            eq(sfSocialFriendships.requesterId, self),
            eq(sfSocialFriendships.addresseeId, self),
          ),
        ),
      )
      .orderBy(desc(sfSocialFriendships.updatedAt))
      .limit(capped)
    return rows.map((row) => ({
      userId: otherUserId(row, self),
      friendshipId: row.id,
    }))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * Hidden author ids: Profiles status hidden, or Social account hide (hiddenAt).
 * Profiles door only — not sf_profiles import.
 */
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
 * Home friends feed for a signed-in viewer.
 * SQL predicate matches canViewPost for the audiences home feed queries, then LIMIT.
 */
export async function listHomeFeedPosts(
  viewerUserId: string,
  opts?: { limit?: number; canManagePosts?: boolean },
): Promise<PostRecord[]> {
  const viewer = viewerUserId.trim()
  if (!viewer) return []
  let defaultLimit = 50
  if (opts?.limit == null) {
    try {
      const { loadSocialModuleSettings } = await import('./settings')
      const pack = await loadSocialModuleSettings()
      defaultLimit = pack.settings.feedPageSize
    } catch {
      defaultLimit = 50
    }
  }
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? defaultLimit)), 100)
  const canManagePosts =
    opts?.canManagePosts ?? (await viewerMayModerateSocialContent(viewer))

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

  // Friends whose posts can appear for this viewer (block / hidden deny like canViewPost).
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

  // Staff private-read: only_me / friends / group without friendship or membership
  // (parity with canViewPost). Block + author-hidden still deny.
  const staffPrivateVisible = canManagePosts
    ? and(
        authorNotBlocked,
        authorNotHidden,
        isNull(sfSocialPosts.pageId),
        inArray(sfSocialPosts.audience, ['only_me', 'friends', 'group', 'public']),
        staffOk,
      )
    : sql`false`

  // Own posts always; friends’ friends/public; group walls; liked/admin pages;
  // staff private-read when granted.
  const visibility = or(
    eq(sfSocialPosts.authorUserId, viewer),
    friendVisible,
    groupVisible,
    pageVisible,
    staffPrivateVisible,
  )

  let rows: (typeof sfSocialPosts.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(sfSocialPosts)
      .where(visibility)
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(limit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return []
    throw error
  }

  const posts = rows.map(mapPostRow).filter((p): p is PostRecord => Boolean(p))
  return hydratePostsMedia(posts)
}

/** Member wall posts the viewer may see. */
export async function listMemberFeedPosts(
  viewerUserId: string | null,
  authorUserId: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const author = authorUserId.trim()
  if (!author) return []
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)

  let rows: (typeof sfSocialPosts.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.authorUserId, author))
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(Math.min(limit * 2, 200))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return []
    throw error
  }

  const posts = rows.map(mapPostRow).filter((p): p is PostRecord => Boolean(p))
  const visible: PostRecord[] = []
  for (const post of posts) {
    const ctx = await viewCtxForPost(viewerUserId, post)
    if (canViewPost(post, ctx)) visible.push(post)
    if (visible.length >= limit) break
  }
  return hydratePostsMedia(visible)
}
