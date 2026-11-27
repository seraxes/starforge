/**
 * product:social posts — audiences, canViewPost, reserved handles, permalink, media.
 *
 * canViewPost is the only read check for a post. Feeds, permalinks, shares,
 * hashtags, discover, and group walls call it; they do not repeat the rules.
 * Create refuses when the author has a Social bannedAt.
 * DB persistence lives in posts-store.ts.
 */

import { isSocialBanned } from './interact'

export const POST_AUDIENCES = ['only_me', 'group', 'friends', 'public'] as const
export type PostAudience = (typeof POST_AUDIENCES)[number]

export const POST_KINDS = [
  'text',
  'media',
  'activity',
  'challenge',
  'link',
  'share',
  'poll',
  'checkin',
  /** Host surface thread (event / CMS page). Excluded from feeds. */
  'conversation',
] as const
export type PostKind = (typeof POST_KINDS)[number]

/** Single-choice poll option (stored on the post; votes are sf_social_poll_votes). */
export type PollOption = {
  id: string
  label: string
}

export const POST_MEDIA_ROLES = ['attachment', 'challenge_entry'] as const
export type PostMediaRole = (typeof POST_MEDIA_ROLES)[number]

/** Soft cap for image galleries on one post (many images, or one video). */
export const POST_MEDIA_IMAGE_MAX = 10

/** Path words that are never treated as a member handle under /feed. */
export const RESERVED_FEED_HANDLES = [
  'people',
  'groups',
  'pages',
  'stories',
  'following',
  'discover',
  'watch',
  'requests',
  'saved',
  'post',
  'tag',
  'c',
  'g',
  'p',
  'u',
] as const

export type ReservedFeedHandle = (typeof RESERVED_FEED_HANDLES)[number]

export type PostMediaAttachment = {
  mediaId: string
  role: PostMediaRole
  sortOrder: number
  mimeType: string | null
}

export type PostRecord = {
  id: string
  authorUserId: string
  body: string
  kind: PostKind
  audience: PostAudience
  groupId: string | null
  pageId: string | null
  staffHidden: boolean
  /** Hold-for-review queue. Distinct from staffHidden. */
  pendingReview: boolean
  /** Group announcement pin (slice 14). Stays pinned on the wall. */
  isAnnouncement: boolean
  editedAt: Date | null
  extensions: Record<string, unknown>
  /** Ordered media binds (files stay in product:media). */
  media: PostMediaAttachment[]
  /** Share target (kind=share). Plain text id — no FK. */
  sharedPostId: string | null
  /** Link preview (kind=link). Snapshot from server fetch. */
  linkUrl: string | null
  linkTitle: string | null
  linkDescription: string | null
  linkImageUrl: string | null
  /** Poll options (kind=poll). Empty when not a poll. */
  pollOptions: PollOption[]
  /** When set, the poll is closed — options and body cannot be edited. */
  pollClosedAt: Date | null
  /** Check-in place label (kind=checkin). */
  placeLabel: string | null
  /** Optional Maps pin id when the Maps door resolved a pin. */
  mapsPinId: string | null
  placeLat: number | null
  placeLng: number | null
  createdAt: Date
  updatedAt: Date
}

export type PostRefuseReason =
  | 'invalid'
  | 'invalid_audience'
  | 'group_required'
  | 'empty_body'
  | 'unknown_media'
  | 'invalid_media_mix'
  /** New post audience is wider than the file’s current access level. */
  | 'audience_too_wide'
  | 'not_found'
  | 'not_author'
  | 'cannot_manage'
  | 'banned'
  | 'poll_closed'
  /** Pack switch for this composer kind is off (slice 15b). */
  | 'disabled_kind'
  /** Pack blocked-words list matched the body (slice 15c). */
  | 'blocked_word'

/** Access level for a media file on the Social audience ladder. */
export type MediaAccessLevel = {
  audience: PostAudience
  groupId?: string | null
}

export type EditPostInput = {
  actorUserId: string
  postId: string
  body?: string
}

export type SetPostAudienceInput = {
  actorUserId: string
  postId: string
  audience: string
  groupId?: string | null
}

export type DeletePostInput = {
  actorUserId: string
  postId: string
}

export type StaffHidePostInput = {
  actorUserId: string
  postId: string
  staffHidden: boolean
}

export type ReviewPendingPostInput = {
  actorUserId: string
  postId: string
}

export type PostDeleteResult =
  | { ok: true; postId: string }
  | { ok: false; reason: PostRefuseReason }

