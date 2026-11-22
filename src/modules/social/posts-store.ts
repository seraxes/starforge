/**
 * product:social post persistence (sf_social_posts + sf_social_post_media).
 * Text / media posts and canViewPost helpers that load friendship / row state.
 */

import 'server-only'

import { asc, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/core/db'
import { isPrivateFormMedia } from '@/core/media/privacy'
import { findMediaById, memberOwnsMedia } from '@/modules/media/api.server'

import { areBlocked, areFriends } from './friends-store'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { viewerMayModerateSocialContent } from './staff-grant'
import {
  albumOwnerMediaAccess,
  canViewPost,
  createPostRecord,
  decideDeletePost,
  decideEditPost,
  decideSetPostAudience,
  decideStaffHidePost,
  groupDocumentMediaAccess,
  isPostAudience,
  isPostMediaRole,
  mediaAccessLevelFromFacts,
  resolvePostPermalink,
  storyMediaAccess,
  toPostRecord,
  type CanViewPostContext,
  type CreatePostInput,
  type DeletePostInput,
  type EditPostInput,
  type MediaAccessLevel,
  type SetPostAudienceInput,
  type MediaResolveResult,
  type PermalinkResult,
  type PostDeleteResult,
  type PostMediaAttachment,
  type PostMutationResult,
  type PostRecord,
  type StaffHidePostInput,
} from './posts'
import {
  sfSocialActivities,
  sfSocialAlbumItems,
  sfSocialAlbums,
  sfSocialComments,
  sfSocialGroupDocuments,
  sfSocialMentions,
  sfSocialPollVotes,
  sfSocialPostMedia,
  sfSocialPostTags,
  sfSocialPosts,
  sfSocialReactions,
  sfSocialSaves,
  sfSocialStories,
} from './schema'

async function resolveMediaMeta(mediaId: string): Promise<MediaResolveResult | null> {
  const doc = await findMediaById(mediaId)
  if (!doc) return null
  return { mediaId: doc.id, mimeType: doc.mimeType ?? null }
}

/**
 * Media door for this member: must exist and be owned via memberOwnsMedia.
 * Not owned / not found → null → createPostRecord refuses with unknown_media.
 */
async function resolveMediaMetaForMember(
  authorUserId: string,
  mediaId: string,
): Promise<MediaResolveResult | null> {
  if (!(await memberOwnsMedia(authorUserId, mediaId))) return null
  return resolveMediaMeta(mediaId)
}

/**
 * Current access level for each mediaId: private form media → only_me, else the
 * narrowest Social post / album / story / group-document bind. Pure combine is
 * mediaAccessLevelFromFacts — this only loads facts.
 */
async function resolveMediaAccessLevels(
  mediaIds: string[],
): Promise<Map<string, MediaAccessLevel>> {
  const out = new Map<string, MediaAccessLevel>()
  const ids = [...new Set(mediaIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return out

  const privateById = new Map<string, boolean>()
  for (const id of ids) {
    const doc = await findMediaById(id)
    privateById.set(
      id,
      doc
        ? isPrivateFormMedia({ folder: doc.folder, private: doc.private })
        : false,
    )
  }

  const bindsById = new Map<string, MediaAccessLevel[]>()
  const pushBind = (mediaId: string, bind: MediaAccessLevel) => {
    const list = bindsById.get(mediaId) ?? []
    list.push(bind)
    bindsById.set(mediaId, list)
  }

  try {
    const postRows = await db
      .select({
        mediaId: sfSocialPostMedia.mediaId,
        audience: sfSocialPosts.audience,
        groupId: sfSocialPosts.groupId,
      })
      .from(sfSocialPostMedia)
      .innerJoin(sfSocialPosts, eq(sfSocialPostMedia.postId, sfSocialPosts.id))
      .where(inArray(sfSocialPostMedia.mediaId, ids))
    for (const row of postRows) {
      if (!isPostAudience(row.audience)) continue
      pushBind(row.mediaId, {
        audience: row.audience,
        groupId: row.groupId,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_post|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const storyRows = await db
      .select({ mediaId: sfSocialStories.mediaId })
      .from(sfSocialStories)
      .where(inArray(sfSocialStories.mediaId, ids))
    for (const row of storyRows) {
      pushBind(row.mediaId, storyMediaAccess())
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_stories|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const docRows = await db
      .select({
        mediaId: sfSocialGroupDocuments.mediaId,
        groupId: sfSocialGroupDocuments.groupId,
      })
      .from(sfSocialGroupDocuments)
      .where(inArray(sfSocialGroupDocuments.mediaId, ids))
    for (const row of docRows) {
      pushBind(row.mediaId, groupDocumentMediaAccess(row.groupId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_group_documents|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const albumItemRows = await db
      .select({
        mediaId: sfSocialAlbumItems.mediaId,
        ownerType: sfSocialAlbums.ownerType,
        ownerId: sfSocialAlbums.ownerId,
      })
      .from(sfSocialAlbumItems)
      .innerJoin(sfSocialAlbums, eq(sfSocialAlbumItems.albumId, sfSocialAlbums.id))
      .where(inArray(sfSocialAlbumItems.mediaId, ids))
    for (const row of albumItemRows) {
      if (row.ownerType !== 'user' && row.ownerType !== 'group' && row.ownerType !== 'page') {
        continue
      }
      pushBind(row.mediaId, albumOwnerMediaAccess(row.ownerType, row.ownerId))
    }

    const coverRows = await db
      .select({
        mediaId: sfSocialAlbums.coverMediaId,
        ownerType: sfSocialAlbums.ownerType,
        ownerId: sfSocialAlbums.ownerId,
      })
      .from(sfSocialAlbums)
      .where(inArray(sfSocialAlbums.coverMediaId, ids))
    for (const row of coverRows) {
      const mediaId = row.mediaId?.trim()
      if (!mediaId) continue
      if (row.ownerType !== 'user' && row.ownerType !== 'group' && row.ownerType !== 'page') {
        continue
      }
      pushBind(mediaId, albumOwnerMediaAccess(row.ownerType, row.ownerId))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_album|does not exist|relation/i.test(msg)) throw error
  }

  for (const id of ids) {
    out.set(
      id,
      mediaAccessLevelFromFacts({
        isPrivateForm: privateById.get(id) === true,
        binds: bindsById.get(id) ?? [],
      }),
    )
  }
  return out
}

function mapMediaRow(row: typeof sfSocialPostMedia.$inferSelect): PostMediaAttachment | null {
  if (!isPostMediaRole(row.role)) return null
  return {
    mediaId: row.mediaId,
    role: row.role,
    sortOrder: row.sortOrder,
    mimeType: row.mimeType ?? null,
  }
}

function mapPostRow(
  row: typeof sfSocialPosts.$inferSelect,
  media: PostMediaAttachment[] = [],
): PostRecord | null {
  return toPostRecord(row, media)
}

async function listMediaForPosts(
  postIds: string[],
): Promise<Map<string, PostMediaAttachment[]>> {
  const out = new Map<string, PostMediaAttachment[]>()
  if (postIds.length === 0) return out
  try {
    const rows = await db
      .select()
      .from(sfSocialPostMedia)
      .where(inArray(sfSocialPostMedia.postId, postIds))
      .orderBy(asc(sfSocialPostMedia.sortOrder), asc(sfSocialPostMedia.createdAt))
    for (const row of rows) {
      const attachment = mapMediaRow(row)
      if (!attachment) continue
      const list = out.get(row.postId) ?? []
      list.push(attachment)
      out.set(row.postId, list)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_media|does not exist|relation/i.test(msg)) return out
    throw error
  }
  return out
}

export async function hydratePostsMedia(posts: PostRecord[]): Promise<PostRecord[]> {
  if (posts.length === 0) return posts
  const byPost = await listMediaForPosts(posts.map((p) => p.id))
  return posts.map((post) => ({
    ...post,
    media: byPost.get(post.id) ?? post.media ?? [],
  }))
}

export async function findPost(postId: string): Promise<PostRecord | null> {
  const id = postId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.id, id))
      .limit(1)
    if (!rows[0]) return null
    const byPost = await listMediaForPosts([id])
    return mapPostRow(rows[0], byPost.get(id) ?? [])
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function createPost(input: CreatePostInput): Promise<PostMutationResult> {
  // Pre-resolve so createPostRecord stays sync (unit tests inject a fake resolve).
  // Media door: unknown or not readable for this member → null → unknown_media.
  // Banned author → banned (slice 9b).
  const authorUserId = input.authorUserId.trim()
  const authorBannedAt = authorUserId ? await getMemberBannedAt(authorUserId) : null
  const cache = new Map<string, MediaResolveResult | null>()
  const mediaIds: string[] = []
  for (const raw of input.mediaIds ?? []) {
    const id = raw.trim()
    if (!id || cache.has(id)) continue
    mediaIds.push(id)
    cache.set(
      id,
      authorUserId ? await resolveMediaMetaForMember(authorUserId, id) : null,
    )
  }
  const accessLevels = await resolveMediaAccessLevels(mediaIds)

  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decided = createPostRecord(input, {
    resolveMedia: (mediaId) => cache.get(mediaId) ?? null,
    mediaAccessLevel: (mediaId) => accessLevels.get(mediaId.trim()),
    authorBannedAt,
    isKindEnabled: (kind) => isComposerPostKindEnabled(kind, pack.settings),
    holdForStaffReview: pack.settings.holdNewPostsForReview,
    blockedWords: pack.settings.blockedWords,
    maxImagesPerPost: pack.settings.maxImagesPerPost,
    allowPostVideo: pack.settings.allowPostVideo,
  })
  if (!decided.ok) return decided

  const next = decided.post
  await db.transaction(async (tx) => {
    await tx.insert(sfSocialPosts).values({
      id: next.id,
      authorUserId: next.authorUserId,
      body: next.body,
      kind: next.kind,
      audience: next.audience,
      groupId: next.groupId,
      pageId: next.pageId,
      sharedPostId: next.sharedPostId,
      linkUrl: next.linkUrl,
      linkTitle: next.linkTitle,
      linkDescription: next.linkDescription,
      linkImageUrl: next.linkImageUrl,
      pollOptions: next.pollOptions,
      pollClosedAt: next.pollClosedAt,
      placeLabel: next.placeLabel,
      mapsPinId: next.mapsPinId,
      placeLat: next.placeLat,
      placeLng: next.placeLng,
      staffHidden: next.staffHidden,
      isAnnouncement: next.isAnnouncement,
      editedAt: next.editedAt,
      extensions: next.extensions,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    })
    if (next.media.length > 0) {
      await tx.insert(sfSocialPostMedia).values(
        next.media.map((row) => ({
          id: crypto.randomUUID(),
          postId: next.id,
          mediaId: row.mediaId,
          mimeType: row.mimeType,
          role: row.role,
          sortOrder: row.sortOrder,
          createdAt: next.createdAt,
        })),
      )
    }
  })
  try {
    const { syncPostMentionsAndTags } = await import('./mentions-tags-saves-store')
    await syncPostMentionsAndTags(next.id, next.authorUserId, next.body)
  } catch {
    // Soft-fail — post row stays; tags/mentions can be repaired on edit.
  }
  return { ok: true, post: next }
}

/**
 * Resolve viewer facts that live outside the post row, then run canViewPost.
 * Group membership comes from sf_social_group_members (slice 13).
 * Page liker / admin come from sf_social_page_likes / sf_social_page_admins (slice 15).
 */
export async function canViewerSeePost(
  viewerUserId: string | null,
  post: PostRecord,
  extras?: Partial<
    Pick<
      CanViewPostContext,
      | 'authorHidden'
      | 'isGroupMember'
      | 'isPageLiker'
      | 'isPageAdmin'
      | 'canManagePosts'
      | 'guestCanReadPublic'
    >
  >,
): Promise<boolean> {
  const viewer = viewerUserId?.trim() || null
  const author = post.authorUserId
  const { isUserActiveGroupMember } = await import('./groups-store')
  const { isUserPageAdmin, isUserPageLiker } = await import('./pages-store')
  const [friends, blocked, socialHidden, isGroupMember, isPageLiker, isPageAdmin] =
    await Promise.all([
      viewer && viewer !== author ? areFriends(viewer, author) : Promise.resolve(false),
      viewer && viewer !== author ? areBlocked(viewer, author) : Promise.resolve(false),
      extras?.authorHidden !== undefined
        ? Promise.resolve(extras.authorHidden)
        : viewer === author
          ? Promise.resolve(false)
          : isMemberAccountHidden(author),
      extras?.isGroupMember !== undefined
        ? Promise.resolve(extras.isGroupMember)
        : viewer && post.groupId
          ? isUserActiveGroupMember(viewer, post.groupId)
          : Promise.resolve(false),
      extras?.isPageLiker !== undefined
        ? Promise.resolve(extras.isPageLiker)
        : viewer && post.pageId
          ? isUserPageLiker(viewer, post.pageId)
          : Promise.resolve(false),
      extras?.isPageAdmin !== undefined
        ? Promise.resolve(extras.isPageAdmin)
        : viewer && post.pageId
          ? isUserPageAdmin(viewer, post.pageId)
          : Promise.resolve(false),
    ])

  let guestCanReadPublic = extras?.guestCanReadPublic
  if (guestCanReadPublic === undefined && !viewer) {
    try {
      const { loadSocialModuleSettings } = await import('./settings')
      const pack = await loadSocialModuleSettings()
      guestCanReadPublic = pack.settings.guestCanReadPublic
    } catch {
      guestCanReadPublic = true
    }
  }

  const canManagePosts =
    extras?.canManagePosts ??
    (viewer ? await viewerMayModerateSocialContent(viewer) : false)

  return canViewPost(post, {
    viewerUserId: viewer,
    areFriends: friends,
    isBlocked: blocked,
    authorHidden: socialHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
    guestCanReadPublic: guestCanReadPublic ?? true,
  })
}

export async function getPostPermalink(
  viewerUserId: string | null,
  postId: string,
  extras?: Parameters<typeof canViewerSeePost>[2],
): Promise<PermalinkResult> {
  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'not_found' }
  const viewer = viewerUserId?.trim() || null
  const author = post.authorUserId
  const { isUserActiveGroupMember } = await import('./groups-store')
  const { isUserPageAdmin, isUserPageLiker } = await import('./pages-store')
  const [friends, blocked, socialHidden, isGroupMember, isPageLiker, isPageAdmin] =
    await Promise.all([
      viewer && viewer !== author ? areFriends(viewer, author) : Promise.resolve(false),
      viewer && viewer !== author ? areBlocked(viewer, author) : Promise.resolve(false),
      extras?.authorHidden !== undefined
        ? Promise.resolve(extras.authorHidden)
        : viewer === author
          ? Promise.resolve(false)
          : isMemberAccountHidden(author),
      extras?.isGroupMember !== undefined
        ? Promise.resolve(extras.isGroupMember)
        : viewer && post.groupId
          ? isUserActiveGroupMember(viewer, post.groupId)
          : Promise.resolve(false),
      extras?.isPageLiker !== undefined
        ? Promise.resolve(extras.isPageLiker)
        : viewer && post.pageId
          ? isUserPageLiker(viewer, post.pageId)
          : Promise.resolve(false),
      extras?.isPageAdmin !== undefined
        ? Promise.resolve(extras.isPageAdmin)
        : viewer && post.pageId
          ? isUserPageAdmin(viewer, post.pageId)
          : Promise.resolve(false),
    ])
  const canManagePosts =
    extras?.canManagePosts ??
    (viewer ? await viewerMayModerateSocialContent(viewer) : false)

  return resolvePostPermalink(post, {
    viewerUserId: viewer,
    areFriends: friends,
    isBlocked: blocked,
    authorHidden: socialHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
  })
}

/** Change audience. Author, or Social staff with canManagePosts. Body/editedAt stay. */
export async function setPostAudience(
  input: SetPostAudienceInput,
  gates?: { canManagePosts?: boolean },
): Promise<PostMutationResult> {
  const current = await findPost(input.postId)
  const accessLevels =
    current && current.media.length > 0
      ? await resolveMediaAccessLevels(current.media.map((row) => row.mediaId))
      : new Map<string, MediaAccessLevel>()
  const result = decideSetPostAudience(current, input, {
    canManagePosts: gates?.canManagePosts,
    mediaAccessLevel: (mediaId) => accessLevels.get(mediaId.trim()),
  })
  if (!result.ok) return result
  const next = result.post
  try {
    await db
      .update(sfSocialPosts)
      .set({
        audience: next.audience,
        groupId: next.groupId,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialPosts.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  const stored = await findPost(next.id)
  return stored ? { ok: true, post: stored } : { ok: true, post: next }
}

/** Body edit. Author, or Social staff with canManagePosts. */
export async function editPost(
  input: EditPostInput,
  gates?: { canManagePosts?: boolean },
): Promise<PostMutationResult> {
  const current = await findPost(input.postId)
  const result = decideEditPost(current, input, {
    canManagePosts: gates?.canManagePosts,
  })
  if (!result.ok) return result

  const next = result.post
  try {
    await db
      .update(sfSocialPosts)
      .set({
        body: next.body,
        editedAt: next.editedAt,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialPosts.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  try {
    const { syncPostMentionsAndTags } = await import('./mentions-tags-saves-store')
    await syncPostMentionsAndTags(next.id, next.authorUserId, next.body)
  } catch {
    // Soft-fail — body edit stays.
  }

  const stored = await findPost(next.id)
  return stored ? { ok: true, post: stored } : { ok: true, post: next }
}

/**
 * Delete. Author, or Social staff with canManagePosts.
 * Same transaction removes comments, likes (post reactions),
 * media binds, activity cards, tags, mentions, saves, poll votes, and share
 * posts that point at this post (sharedPostId). Report rows are kept.
 */
export async function deletePost(
  input: DeletePostInput,
  gates?: { canManagePosts?: boolean },
): Promise<PostDeleteResult> {
  const current = await findPost(input.postId)
  const result = decideDeletePost(current, input, {
    canManagePosts: gates?.canManagePosts,
  })
  if (!result.ok) return result

  const postId = result.postId
  try {
    await db.transaction(async (tx) => {
      const shareRows = await tx
        .select({ id: sfSocialPosts.id })
        .from(sfSocialPosts)
        .where(eq(sfSocialPosts.sharedPostId, postId))
      const shareIds = shareRows.map((row) => row.id)
      const cascadeIds = [postId, ...shareIds]

      await tx.delete(sfSocialComments).where(inArray(sfSocialComments.postId, cascadeIds))
      await tx
        .delete(sfSocialReactions)
        .where(
          and(
            eq(sfSocialReactions.targetType, 'post'),
            inArray(sfSocialReactions.targetId, cascadeIds),
          ),
        )
      await tx
        .delete(sfSocialPostMedia)
        .where(inArray(sfSocialPostMedia.postId, cascadeIds))
      await tx
        .delete(sfSocialActivities)
        .where(inArray(sfSocialActivities.postId, cascadeIds))
      await tx.delete(sfSocialPostTags).where(inArray(sfSocialPostTags.postId, cascadeIds))
      await tx.delete(sfSocialMentions).where(inArray(sfSocialMentions.postId, cascadeIds))
      await tx.delete(sfSocialSaves).where(inArray(sfSocialSaves.postId, cascadeIds))
      await tx
        .delete(sfSocialPollVotes)
        .where(inArray(sfSocialPollVotes.postId, cascadeIds))
      if (shareIds.length > 0) {
        await tx.delete(sfSocialPosts).where(inArray(sfSocialPosts.id, shareIds))
      }
      await tx.delete(sfSocialPosts).where(eq(sfSocialPosts.id, postId))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return result
}

/** Staff-hidden posts for the People admin list. */
export async function listStaffHiddenPosts(opts?: {
  limit?: number
}): Promise<PostRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  try {
    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.staffHidden, true))
      .orderBy(desc(sfSocialPosts.updatedAt))
      .limit(limit)
    const posts = rows
      .map((row) => toPostRecord(row))
      .filter((post): post is NonNullable<typeof post> => post != null)
    return await hydratePostsMedia(posts)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * Staff hide / restore a post. Requires social.posts manage.
 */
export async function setPostStaffHidden(
  input: StaffHidePostInput,
  gates: { canManagePosts: boolean },
): Promise<PostMutationResult> {
  const current = await findPost(input.postId)
  const result = decideStaffHidePost(current, input, gates)
  if (!result.ok) return result

  const next = result.post
  try {
    await db
      .update(sfSocialPosts)
      .set({
        staffHidden: next.staffHidden,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialPosts.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findPost(next.id)
  return stored ? { ok: true, post: stored } : { ok: true, post: next }
}
