/**
 * product:social albums persistence — create, add items, list.
 * Media bytes stay in product:media; this pack only stores mediaId.
 */

import 'server-only'

import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/core/db'
import { findMediaById, memberOwnsMedia } from '@/modules/media/api.server'

import {
  canViewAlbum,
  decideAddAlbumItem,
  decideCreateAlbum,
  selectAlbumItems,
  selectAlbumsForOwner,
  type AddAlbumItemInput,
  type AlbumItemMutationResult,
  type AlbumItemRecord,
  type AlbumMutationResult,
  type AlbumOwnerType,
  type AlbumRecord,
  type CreateAlbumInput,
} from './albums'
import { areBlocked } from './friends-store'
import { groupHref } from './groups'
import {
  findGroup,
  isUserActiveGroupMember,
  listActiveMemberGroupIds,
} from './groups-store'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { pageHref } from './pages'
import { findPage, isUserPageAdmin, isUserPageLiker } from './pages-store'
import { memberFeedHref } from './posts'
import { sfSocialAlbumItems, sfSocialAlbums } from './schema'

function mapAlbum(row: typeof sfSocialAlbums.$inferSelect): AlbumRecord {
  return {
    id: row.id,
    title: row.title,
    ownerType: row.ownerType as AlbumOwnerType,
    ownerId: row.ownerId,
    coverMediaId: row.coverMediaId,
    createdByUserId: row.createdByUserId,
    extensions: (row.extensions ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapItem(row: typeof sfSocialAlbumItems.$inferSelect): AlbumItemRecord {
  return {
    id: row.id,
    albumId: row.albumId,
    mediaId: row.mediaId,
    sortOrder: row.sortOrder,
    addedByUserId: row.addedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function resolveMediaForActor(
  actorUserId: string,
  mediaId: string,
): Promise<{ mediaId: string; mimeType: string | null } | null> {
  if (!(await memberOwnsMedia(actorUserId, mediaId))) return null
  const doc = await findMediaById(mediaId)
  if (!doc) return null
  return { mediaId: doc.id, mimeType: doc.mimeType ?? null }
}

export async function findAlbum(albumId: string): Promise<AlbumRecord | null> {
  const id = albumId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialAlbums)
      .where(eq(sfSocialAlbums.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapAlbum(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_albums|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findAlbumItem(
  albumId: string,
  mediaId: string,
): Promise<AlbumItemRecord | null> {
  const aid = albumId.trim()
  const mid = mediaId.trim()
  if (!aid || !mid) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialAlbumItems)
      .where(
        and(
          eq(sfSocialAlbumItems.albumId, aid),
          eq(sfSocialAlbumItems.mediaId, mid),
        ),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapItem(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_album_items|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function createAlbum(
  input: Omit<CreateAlbumInput, 'actorBannedAt'> & {
    coverMediaId?: string | null
  },
): Promise<AlbumMutationResult> {
  const createdByUserId = input.createdByUserId.trim()
  if (!createdByUserId) return { ok: false, reason: 'invalid' }

  const actorBannedAt = await getMemberBannedAt(createdByUserId)
  const coverRaw = input.coverMediaId?.trim() || null
  let coverResolved: { mediaId: string; mimeType: string | null } | null = null
  if (coverRaw) {
    coverResolved = await resolveMediaForActor(createdByUserId, coverRaw)
  }

  let albumsEnabled = true
  try {
    const { loadSocialModuleSettings } = await import('./settings')
    const pack = await loadSocialModuleSettings()
    albumsEnabled = pack.settings.allowAlbums
  } catch {
    albumsEnabled = true
  }

  const decision = decideCreateAlbum(
    { ...input, createdByUserId, actorBannedAt },
    {
      resolveMedia: coverRaw
        ? (id) => (coverResolved && coverResolved.mediaId === id.trim() ? coverResolved : null)
        : undefined,
      albumsEnabled,
    },
  )
  if (!decision.ok) return decision

  try {
    await db.insert(sfSocialAlbums).values({
      id: decision.album.id,
      title: decision.album.title,
      ownerType: decision.album.ownerType,
      ownerId: decision.album.ownerId,
      coverMediaId: decision.album.coverMediaId,
      createdByUserId: decision.album.createdByUserId,
      extensions: decision.album.extensions,
      createdAt: decision.album.createdAt,
      updatedAt: decision.album.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_albums|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function addAlbumItem(
  input: Omit<AddAlbumItemInput, 'actorBannedAt'>,
): Promise<AlbumItemMutationResult> {
  const actorUserId = input.actorUserId.trim()
  const albumId = input.albumId.trim()
  const mediaId = input.mediaId.trim()
  if (!actorUserId || !albumId || !mediaId) {
    return { ok: false, reason: 'invalid' }
  }

  const album = await findAlbum(albumId)
  const current = await findAlbumItem(albumId, mediaId)
  const actorBannedAt = await getMemberBannedAt(actorUserId)
  const media = await resolveMediaForActor(actorUserId, mediaId)

  let albumsEnabled = true
  let maxAlbumItems: number | undefined
  let currentItemCount: number | undefined
  try {
    const { loadSocialModuleSettings } = await import('./settings')
    const pack = await loadSocialModuleSettings()
    albumsEnabled = pack.settings.allowAlbums
    maxAlbumItems = pack.settings.maxAlbumItems
    if (!current) {
      const existing = await listAlbumItems(albumId)
      currentItemCount = existing.length
    }
  } catch {
    albumsEnabled = true
  }

  const decision = decideAddAlbumItem(
    album,
    current,
    { ...input, albumId, mediaId, actorUserId, actorBannedAt },
    {
      resolveMedia: () => media,
      albumsEnabled,
      maxAlbumItems,
      currentItemCount,
    },
  )
  if (!decision.ok) return decision

  try {
    if (decision.write === 'update') {
      await db
        .update(sfSocialAlbumItems)
        .set({
          sortOrder: decision.item.sortOrder,
          addedByUserId: decision.item.addedByUserId,
          updatedAt: decision.item.updatedAt,
        })
        .where(eq(sfSocialAlbumItems.id, decision.item.id))
    } else {
      await db.insert(sfSocialAlbumItems).values({
        id: decision.item.id,
        albumId: decision.item.albumId,
        mediaId: decision.item.mediaId,
        sortOrder: decision.item.sortOrder,
        addedByUserId: decision.item.addedByUserId,
        createdAt: decision.item.createdAt,
        updatedAt: decision.item.updatedAt,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_album_items|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function listAlbumsForOwner(
  ownerType: AlbumOwnerType,
  ownerId: string,
): Promise<AlbumRecord[]> {
  const oid = ownerId.trim()
  if (!oid) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialAlbums)
      .where(
        and(
          eq(sfSocialAlbums.ownerType, ownerType),
          eq(sfSocialAlbums.ownerId, oid),
        ),
      )
      .orderBy(desc(sfSocialAlbums.createdAt))
    return selectAlbumsForOwner(rows.map(mapAlbum), ownerType, oid)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_albums|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function listAlbumItems(albumId: string): Promise<AlbumItemRecord[]> {
  const aid = albumId.trim()
  if (!aid) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialAlbumItems)
      .where(eq(sfSocialAlbumItems.albumId, aid))
      .orderBy(asc(sfSocialAlbumItems.sortOrder), asc(sfSocialAlbumItems.createdAt))
    return selectAlbumItems(rows.map(mapItem), aid)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_album_items|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export type SocialAlbumParticleItem = {
  albumId: string
  title: string
  /** Cover or first item; null when the album has no images yet. */
  imageMediaId: string | null
  href: string
}

async function firstAlbumItemMediaId(albumId: string): Promise<string | null> {
  const items = await listAlbumItems(albumId)
  return items[0]?.mediaId ?? null
}

async function resolveAlbumParticleHref(
  album: AlbumRecord,
  handleByUserId: Map<string, string>,
): Promise<string | null> {
  if (album.ownerType === 'user') {
    const handle = handleByUserId.get(album.ownerId)?.trim()
    return handle ? memberFeedHref(handle) : null
  }
  if (album.ownerType === 'group') {
    const group = await findGroup(album.ownerId)
    return group ? groupHref(group.slug) : null
  }
  if (album.ownerType === 'page') {
    const page = await findPage(album.ownerId)
    return page ? pageHref(page.slug) : null
  }
  return null
}

async function albumVisibleToViewer(
  album: AlbumRecord,
  viewerUserId: string,
): Promise<boolean> {
  const viewer = viewerUserId.trim()
  if (!viewer) return false

  if (album.ownerType === 'user') {
    if (viewer === album.ownerId) return true
    const [blocked, actorHidden, otherHidden, actorBannedAt, otherBannedAt] =
      await Promise.all([
        areBlocked(viewer, album.ownerId),
        isMemberAccountHidden(viewer),
        isMemberAccountHidden(album.ownerId),
        getMemberBannedAt(viewer),
        getMemberBannedAt(album.ownerId),
      ])
    return canViewAlbum(album, {
      viewerUserId: viewer,
      interact: {
        isBlocked: blocked,
        actorHidden,
        otherHidden,
        actorBannedAt,
        otherBannedAt,
      },
    })
  }

  if (album.ownerType === 'group') {
    const isGroupMember = await isUserActiveGroupMember(viewer, album.ownerId)
    return canViewAlbum(album, { viewerUserId: viewer, isGroupMember })
  }

  if (album.ownerType === 'page') {
    const [isPageLiker, isPageAdmin] = await Promise.all([
      isUserPageLiker(viewer, album.ownerId),
      isUserPageAdmin(viewer, album.ownerId),
    ])
    return canViewAlbum(album, {
      viewerUserId: viewer,
      isPageLiker,
      isPageAdmin,
    })
  }

  return false
}

async function toAlbumParticleItems(
  albums: AlbumRecord[],
  viewerUserId: string,
  handleByUserId: Map<string, string>,
  limit: number,
): Promise<SocialAlbumParticleItem[]> {
  const out: SocialAlbumParticleItem[] = []
  for (const album of albums) {
    if (out.length >= limit) break
    if (!(await albumVisibleToViewer(album, viewerUserId))) continue
    const href = await resolveAlbumParticleHref(album, handleByUserId)
    if (!href) continue
    const imageMediaId =
      album.coverMediaId?.trim() || (await firstAlbumItemMediaId(album.id))
    if (!imageMediaId) continue
    out.push({
      albumId: album.id,
      title: album.title,
      imageMediaId,
      href,
    })
  }
  return out
}

/**
 * Albums for the social-albums particle (image-only cards).
 * source=viewer → member albums; groups → group albums (optional groupIds);
 * all → recent albums the viewer may see.
 */
export async function listAlbumsForParticle(opts: {
  source: 'viewer' | 'groups' | 'all'
  viewerUserId: string
  groupIds?: readonly string[]
  limit?: number
  /** userId → public handle for member album links. */
  handleByUserId?: Map<string, string>
}): Promise<SocialAlbumParticleItem[]> {
  const viewer = opts.viewerUserId.trim()
  if (!viewer) return []
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? 12)), 48)
  const handles = opts.handleByUserId ?? new Map<string, string>()

  try {
    if (opts.source === 'viewer') {
      const albums = await listAlbumsForOwner('user', viewer)
      return toAlbumParticleItems(albums, viewer, handles, limit)
    }

    if (opts.source === 'groups') {
      const rawIds = (opts.groupIds ?? []).map((id) => id.trim()).filter(Boolean)
      const groupIds =
        rawIds.length > 0 ? [...new Set(rawIds)] : await listActiveMemberGroupIds(viewer)
      if (groupIds.length === 0) return []
      const rows = await db
        .select()
        .from(sfSocialAlbums)
        .where(
          and(
            eq(sfSocialAlbums.ownerType, 'group'),
            inArray(sfSocialAlbums.ownerId, groupIds.slice(0, 100)),
          ),
        )
        .orderBy(desc(sfSocialAlbums.createdAt))
        .limit(Math.min(limit * 4, 100))
      return toAlbumParticleItems(rows.map(mapAlbum), viewer, handles, limit)
    }

    const rows = await db
      .select()
      .from(sfSocialAlbums)
      .orderBy(desc(sfSocialAlbums.createdAt))
      .limit(Math.min(limit * 6, 120))
    return toAlbumParticleItems(rows.map(mapAlbum), viewer, handles, limit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_album|does not exist|relation/i.test(msg)) return []
    throw error
  }
}