/** True when the composer body has no visible text (whitespace / empty HTML). */
export function isEmptyPostBody(body: string | null | undefined): boolean {
  const raw = (body ?? '').trim()
  if (!raw) return true
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return !text
}

export type PostMutationResult =
  | { ok: true; post: PostRecord }
  | { ok: false; reason: PostRefuseReason }

export type CreatePostInput = {
  authorUserId: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  /** Media library ids to attach (role attachment). */
  mediaIds?: string[]
}

/**
 * Facts canViewPost needs from friendships, groups, pages, and account state.
 * Callers resolve those owners; this function does not query them.
 */
export type CanViewPostContext = {
  viewerUserId: string | null
  areFriends: boolean
  /**
   * True when either person has blocked the other.
   * Callers resolve from the pair query (`blockedBy` / `blockedByOther`).
   */
  isBlocked: boolean
  authorHidden: boolean
  isGroupMember: boolean
  isPageLiker: boolean
  isPageAdmin: boolean
  /**
   * Staff grant (`viewerMayModerateSocialContent` / admin.social edit):
   * see staff-hidden posts, and private-read only_me / friends / group.
   */
  canManagePosts: boolean
  /**
   * When false, guests (no viewer) cannot read audience=public posts.
   * Omit / true keeps the historical open-public behaviour.
   */
  guestCanReadPublic?: boolean
  /**
   * Host conversation posts (`kind=conversation`): true when the owning pack
   * says the viewer may see that event / page. Staff private-read uses
   * `canManagePosts` instead. Omit / false denies non-staff.
   */
  hostCanView?: boolean
}

export type PermalinkResult =
  | { ok: true; post: PostRecord }
  | { ok: false; reason: 'not_found' }

export type MediaResolveResult = {
  mediaId: string
  mimeType: string | null
}

export type MediaKindClass = 'image' | 'video' | 'other'

export function isPostAudience(value: string): value is PostAudience {
  return (POST_AUDIENCES as readonly string[]).includes(value)
}

export function isPostKind(value: string): value is PostKind {
  return (POST_KINDS as readonly string[]).includes(value)
}

/** Empty share / link columns for text, media, activity, challenge rows. */
export function emptyShareLinkFields(): Pick<
  PostRecord,
  'sharedPostId' | 'linkUrl' | 'linkTitle' | 'linkDescription' | 'linkImageUrl'
> {
  return {
    sharedPostId: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
  }
}

/** Empty poll / check-in columns for non-poll / non-checkin rows. */
export function emptyPollCheckinFields(): Pick<
  PostRecord,
  'pollOptions' | 'pollClosedAt' | 'placeLabel' | 'mapsPinId' | 'placeLat' | 'placeLng'
> {
  return {
    pollOptions: [],
    pollClosedAt: null,
    placeLabel: null,
    mapsPinId: null,
    placeLat: null,
    placeLng: null,
  }
}

/**
 * Map a posts table row (or equivalent) into PostRecord.
 * Unknown audience / kind → null (callers treat as missing).
 */
