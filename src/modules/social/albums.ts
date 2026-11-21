/**
 * product:social albums — named media collections on a member, group, or page.
 *
 * Files stay in product:media; Social only stores mediaId binds. A multi-image
 * post is not an album. Adding an item refuses an unknown mediaId.
 * Viewing a member album calls canInteract — it does not re-derive the block rule.
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import type { MediaResolveResult } from './posts'

export const ALBUM_OWNER_TYPES = ['user', 'group', 'page'] as const
export type AlbumOwnerType = (typeof ALBUM_OWNER_TYPES)[number]

export type AlbumRecord = {
  id: string
  title: string
  ownerType: AlbumOwnerType
  ownerId: string
  coverMediaId: string | null
  createdByUserId: string
  extensions: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type AlbumItemRecord = {
  id: string
  albumId: string
  mediaId: string
  sortOrder: number
  addedByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type AlbumRefuseReason =
  | 'invalid'
  | 'not_found'
  | 'banned'
  | 'blocked'
  | 'cannot_interact'
  | 'not_allowed'
  | 'unknown_media'
  | 'cannot_view'
  | 'disabled'
  | 'item_cap'

export type AlbumMutationResult =
  | { ok: true; album: AlbumRecord }
  | { ok: false; reason: AlbumRefuseReason }

export type AlbumItemMutationResult =
  | { ok: true; item: AlbumItemRecord; write: 'insert' | 'update' }
  | { ok: false; reason: AlbumRefuseReason }

export type CreateAlbumInput = {
  title: string
  ownerType: AlbumOwnerType
  ownerId: string
  createdByUserId: string
  coverMediaId?: string | null
  actorBannedAt?: Date | null
  /** Active membership when ownerType is group. */
  isGroupMember?: boolean
  /** Page admin when ownerType is page. */
  isPageAdmin?: boolean
  extensions?: Record<string, unknown>
}

export type AddAlbumItemInput = {
  albumId: string
  mediaId: string
  actorUserId: string
  sortOrder?: number
  actorBannedAt?: Date | null
  isGroupMember?: boolean
  isPageAdmin?: boolean
}

export type CanViewAlbumContext = {
  viewerUserId: string
  /** For ownerType user — interact with the album owner. */
  interact?: CanInteractContext
  isGroupMember?: boolean
  isPageLiker?: boolean
  isPageAdmin?: boolean
}

export function isAlbumOwnerType(value: unknown): value is AlbumOwnerType {
  return (
    typeof value === 'string' &&
    (ALBUM_OWNER_TYPES as readonly string[]).includes(value)
  )
}

/** True when the actor may create or add items on this album’s owner. */
export function canManageAlbumOwner(
  ownerType: AlbumOwnerType,
  ownerId: string,
  actorUserId: string,
  ctx: {
    isGroupMember?: boolean
    isPageAdmin?: boolean
  },
): boolean {
  const actor = actorUserId.trim()
  const owner = ownerId.trim()
  if (!actor || !owner) return false
  if (ownerType === 'user') return actor === owner
  if (ownerType === 'group') return ctx.isGroupMember === true
  if (ownerType === 'page') return ctx.isPageAdmin === true
  return false
}

/**
 * Read check for one album.
 * Member albums: owner always; others need canInteract with the owner.
 * Group albums: active members. Page albums: likers and page admins.
 */
export function canViewAlbum(
  album: AlbumRecord,
  ctx: CanViewAlbumContext,
): boolean {
  const viewer = ctx.viewerUserId.trim()
  if (!viewer) return false

  if (album.ownerType === 'user') {
    if (viewer === album.ownerId) return true
    if (!ctx.interact) return false
    return canInteract(viewer, album.ownerId, ctx.interact)
  }
  if (album.ownerType === 'group') return ctx.isGroupMember === true
  if (album.ownerType === 'page') {
    return ctx.isPageLiker === true || ctx.isPageAdmin === true
  }
  return false
}

