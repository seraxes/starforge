/**
 * product:social — serve-time media access (bind lookup + viewer decision).
 *
 * App routes `/api/media/[id]` and `/api/media/file/[...key]` call
 * `decideSocialMediaServeAccess` through `@/modules/social/api.server`.
 * product:media must not import this pack.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { areBlocked, areFriends } from './friends-store'
import { isMemberAccountHidden } from './members-store'
import {
  albumOwnerMediaAccess,
  canViewBoundMedia,
  groupDocumentMediaAccess,
  isPostAudience,
  mediaBindIsRestricted,
  narrowerBoundMediaOwner,
  storyMediaAccess,
  type BoundMediaOwner,
  type CanViewPostContext,
} from './posts'
import { viewerMayModerateSocialContent } from './staff-grant'
import {
  sfSocialAlbumItems,
  sfSocialAlbums,
  sfSocialGroupDocuments,
  sfSocialPostMedia,
  sfSocialPosts,
  sfSocialStories,
} from './schema'

export type SocialMediaServeDecision =
  | { allow: true; restricted: false }
  | { allow: true; restricted: true }
  | { allow: false }

/**
 * Load Social binds for one media id and return the narrowest owning audience
 * (with owner facts for canViewBoundMedia). Null when unbound.
 */
export async function findNarrowestSocialMediaBind(
  mediaId: string,
): Promise<BoundMediaOwner | null> {
  const id = mediaId.trim()
  if (!id) return null

  const binds: BoundMediaOwner[] = []

  try {
    const postRows = await db
      .select({
        audience: sfSocialPosts.audience,
        groupId: sfSocialPosts.groupId,
        pageId: sfSocialPosts.pageId,
        authorUserId: sfSocialPosts.authorUserId,
        staffHidden: sfSocialPosts.staffHidden,
        pendingReview: sfSocialPosts.pendingReview,
      })
      .from(sfSocialPostMedia)
      .innerJoin(sfSocialPosts, eq(sfSocialPostMedia.postId, sfSocialPosts.id))
      .where(eq(sfSocialPostMedia.mediaId, id))
    for (const row of postRows) {
      if (!isPostAudience(row.audience)) continue
      binds.push({
        authorUserId: row.authorUserId,
        audience: row.audience,
        groupId: row.groupId,
        pageId: row.pageId,
        staffHidden: row.staffHidden,
        pendingReview: row.pendingReview,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_post|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const storyRows = await db
      .select({ authorUserId: sfSocialStories.authorUserId })
      .from(sfSocialStories)
      .where(eq(sfSocialStories.mediaId, id))
    const storyLevel = storyMediaAccess()
    for (const row of storyRows) {
      binds.push({
        authorUserId: row.authorUserId,
        audience: storyLevel.audience,
        groupId: storyLevel.groupId ?? null,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_stories|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const docRows = await db
      .select({
        groupId: sfSocialGroupDocuments.groupId,
        addedByUserId: sfSocialGroupDocuments.addedByUserId,
      })
      .from(sfSocialGroupDocuments)
      .where(eq(sfSocialGroupDocuments.mediaId, id))
    for (const row of docRows) {
      const level = groupDocumentMediaAccess(row.groupId)
      binds.push({
        authorUserId: row.addedByUserId,
        audience: level.audience,
        groupId: level.groupId ?? null,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_group_documents|does not exist|relation/i.test(msg)) throw error
  }

  try {
    const albumItemRows = await db
      .select({
        ownerType: sfSocialAlbums.ownerType,
        ownerId: sfSocialAlbums.ownerId,
        createdByUserId: sfSocialAlbums.createdByUserId,
      })
      .from(sfSocialAlbumItems)
      .innerJoin(sfSocialAlbums, eq(sfSocialAlbumItems.albumId, sfSocialAlbums.id))
      .where(eq(sfSocialAlbumItems.mediaId, id))

    const coverRows = await db
      .select({
        ownerType: sfSocialAlbums.ownerType,
        ownerId: sfSocialAlbums.ownerId,
        createdByUserId: sfSocialAlbums.createdByUserId,
      })
      .from(sfSocialAlbums)
      .where(eq(sfSocialAlbums.coverMediaId, id))

    for (const row of [...albumItemRows, ...coverRows]) {
      if (row.ownerType !== 'user' && row.ownerType !== 'group' && row.ownerType !== 'page') {
        continue
      }
      const level = albumOwnerMediaAccess(row.ownerType, row.ownerId)
      if (row.ownerType === 'page') {
        binds.push({
          authorUserId: row.createdByUserId,
          audience: level.audience,
          groupId: null,
          pageId: row.ownerId,
        })
      } else if (row.ownerType === 'group') {
        binds.push({
          authorUserId: row.createdByUserId,
          audience: level.audience,
          groupId: level.groupId ?? row.ownerId,
        })
      } else {
        binds.push({
          authorUserId: row.ownerId,
          audience: level.audience,
          groupId: null,
        })
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!/sf_social_album|does not exist|relation/i.test(msg)) throw error
  }

  if (binds.length === 0) return null
  return binds.reduce((acc, bind) => narrowerBoundMediaOwner(acc, bind))
}

async function resolveServeViewContext(
  viewerUserId: string | null,
  owning: BoundMediaOwner,
): Promise<CanViewPostContext> {
  const viewer = viewerUserId?.trim() || null
  const author = owning.authorUserId.trim()
  const groupId = owning.groupId?.trim() || null
  const pageId = owning.pageId?.trim() || null

  const { isUserActiveGroupMember } = await import('./groups-store')
  const { isUserPageAdmin, isUserPageLiker } = await import('./pages-store')

  const [
    friends,
    blocked,
    socialHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
  ] = await Promise.all([
    viewer && viewer !== author ? areFriends(viewer, author) : Promise.resolve(false),
    viewer && viewer !== author ? areBlocked(viewer, author) : Promise.resolve(false),
    viewer === author
      ? Promise.resolve(false)
      : isMemberAccountHidden(author),
    viewer && groupId
      ? isUserActiveGroupMember(viewer, groupId)
      : Promise.resolve(false),
    viewer && pageId ? isUserPageLiker(viewer, pageId) : Promise.resolve(false),
    viewer && pageId ? isUserPageAdmin(viewer, pageId) : Promise.resolve(false),
    viewer ? viewerMayModerateSocialContent(viewer) : Promise.resolve(false),
  ])

  let guestCanReadPublic = true
  if (!viewer) {
    try {
      const { loadSocialModuleSettings } = await import('./settings')
      const pack = await loadSocialModuleSettings()
      guestCanReadPublic = pack.settings.guestCanReadPublic
    } catch {
      guestCanReadPublic = true
    }
  }

  return {
    viewerUserId: viewer,
    areFriends: friends,
    isBlocked: blocked,
    authorHidden: socialHidden,
    isGroupMember,
    isPageLiker,
    isPageAdmin,
    canManagePosts,
    guestCanReadPublic,
  }
}

/**
 * Serve gate for a media id. Unbound / Social off → allow unrestricted.
 * Bound non-public → allow only when canViewBoundMedia passes; never public cache.
 */
export async function decideSocialMediaServeAccess(input: {
  mediaId: string
  viewerUserId: string | null
}): Promise<SocialMediaServeDecision> {
  const mediaId = input.mediaId.trim()
  if (!mediaId) return { allow: false }

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return { allow: true, restricted: false }
    }
  } catch {
    return { allow: true, restricted: false }
  }

  const owning = await findNarrowestSocialMediaBind(mediaId)
  if (!owning) {
    return { allow: true, restricted: false }
  }

  const restricted = mediaBindIsRestricted({
    audience: owning.audience,
    groupId: owning.groupId,
  })
  const ctx = await resolveServeViewContext(input.viewerUserId, owning)
  if (!canViewBoundMedia(owning, ctx)) {
    return { allow: false }
  }
  return restricted
    ? { allow: true, restricted: true }
    : { allow: true, restricted: false }
}