export function toPostRecord(
  row: {
    id: string
    authorUserId: string
    body: string
    kind: string
    audience: string
    groupId: string | null
    pageId: string | null
    staffHidden: boolean
    pendingReview?: boolean | null
    isAnnouncement?: boolean | null
    editedAt: Date | null
    extensions?: Record<string, unknown> | null
    sharedPostId?: string | null
    linkUrl?: string | null
    linkTitle?: string | null
    linkDescription?: string | null
    linkImageUrl?: string | null
    pollOptions?: PollOption[] | null
    pollClosedAt?: Date | null
    placeLabel?: string | null
    mapsPinId?: string | null
    placeLat?: number | null
    placeLng?: number | null
    createdAt: Date
    updatedAt: Date
  },
  media: PostMediaAttachment[] = [],
): PostRecord | null {
  if (!isPostAudience(row.audience) || !isPostKind(row.kind)) return null
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    body: row.body,
    kind: row.kind,
    audience: row.audience,
    groupId: row.groupId,
    pageId: row.pageId,
    staffHidden: row.staffHidden,
    pendingReview: Boolean(row.pendingReview),
    isAnnouncement: Boolean(row.isAnnouncement),
    editedAt: row.editedAt,
    extensions:
      row.extensions && typeof row.extensions === 'object' && !Array.isArray(row.extensions)
        ? (row.extensions as Record<string, unknown>)
        : {},
    media,
    sharedPostId: row.sharedPostId?.trim() || null,
    linkUrl: row.linkUrl?.trim() || null,
    linkTitle: row.linkTitle?.trim() || null,
    linkDescription: row.linkDescription?.trim() || null,
    linkImageUrl: row.linkImageUrl?.trim() || null,
    pollOptions: normalizePollOptions(row.pollOptions),
    pollClosedAt: row.pollClosedAt ?? null,
    placeLabel: row.placeLabel?.trim() || null,
    mapsPinId: row.mapsPinId?.trim() || null,
    placeLat: typeof row.placeLat === 'number' && Number.isFinite(row.placeLat) ? row.placeLat : null,
    placeLng: typeof row.placeLng === 'number' && Number.isFinite(row.placeLng) ? row.placeLng : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Coerce jsonb poll options into a clean list (drop blanks / non-objects). */
export function normalizePollOptions(raw: unknown): PollOption[] {
  if (!Array.isArray(raw)) return []
  const out: PollOption[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const id = typeof (item as { id?: unknown }).id === 'string'
      ? (item as { id: string }).id.trim()
      : ''
    const label = typeof (item as { label?: unknown }).label === 'string'
      ? (item as { label: string }).label.trim()
      : ''
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    out.push({ id, label })
  }
  return out
}

export function isPostMediaRole(value: string): value is PostMediaRole {
  return (POST_MEDIA_ROLES as readonly string[]).includes(value)
}

export function isReservedFeedHandle(handle: string): boolean {
  const key = handle.trim().toLowerCase()
  return (RESERVED_FEED_HANDLES as readonly string[]).includes(key)
}

/** Member profile under /feed — reserved words use the /u/ prefix. */
export function memberFeedHref(handle: string): string {
  const trimmed = handle.trim()
  if (!trimmed) return '/feed'
  return isReservedFeedHandle(trimmed)
    ? `/feed/u/${encodeURIComponent(trimmed)}`
    : `/feed/${encodeURIComponent(trimmed)}`
}

export function permalinkHref(postId: string): string {
  return `/feed/post/${encodeURIComponent(postId.trim())}`
}

export function classifyMediaMime(mimeType: string | null | undefined): MediaKindClass {
  const mime = (mimeType ?? '').trim().toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'other'
}

/** Dedupe media ids while keeping first-seen order. */
export function normalizeMediaIds(mediaIds: string[] | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of mediaIds ?? []) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Media door for attach: asset must resolve and this member may use it.
 * Unreadable / not-owned → null (callers map that to unknown_media).
 */
export function resolveMediaForMember(
  mediaId: string,
  opts: {
    resolveMedia: (mediaId: string) => MediaResolveResult | null
    memberCanRead: (mediaId: string) => boolean
  },
): MediaResolveResult | null {
  const id = mediaId.trim()
  if (!id) return null
  if (!opts.memberCanRead(id)) return null
  return opts.resolveMedia(id)
}

/**
 * True when a share at `next` would show the original to people it does not
 * already allow. Public can be shared anywhere. Friends cannot become public
 * or a group. Only-me stays only-me. A group post stays in that same group,
 * or only-me.
 */
export function shareAudienceIsWider(
  original: PostAudience,
  next: PostAudience,
  opts?: { originalGroupId?: string | null; nextGroupId?: string | null },
): boolean {
  if (original === 'public') return false
  if (original === 'friends') return next === 'public' || next === 'group'
  if (original === 'only_me') return next !== 'only_me'
  if (next === 'only_me') return false
  if (next !== 'group') return true
  const originalGroupId = opts?.originalGroupId?.trim() || ''
  const nextGroupId = opts?.nextGroupId?.trim() || ''
  return !originalGroupId || !nextGroupId || originalGroupId !== nextGroupId
}

/**
 * Narrower of two media access levels on the Social audience ladder.
 * Incompatible group binds collapse to only_me.
 */
export function narrowerMediaAccessLevel(
  a: MediaAccessLevel,
  b: MediaAccessLevel,
): MediaAccessLevel {
  const aAudience = a.audience
  const bAudience = b.audience
  const aGroupId = a.groupId?.trim() || null
  const bGroupId = b.groupId?.trim() || null
  const bIsWider = shareAudienceIsWider(aAudience, bAudience, {
    originalGroupId: aGroupId,
    nextGroupId: bGroupId,
  })
  const aIsWider = shareAudienceIsWider(bAudience, aAudience, {
    originalGroupId: bGroupId,
    nextGroupId: aGroupId,
  })
  if (aIsWider && bIsWider) return { audience: 'only_me', groupId: null }
  if (bIsWider) {
    return { audience: aAudience, groupId: aAudience === 'group' ? aGroupId : null }
  }
  if (aIsWider) {
    return { audience: bAudience, groupId: bAudience === 'group' ? bGroupId : null }
  }
  if (aAudience === 'group') {
    return { audience: 'group', groupId: aGroupId }
  }
  return { audience: aAudience, groupId: null }
}

/**
 * File access level from form privacy + existing Social binds (passed in).
 * Private form media is only_me. No binds and not private → public.
 * Does not query the database.
 */
export function mediaAccessLevelFromFacts(opts: {
  isPrivateForm?: boolean
  binds?: readonly MediaAccessLevel[]
}): MediaAccessLevel {
  let level: MediaAccessLevel = { audience: 'public', groupId: null }
  if (opts.isPrivateForm) {
    level = narrowerMediaAccessLevel(level, { audience: 'only_me', groupId: null })
  }
  for (const bind of opts.binds ?? []) {
    level = narrowerMediaAccessLevel(level, bind)
  }
  return level
}

/**
 * Album owner → audience ladder. User/page albums use friends (canInteract /
 * likers). Group albums use that group.
 */
export function albumOwnerMediaAccess(
  ownerType: 'user' | 'group' | 'page',
  ownerId: string,
): MediaAccessLevel {
  if (ownerType === 'group') {
    return { audience: 'group', groupId: ownerId.trim() || null }
  }
  return { audience: 'friends', groupId: null }
}

/** Stories are visible via canInteract — friends on the post ladder. */
export function storyMediaAccess(): MediaAccessLevel {
  return { audience: 'friends', groupId: null }
}

/** Group document bind — group audience for that group. */
export function groupDocumentMediaAccess(groupId: string): MediaAccessLevel {
  return { audience: 'group', groupId: groupId.trim() || null }
}

/**
 * Resolve and validate post attachments.
 * Many images (up to maxImages, default POST_MEDIA_IMAGE_MAX) or exactly one
 * video — not both. Pack may turn video off (`allowVideo: false`).
 * Unknown mediaId, or an id the Media door will not read for this member →
 * unknown_media (named failure paths for slice 5).
 * When `audience` is set, refuse attach if the post audience is wider than the
 * file’s current level (`audience_too_wide`). Pass levels in — no DB here.
 */
export function decidePostAttachments(
  mediaIds: string[] | null | undefined,
  resolveMedia: (mediaId: string) => MediaResolveResult | null,
  opts?: {
    maxImages?: number
    allowVideo?: boolean
    /** Target post audience for the attach-time access check. */
    audience?: PostAudience
    groupId?: string | null
    /**
     * Current access level per mediaId (form privacy + existing binds).
     * Omit / missing id → public (no narrower bind).
     */
    mediaAccessLevel?: (mediaId: string) => MediaAccessLevel | null | undefined
  },
):
  | { ok: true; attachments: PostMediaAttachment[] }
  | { ok: false; reason: 'unknown_media' | 'invalid_media_mix' | 'audience_too_wide' } {
  const ids = normalizeMediaIds(mediaIds)
  if (ids.length === 0) return { ok: true, attachments: [] }

  const maxImages =
    typeof opts?.maxImages === 'number' &&
    Number.isInteger(opts.maxImages) &&
    opts.maxImages > 0
      ? Math.min(POST_MEDIA_IMAGE_MAX, opts.maxImages)
      : POST_MEDIA_IMAGE_MAX
  const allowVideo = opts?.allowVideo !== false
  const targetAudience = opts?.audience
  const targetGroupId = opts?.groupId?.trim() || null

  const resolved: MediaResolveResult[] = []
  for (const mediaId of ids) {
    const doc = resolveMedia(mediaId)
    if (!doc) return { ok: false, reason: 'unknown_media' }
    if (targetAudience) {
      const level = opts?.mediaAccessLevel?.(doc.mediaId) ?? {
        audience: 'public' as const,
        groupId: null,
      }
      if (
        shareAudienceIsWider(level.audience, targetAudience, {
          originalGroupId: level.groupId,
          nextGroupId: targetGroupId,
        })
      ) {
        return { ok: false, reason: 'audience_too_wide' }
      }
    }
    resolved.push({ mediaId: doc.mediaId, mimeType: doc.mimeType })
  }

  const classes = resolved.map((row) => classifyMediaMime(row.mimeType))
  if (classes.some((c) => c === 'other')) {
    return { ok: false, reason: 'invalid_media_mix' }
  }

  const imageCount = classes.filter((c) => c === 'image').length
  const videoCount = classes.filter((c) => c === 'video').length

  if (videoCount > 0 && !allowVideo) {
    return { ok: false, reason: 'invalid_media_mix' }
  }
  if (videoCount > 0 && imageCount > 0) {
    return { ok: false, reason: 'invalid_media_mix' }
  }
  if (videoCount > 1) {
    return { ok: false, reason: 'invalid_media_mix' }
  }
  if (videoCount === 1 && resolved.length !== 1) {
    return { ok: false, reason: 'invalid_media_mix' }
  }
  if (imageCount > maxImages) {
    return { ok: false, reason: 'invalid_media_mix' }
  }

  return {
    ok: true,
    attachments: resolved.map((row, index) => ({
      mediaId: row.mediaId,
      role: 'attachment' as const,
      sortOrder: index,
      mimeType: row.mimeType,
    })),
  }
}

/**
 * Decide whether a viewer may read a post.
 * Author always sees their own row. Block (either blocker column) and hidden
 * author deny everyone else. Pending review and staff hide deny without the
 * staff grant. Staff grant (`canManagePosts`) also private-reads only_me /
 * friends / group (and pending-held posts).
 */
export function canViewPost(post: PostRecord, ctx: CanViewPostContext): boolean {
  const viewer = ctx.viewerUserId?.trim() || null
  if (viewer && viewer === post.authorUserId) return true

  if (ctx.isBlocked) return false
  if (ctx.authorHidden) return false
  if (post.pendingReview && !ctx.canManagePosts) return false
  if (post.staffHidden && !ctx.canManagePosts) return false

  // Host event / CMS page threads — visibility follows the owner pack, not the
  // audience ladder. Social staff private-read uses canManagePosts.
  if (post.kind === 'conversation') {
    if (ctx.canManagePosts) return true
    return ctx.hostCanView === true
  }

  // Page posts: likers and page admins only (not the audience picker).
  if (post.pageId) {
    return ctx.isPageLiker || ctx.isPageAdmin
  }

  switch (post.audience) {
    case 'only_me':
      return Boolean(viewer) && ctx.canManagePosts
    case 'friends':
      return Boolean(viewer) && (ctx.areFriends || ctx.canManagePosts)
    case 'public':
      if (!viewer) return ctx.guestCanReadPublic !== false
      return true
    case 'group':
      return Boolean(viewer) && (ctx.isGroupMember || ctx.canManagePosts)
    default:
      return false
  }
}

/**
 * Owning Social object for a media bind (post / album / story / group document).
 * Serve-time check builds a synthetic post and calls canViewPost — same ladder.
 */
export type BoundMediaOwner = {
  authorUserId: string
  audience: PostAudience
  groupId?: string | null
  pageId?: string | null
  staffHidden?: boolean
  pendingReview?: boolean
}

/** True when the file’s narrowest Social bind is not public on the share ladder. */
export function mediaBindIsRestricted(level: MediaAccessLevel): boolean {
  return shareAudienceIsWider(level.audience, 'public', {
    originalGroupId: level.groupId,
  })
}

/**
 * Allow or deny a viewer for a Social-bound file.
 * Reuses canViewPost with a synthetic owning post. No database.
 */
export function canViewBoundMedia(
  owning: BoundMediaOwner,
  ctx: CanViewPostContext,
): boolean {
  const authorUserId = owning.authorUserId.trim()
  if (!authorUserId) return false
  const post: PostRecord = {
    id: '',
    authorUserId,
    body: '',
    kind: 'media',
    audience: owning.audience,
    groupId: owning.groupId?.trim() || null,
    pageId: owning.pageId?.trim() || null,
    staffHidden: owning.staffHidden === true,
    pendingReview: owning.pendingReview === true,
    isAnnouncement: false,
    editedAt: null,
    extensions: {},
    media: [],
    ...emptyShareLinkFields(),
    ...emptyPollCheckinFields(),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
  return canViewPost(post, ctx)
}

/**
 * Keep the owner facts that produce the narrower MediaAccessLevel.
 * Incompatible group binds collapse to only_me (author from `a`).
 */
export function narrowerBoundMediaOwner(
  a: BoundMediaOwner,
  b: BoundMediaOwner,
): BoundMediaOwner {
  const aLevel: MediaAccessLevel = {
    audience: a.audience,
    groupId: a.groupId,
  }
  const bLevel: MediaAccessLevel = {
    audience: b.audience,
    groupId: b.groupId,
  }
  const narrow = narrowerMediaAccessLevel(aLevel, bLevel)
  const aGroup = a.groupId?.trim() || null
  const bGroup = b.groupId?.trim() || null
  const narrowGroup = narrow.groupId?.trim() || null
  const aMatches =
    narrow.audience === a.audience &&
    (narrow.audience !== 'group' || narrowGroup === aGroup)
  const bMatches =
    narrow.audience === b.audience &&
    (narrow.audience !== 'group' || narrowGroup === bGroup)
  if (aMatches && !bMatches) {
    return {
      ...a,
      audience: narrow.audience,
      groupId: narrow.audience === 'group' ? narrowGroup : null,
    }
  }
  if (bMatches && !aMatches) {
    return {
      ...b,
      audience: narrow.audience,
      groupId: narrow.audience === 'group' ? narrowGroup : null,
    }
  }
  if (!aMatches && !bMatches) {
    return {
      authorUserId: a.authorUserId,
      audience: 'only_me',
      groupId: null,
      pageId: null,
      staffHidden: a.staffHidden === true || b.staffHidden === true,
      pendingReview: a.pendingReview === true || b.pendingReview === true,
    }
  }
  return {
    ...a,
    audience: narrow.audience,
    groupId: narrow.audience === 'group' ? narrowGroup : null,
    pageId: a.pageId ?? b.pageId ?? null,
    staffHidden: a.staffHidden === true || b.staffHidden === true,
    pendingReview: a.pendingReview === true || b.pendingReview === true,
  }
}

/**
 * Permalink read: missing or denied → not_found (do not leak existence).
 */
export function resolvePostPermalink(
  post: PostRecord | null,
  ctx: CanViewPostContext,
): PermalinkResult {
  if (!post) return { ok: false, reason: 'not_found' }
  if (!canViewPost(post, ctx)) return { ok: false, reason: 'not_found' }
  return { ok: true, post }
}

/**
 * Build a text or media post row. Default audience is friends.
 * Group audience requires groupId. Empty body is refused unless media is attached.
 * Unknown mediaId is refused (resolveMedia must return the asset).
 * Named failure (slice 9b): author Social bannedAt → banned.
 * Named failure (slice 15b): pack switch off for the resolved kind → disabled_kind.
 */
export function createPostRecord(
  input: CreatePostInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
    /**
     * Current access level per mediaId (form privacy + existing binds).
     * Passed into decidePostAttachments — no DB inside that helper.
     */
    mediaAccessLevel?: (mediaId: string) => MediaAccessLevel | null | undefined
    /** Author’s Social member bannedAt — refused when set. */
    authorBannedAt?: Date | null
    /** Pack composer switch. Omit → allow (unit tests / callers without pack). */
    isKindEnabled?: (kind: PostKind) => boolean
    /** Pack hold-for-review. New posts start staff-hidden when true. */
    holdForStaffReview?: boolean
    /** Pack blockedWords. Matching body → blocked_word. */
    blockedWords?: readonly string[]
    /** Pack maxImagesPerPost. Omitted → POST_MEDIA_IMAGE_MAX. */
    maxImagesPerPost?: number
    /** Pack allowPostVideo. false → video attachments refused. */
    allowPostVideo?: boolean
  },
): PostMutationResult {
  const authorUserId = input.authorUserId.trim()
  if (!authorUserId) return { ok: false, reason: 'invalid' }
  if (isSocialBanned(opts?.authorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }

  const body = (input.body ?? '').trim()
  if (opts?.blockedWords?.length) {
    const hay = body.toLowerCase()
    for (const word of opts.blockedWords) {
      const needle = word.trim().toLowerCase()
      if (needle && hay.includes(needle)) return { ok: false, reason: 'blocked_word' }
    }
  }

  const rawAudience = input.audience ?? 'friends'
  const audience =
    typeof rawAudience === 'string' && rawAudience.trim() === ''
      ? 'friends'
      : typeof rawAudience === 'string'
        ? rawAudience.trim()
        : rawAudience
  if (!isPostAudience(audience)) return { ok: false, reason: 'invalid_audience' }

  const groupId = input.groupId?.trim() || null
  const pageId = input.pageId?.trim() || null

  if (audience === 'group' && !groupId) {
    return { ok: false, reason: 'group_required' }
  }

  const mediaIds = normalizeMediaIds(input.mediaIds)

  if (mediaIds.length > 0 && !opts?.resolveMedia) {
    return { ok: false, reason: 'unknown_media' }
  }

  const mediaDecision =
    mediaIds.length === 0
      ? ({ ok: true as const, attachments: [] as PostMediaAttachment[] })
      : decidePostAttachments(mediaIds, opts!.resolveMedia!, {
          maxImages: opts?.maxImagesPerPost,
          allowVideo: opts?.allowPostVideo,
          audience,
          groupId,
          mediaAccessLevel: opts?.mediaAccessLevel,
        })
  if (!mediaDecision.ok) return mediaDecision

  if (isEmptyPostBody(body) && mediaDecision.attachments.length === 0) {
    return { ok: false, reason: 'empty_body' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const kind: PostKind = mediaDecision.attachments.length > 0 ? 'media' : 'text'
  if (opts?.isKindEnabled && !opts.isKindEnabled(kind)) {
    return { ok: false, reason: 'disabled_kind' }
  }

  return {
    ok: true,
    post: {
      id: newId(),
      authorUserId,
      body,
      kind,
      audience,
      groupId: audience === 'group' ? groupId : null,
      pageId,
      staffHidden: false,
      pendingReview: Boolean(opts?.holdForStaffReview),
      isAnnouncement: false,
      editedAt: null,
      extensions: input.extensions ?? {},
      media: mediaDecision.attachments,
      ...emptyShareLinkFields(),
      ...emptyPollCheckinFields(),
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Change who can see the post. Does not mark the body edited
 * and does not move the post in the feed.
 * Author always may. Social staff with canManagePosts (admin / dev) may change any post.
 */
export function decideSetPostAudience(
  current: PostRecord | null,
  input: SetPostAudienceInput,
  opts?: {
    now?: Date
    canManagePosts?: boolean
    /**
     * Current access level per attached mediaId (form privacy + existing binds,
     * including this post). Passed in — no DB here.
     */
    mediaAccessLevel?: (mediaId: string) => MediaAccessLevel | null | undefined
  },
): PostMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  const postId = input.postId.trim()
  if (!actor || !postId || current.id.trim() !== postId) {
    return { ok: false, reason: 'invalid' }
  }
  const isAuthor = current.authorUserId === actor
  if (!isAuthor && !opts?.canManagePosts) return { ok: false, reason: 'not_author' }
  const audience = input.audience.trim()
  if (!isPostAudience(audience)) return { ok: false, reason: 'invalid_audience' }
  const groupId = input.groupId?.trim() || null
  if (audience === 'group' && !groupId) return { ok: false, reason: 'group_required' }

  if (current.media.length > 0) {
    for (const row of current.media) {
      const fromBinds = opts?.mediaAccessLevel?.(row.mediaId) ?? {
        audience: 'public' as const,
        groupId: null,
      }
      // This post is already a bind — fold it in so widening cannot outrun the file.
      const level = narrowerMediaAccessLevel(fromBinds, {
        audience: current.audience,
        groupId: current.groupId,
      })
      if (
        shareAudienceIsWider(level.audience, audience, {
          originalGroupId: level.groupId,
          nextGroupId: groupId,
        })
      ) {
        return { ok: false, reason: 'audience_too_wide' }
      }
    }
  }

  return {
    ok: true,
    post: {
      ...current,
      audience,
      groupId: audience === 'group' ? groupId : null,
      updatedAt: opts?.now ?? new Date(),
    },
  }
}

/**
 * Body edit. Sets editedAt. Closed polls are refused.
 * Author always may. Social staff with canManagePosts (admin / dev) may edit any post.
 */
export function decideEditPost(
  current: PostRecord | null,
  input: EditPostInput,
  opts?: { now?: Date; canManagePosts?: boolean },
): PostMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  const isAuthor = current.authorUserId === actor
  if (!isAuthor && !opts?.canManagePosts) return { ok: false, reason: 'not_author' }
  if (current.kind === 'poll' && current.pollClosedAt) {
    return { ok: false, reason: 'poll_closed' }
  }

  const body = (input.body ?? '').trim()
  const hasMedia = current.media.length > 0
  const hasPoll = current.kind === 'poll' && current.pollOptions.length > 0
  const hasCheckin = current.kind === 'checkin' && Boolean(current.placeLabel)
  if (isEmptyPostBody(body) && !hasMedia && !hasPoll && !hasCheckin) {
    return { ok: false, reason: 'empty_body' }
  }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      body,
      editedAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Delete gate. Cascade of comments / likes is the caller's job.
 * Author always may. Social staff with canManagePosts (admin / dev) may delete any post.
 */
export function decideDeletePost(
  current: PostRecord | null,
  input: DeletePostInput,
  opts?: { canManagePosts?: boolean },
): PostDeleteResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  const isAuthor = current.authorUserId === actor
  if (!isAuthor && !opts?.canManagePosts) return { ok: false, reason: 'not_author' }
  return { ok: true, postId: current.id }
}

/**
 * Staff hide / restore. Requires social.posts manage (canManagePosts).
 * Author still sees their own row via canViewPost.
 */
export function decideStaffHidePost(
  current: PostRecord | null,
  input: StaffHidePostInput,
  gates: { canManagePosts: boolean },
  opts?: { now?: Date },
): PostMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canManagePosts) return { ok: false, reason: 'cannot_manage' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      staffHidden: Boolean(input.staffHidden),
      updatedAt: now,
    },
  }
}

/**
 * Approve a held post: clear pendingReview so normal audience rules apply.
 * Requires Social moderate grant (canManagePosts).
 */
export function decideApprovePendingPost(
  current: PostRecord | null,
  input: ReviewPendingPostInput,
  gates: { canManagePosts: boolean },
  opts?: { now?: Date },
): PostMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canManagePosts) return { ok: false, reason: 'cannot_manage' }
  if (!current.pendingReview) return { ok: false, reason: 'invalid' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      pendingReview: false,
      updatedAt: now,
    },
  }
}