export function decideCreateAlbum(
  input: CreateAlbumInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
    /** Pack allowAlbums switch. false → disabled. */
    albumsEnabled?: boolean
  },
): AlbumMutationResult {
  const title = input.title.trim()
  const ownerId = input.ownerId.trim()
  const createdByUserId = input.createdByUserId.trim()
  if (!title || !ownerId || !createdByUserId) return { ok: false, reason: 'invalid' }
  if (!isAlbumOwnerType(input.ownerType)) return { ok: false, reason: 'invalid' }
  if (opts?.albumsEnabled === false) return { ok: false, reason: 'disabled' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (
    !canManageAlbumOwner(input.ownerType, ownerId, createdByUserId, {
      isGroupMember: input.isGroupMember,
      isPageAdmin: input.isPageAdmin,
    })
  ) {
    return { ok: false, reason: 'not_allowed' }
  }

  let coverMediaId: string | null = null
  const rawCover = input.coverMediaId?.trim() || null
  if (rawCover) {
    const resolveMedia = opts?.resolveMedia
    if (!resolveMedia) return { ok: false, reason: 'unknown_media' }
    const media = resolveMedia(rawCover)
    if (!media) return { ok: false, reason: 'unknown_media' }
    coverMediaId = media.mediaId
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    album: {
      id: newId(),
      title,
      ownerType: input.ownerType,
      ownerId,
      coverMediaId,
      createdByUserId,
      extensions: input.extensions ?? {},
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Add a media bind to an album. Unknown mediaId → unknown_media.
 * Unique (albumId, mediaId): a second add updates that row.
 */
export function decideAddAlbumItem(
  album: AlbumRecord | null,
  current: AlbumItemRecord | null,
  input: AddAlbumItemInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
    /** Pack allowAlbums switch. false → disabled. */
    albumsEnabled?: boolean
    /** Distinct item count already on the album (before this insert). */
    currentItemCount?: number
    /** Pack maxAlbumItems. Omitted → no cap check. */
    maxAlbumItems?: number
  },
): AlbumItemMutationResult {
  if (!album || album.id.trim() !== input.albumId.trim()) {
    return { ok: false, reason: 'not_found' }
  }
  const actorUserId = input.actorUserId.trim()
  const mediaId = input.mediaId.trim()
  if (!actorUserId || !mediaId) return { ok: false, reason: 'invalid' }
  if (opts?.albumsEnabled === false) return { ok: false, reason: 'disabled' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (
    !canManageAlbumOwner(album.ownerType, album.ownerId, actorUserId, {
      isGroupMember: input.isGroupMember,
      isPageAdmin: input.isPageAdmin,
    })
  ) {
    return { ok: false, reason: 'not_allowed' }
  }

  const resolveMedia = opts?.resolveMedia
  if (!resolveMedia) return { ok: false, reason: 'unknown_media' }
  const media = resolveMedia(mediaId)
  if (!media) return { ok: false, reason: 'unknown_media' }

  const now = opts?.now ?? new Date()
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : current?.sortOrder ?? 0

  if (
    current &&
    current.albumId === album.id &&
    current.mediaId === media.mediaId
  ) {
    return {
      ok: true,
      write: 'update',
      item: {
        ...current,
        sortOrder,
        addedByUserId: actorUserId,
        updatedAt: now,
      },
    }
  }

  const maxAlbumItems = opts?.maxAlbumItems
  const currentItemCount = opts?.currentItemCount
  if (
    typeof maxAlbumItems === 'number' &&
    Number.isInteger(maxAlbumItems) &&
    maxAlbumItems > 0 &&
    typeof currentItemCount === 'number' &&
    Number.isInteger(currentItemCount) &&
    currentItemCount >= maxAlbumItems
  ) {
    return { ok: false, reason: 'item_cap' }
  }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    write: 'insert',
    item: {
      id: newId(),
      albumId: album.id,
      mediaId: media.mediaId,
      sortOrder,
      addedByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/** Albums for one owner, newest first. */
export function selectAlbumsForOwner(
  albums: readonly AlbumRecord[],
  ownerType: AlbumOwnerType,
  ownerId: string,
): AlbumRecord[] {
  const oid = ownerId.trim()
  return albums
    .filter((row) => row.ownerType === ownerType && row.ownerId === oid)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Items in an album, by sortOrder then createdAt. */
export function selectAlbumItems(
  items: readonly AlbumItemRecord[],
  albumId: string,
): AlbumItemRecord[] {
  const aid = albumId.trim()
  return items
    .filter((row) => row.albumId === aid)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
}

export type AlbumBag = {
  albums: Map<string, AlbumRecord>
  items: Map<string, AlbumItemRecord>
}

function itemKey(albumId: string, mediaId: string): string {
  return `${albumId}\0${mediaId}`
}

export function applyCreateAlbum(
  bag: AlbumBag,
  input: CreateAlbumInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
  },
): AlbumMutationResult {
  const decision = decideCreateAlbum(input, opts)
  if (!decision.ok) return decision
  bag.albums.set(decision.album.id, decision.album)
  return decision
}

export function applyAddAlbumItem(
  bag: AlbumBag,
  input: AddAlbumItemInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
  },
): AlbumItemMutationResult {
  const album = bag.albums.get(input.albumId.trim()) ?? null
  const mediaId = input.mediaId.trim()
  const current =
    album && mediaId
      ? bag.items.get(itemKey(album.id, mediaId)) ?? null
      : null
  const decision = decideAddAlbumItem(album, current, input, opts)
  if (!decision.ok) return decision
  bag.items.set(itemKey(decision.item.albumId, decision.item.mediaId), decision.item)
  return decision
}

/** In-memory albums for unit tests — same unique item rules as the DB. */
export function createAlbumMemory(opts?: {
  now?: () => Date
  newId?: () => string
  resolveMedia?: (mediaId: string) => MediaResolveResult | null
}): {
  bag: AlbumBag
  create: (input: CreateAlbumInput) => AlbumMutationResult
  addItem: (input: AddAlbumItemInput) => AlbumItemMutationResult
  getAlbum: (albumId: string) => AlbumRecord | null
  getItem: (albumId: string, mediaId: string) => AlbumItemRecord | null
  listForOwner: (ownerType: AlbumOwnerType, ownerId: string) => AlbumRecord[]
  listItems: (albumId: string) => AlbumItemRecord[]
  canView: (albumId: string, ctx: CanViewAlbumContext) => boolean
} {
  const bag: AlbumBag = {
    albums: new Map(),
    items: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const resolveMedia =
    opts?.resolveMedia ??
    ((mediaId: string) => ({
      mediaId: mediaId.trim(),
      mimeType: 'image/jpeg',
    }))

  return {
    bag,
    create: (input) =>
      applyCreateAlbum(bag, input, { now: now(), newId, resolveMedia }),
    addItem: (input) =>
      applyAddAlbumItem(bag, input, { now: now(), newId, resolveMedia }),
    getAlbum: (albumId) => bag.albums.get(albumId.trim()) ?? null,
    getItem: (albumId, mediaId) =>
      bag.items.get(itemKey(albumId.trim(), mediaId.trim())) ?? null,
    listForOwner: (ownerType, ownerId) =>
      selectAlbumsForOwner([...bag.albums.values()], ownerType, ownerId),
    listItems: (albumId) => selectAlbumItems([...bag.items.values()], albumId),
    canView: (albumId, ctx) => {
      const album = bag.albums.get(albumId.trim())
      if (!album) return false
      return canViewAlbum(album, ctx)
    },
  }
}