/**
 * Reject a held post: clear pendingReview and staff-hide (restore list).
 * Requires Social moderate grant (canManagePosts).
 */
export function decideRejectPendingPost(
  current: PostRecord | null,
  input: ReviewPendingPostInput,
  gates: { canManagePosts: boolean },
  opts?: { now?: Date },
): PostMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canManagePosts) return { ok: false, reason: 'cannot_manage' }
  if (!current.pendingReview) return { ok: false, reason: 'invalid' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      pendingReview: false,
      staffHidden: true,
      updatedAt: now,
    },
  }
}

/** In-memory posts for unit tests — same canViewPost / create rules as the DB path. */
export function createPostMemory(opts?: {
  newId?: () => string
  now?: () => Date
  resolveMedia?: (mediaId: string) => MediaResolveResult | null
  holdForStaffReview?: boolean
}): {
  get: (postId: string) => PostRecord | null
  create: (
    input: CreatePostInput,
    gates?: { authorBannedAt?: Date | null; holdForStaffReview?: boolean },
  ) => PostMutationResult
  edit: (
    input: EditPostInput,
    gates?: { canManagePosts?: boolean },
  ) => PostMutationResult
  delete: (
    input: DeletePostInput,
    gates?: { canManagePosts?: boolean },
  ) => PostDeleteResult
  setStaffHidden: (
    input: StaffHidePostInput,
    gates: { canManagePosts: boolean },
  ) => PostMutationResult
  approvePending: (
    input: ReviewPendingPostInput,
    gates: { canManagePosts: boolean },
  ) => PostMutationResult
  rejectPending: (
    input: ReviewPendingPostInput,
    gates: { canManagePosts: boolean },
  ) => PostMutationResult
} {
  const rows = new Map<string, PostRecord>()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())

  return {
    get: (postId) => rows.get(postId.trim()) ?? null,
    create: (input, gates) => {
      const result = createPostRecord(input, {
        now: now(),
        newId,
        resolveMedia: opts?.resolveMedia,
        authorBannedAt: gates?.authorBannedAt ?? null,
        holdForStaffReview:
          gates?.holdForStaffReview ?? opts?.holdForStaffReview ?? false,
      })
      if (result.ok) rows.set(result.post.id, result.post)
      return result
    },
    edit: (input, gates) => {
      const current = rows.get(input.postId.trim()) ?? null
      const result = decideEditPost(current, input, {
        now: now(),
        canManagePosts: gates?.canManagePosts,
      })
      if (!result.ok) return result
      rows.set(result.post.id, result.post)
      return result
    },
    delete: (input, gates) => {
      const current = rows.get(input.postId.trim()) ?? null
      const result = decideDeletePost(current, input, {
        canManagePosts: gates?.canManagePosts,
      })
      if (!result.ok) return result
      rows.delete(result.postId)
      return result
    },
    setStaffHidden: (input, gates) => {
      const current = rows.get(input.postId.trim()) ?? null
      const result = decideStaffHidePost(current, input, gates, { now: now() })
      if (!result.ok) return result
      rows.set(result.post.id, result.post)
      return result
    },
    approvePending: (input, gates) => {
      const current = rows.get(input.postId.trim()) ?? null
      const result = decideApprovePendingPost(current, input, gates, {
        now: now(),
      })
      if (!result.ok) return result
      rows.set(result.post.id, result.post)
      return result
    },
    rejectPending: (input, gates) => {
      const current = rows.get(input.postId.trim()) ?? null
      const result = decideRejectPendingPost(current, input, gates, {
        now: now(),
      })
      if (!result.ok) return result
      rows.set(result.post.id, result.post)
      return result
    },
  }
}
