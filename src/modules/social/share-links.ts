/**
 * product:social share + link posts (slice 18).
 *
 * Link: URL + optional preview snapshot. Private / internal addresses refused.
 * Share: points at sharedPostId with an optional comment. Challenge posts cannot
 * be shared. Create calls canInteract with the target author. At read time the
 * card keeps the sharer’s comment and omits the target when canViewPost denies.
 */

import { isChallengeShareForbidden } from './challenge'
import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import {
  canViewPost,
  emptyPollCheckinFields,
  isPostAudience,
  type CanViewPostContext,
  type PostAudience,
  type PostRecord,
} from './posts'

export type LinkPreviewSnapshot = {
  title?: string | null
  description?: string | null
  imageUrl?: string | null
}

export type ShareLinkRefuseReason =
  | 'invalid'
  | 'invalid_audience'
  | 'group_required'
  | 'private_address'
  | 'not_found'
  | 'share_forbidden'
  | 'cannot_view'
  | 'cannot_interact'
  | 'blocked'
  | 'banned'
  | 'disabled_kind'

export type ShareLinkMutationResult =
  | { ok: true; post: PostRecord }
  | { ok: false; reason: ShareLinkRefuseReason }

export type CreateLinkPostInput = {
  authorUserId: string
  url: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  actorBannedAt?: Date | null
  /** Injected preview (store fetch). Unit tests pass a stub. */
  preview?: LinkPreviewSnapshot | null
}

export type CreateSharePostInput = {
  authorUserId: string
  sharedPostId: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  actorBannedAt?: Date | null
  /** Facts for canInteract(author, target.authorUserId). */
  interact: CanInteractContext
  /**
   * Result of canViewPost(target) for the sharer.
   * Callers run canViewPost (or canViewerSeePost) and pass the boolean.
   */
  canViewTarget: boolean
}

export type ShareCard = {
  share: PostRecord
  /** Null when the viewer may not see the target (or it is missing). */
  target: PostRecord | null
  targetOmitted: boolean
}

function parseIPv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const nums: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    nums.push(n)
  }
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!]
}

function isPrivateIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

function expandIPv6(host: string): number[] | null {
  const raw = host.toLowerCase()
  if (!raw.includes(':')) return null
  const [head, tail] = raw.split('::')
  const headParts = head ? head.split(':').filter(Boolean) : []
  const tailParts = tail !== undefined ? (tail ? tail.split(':').filter(Boolean) : []) : []
  if (tail === undefined) {
    if (headParts.length !== 8) return null
  } else if (headParts.length + tailParts.length > 8) {
    return null
  }
  const missing =
    tail === undefined ? 0 : 8 - headParts.length - tailParts.length
  const parts = [
    ...headParts,
    ...Array.from({ length: missing }, () => '0'),
    ...tailParts,
  ]
  if (parts.length !== 8) return null
  const out: number[] = []
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null
    out.push(parseInt(part, 16))
  }
  return out
}

function isPrivateIPv6(host: string): boolean {
  const parts = expandIPv6(host)
  if (!parts) {
    // Unparseable with colon → treat as unsafe (refuse).
    return true
  }
  // :: / ::1
  if (parts.every((p) => p === 0)) return true
  if (
    parts[0] === 0 &&
    parts[1] === 0 &&
    parts[2] === 0 &&
    parts[3] === 0 &&
    parts[4] === 0 &&
    parts[5] === 0 &&
    parts[6] === 0 &&
    parts[7] === 1
  ) {
    return true
  }
  // fc00::/7 unique local, fe80::/10 link-local
  const first = parts[0]!
  if ((first & 0xfe00) === 0xfc00) return true
  if ((first & 0xffc0) === 0xfe80) return true
  // IPv4-mapped ::ffff:x.x.x.x
  if (
    parts[0] === 0 &&
    parts[1] === 0 &&
    parts[2] === 0 &&
    parts[3] === 0 &&
    parts[4] === 0 &&
    parts[5] === 0xffff
  ) {
    const hi = parts[6]!
    const lo = parts[7]!
    return isPrivateIPv4([
      (hi >> 8) & 0xff,
      hi & 0xff,
      (lo >> 8) & 0xff,
      lo & 0xff,
    ])
  }
  return false
}

/**
 * True when the hostname is loopback, link-local, unique-local, or RFC1918 /
 * CGNAT, or a reserved local name (.local / .internal / localhost).
 */
export function isPrivateOrInternalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  const ipv4 = parseIPv4(host)
  if (ipv4) return isPrivateIPv4(ipv4)
  if (host.includes(':')) return isPrivateIPv6(host)
  return false
}

/**
 * Accept only http(s) public URLs. Private / internal addresses → private_address.
 */
export function classifyLinkUrl(
  raw: string,
):
  | { ok: true; url: string }
  | { ok: false; reason: 'invalid' | 'private_address' } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'invalid' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const protocol = parsed.protocol.toLowerCase()
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { ok: false, reason: 'invalid' }
  }
  if (isPrivateOrInternalHostname(parsed.hostname)) {
    return { ok: false, reason: 'private_address' }
  }
  return { ok: true, url: parsed.toString() }
}

function resolveAudience(
  raw: PostAudience | string | undefined,
  groupId: string | null,
):
  | { ok: true; audience: PostAudience; groupId: string | null }
  | { ok: false; reason: ShareLinkRefuseReason } {
  const audience =
    typeof raw === 'string' && raw.trim() === ''
      ? 'friends'
      : typeof raw === 'string'
        ? raw.trim()
        : (raw ?? 'friends')
  if (!isPostAudience(audience)) return { ok: false, reason: 'invalid_audience' }
  if (audience === 'group' && !groupId) {
    return { ok: false, reason: 'group_required' }
  }
  return {
    ok: true,
    audience,
    groupId: audience === 'group' ? groupId : null,
  }
}

/** Create a kind=link post. Named failure: private_address. Pack off → disabled_kind. */
export function decideCreateLinkPost(
  input: CreateLinkPostInput,
  opts?: {
    now?: Date
    newId?: () => string
    kindEnabled?: boolean
    holdForStaffReview?: boolean
  },
): ShareLinkMutationResult {
  const authorUserId = input.authorUserId.trim()
  if (!authorUserId) return { ok: false, reason: 'invalid' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (opts?.kindEnabled === false) return { ok: false, reason: 'disabled_kind' }

  const classified = classifyLinkUrl(input.url)
  if (!classified.ok) return { ok: false, reason: classified.reason }

  const groupId = input.groupId?.trim() || null
  const pageId = input.pageId?.trim() || null
  const audienceDecision = resolveAudience(input.audience, groupId)
  if (!audienceDecision.ok) return audienceDecision

  const preview = input.preview ?? null
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    ok: true,
    post: {
      id: newId(),
      authorUserId,
      body: (input.body ?? '').trim(),
      kind: 'link',
      audience: audienceDecision.audience,
      groupId: audienceDecision.groupId,
      pageId,
      staffHidden: Boolean(opts?.holdForStaffReview),
      isAnnouncement: false,
      editedAt: null,
      extensions: input.extensions ?? {},
      media: [],
      sharedPostId: null,
      linkUrl: classified.url,
      linkTitle: preview?.title?.trim() || null,
      linkDescription: preview?.description?.trim() || null,
      linkImageUrl: preview?.imageUrl?.trim() || null,
      ...emptyPollCheckinFields(),
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Create a kind=share post pointing at sharedPostId.
 * Challenge → share_forbidden. canInteract false → cannot_interact / blocked.
 * Sharer must canViewPost the target.
 */
export function decideCreateSharePost(
  target: PostRecord | null,
  input: CreateSharePostInput,
  opts?: {
    now?: Date
    newId?: () => string
    kindEnabled?: boolean
    holdForStaffReview?: boolean
  },
): ShareLinkMutationResult {
  const authorUserId = input.authorUserId.trim()
  const sharedPostId = input.sharedPostId.trim()
  if (!authorUserId || !sharedPostId) return { ok: false, reason: 'invalid' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (opts?.kindEnabled === false) return { ok: false, reason: 'disabled_kind' }
  if (!target || target.id.trim() !== sharedPostId) {
    return { ok: false, reason: 'not_found' }
  }
  if (isChallengeShareForbidden(target.kind)) {
    return { ok: false, reason: 'share_forbidden' }
  }
  if (!input.canViewTarget) {
    return { ok: false, reason: 'cannot_view' }
  }
  if (!canInteract(authorUserId, target.authorUserId, input.interact)) {
    return {
      ok: false,
      reason: input.interact.isBlocked ? 'blocked' : 'cannot_interact',
    }
  }

  const groupId = input.groupId?.trim() || null
  const pageId = input.pageId?.trim() || null
  const audienceDecision = resolveAudience(input.audience, groupId)
  if (!audienceDecision.ok) return audienceDecision

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    ok: true,
    post: {
      id: newId(),
      authorUserId,
      body: (input.body ?? '').trim(),
      kind: 'share',
      audience: audienceDecision.audience,
      groupId: audienceDecision.groupId,
      pageId,
      staffHidden: Boolean(opts?.holdForStaffReview),
      isAnnouncement: false,
      editedAt: null,
      extensions: input.extensions ?? {},
      media: [],
      sharedPostId: target.id,
      linkUrl: null,
      linkTitle: null,
      linkDescription: null,
      linkImageUrl: null,
      ...emptyPollCheckinFields(),
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Read-time share card. When canViewPost denies the target (or it is missing),
 * keep the sharer’s comment and omit the target body.
 */
export function resolveShareCard(
  share: PostRecord,
  target: PostRecord | null,
  viewCtx: CanViewPostContext,
): ShareCard {
  if (
    !target ||
    share.kind !== 'share' ||
    share.sharedPostId !== target.id ||
    !canViewPost(target, viewCtx)
  ) {
    return { share, target: null, targetOmitted: true }
  }
  return { share, target, targetOmitted: false }
}

export type ShareLinkBag = {
  posts: Map<string, PostRecord>
}

export function applyCreateLinkPost(
  bag: ShareLinkBag,
  input: CreateLinkPostInput,
  opts?: { now?: Date; newId?: () => string },
): ShareLinkMutationResult {
  const decision = decideCreateLinkPost(input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

export function applyCreateSharePost(
  bag: ShareLinkBag,
  input: CreateSharePostInput,
  opts?: { now?: Date; newId?: () => string },
): ShareLinkMutationResult {
  const target = bag.posts.get(input.sharedPostId.trim()) ?? null
  const decision = decideCreateSharePost(target, input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

/** In-memory share / link posts for unit tests. */
export function createShareLinkMemory(opts?: {
  now?: () => Date
  newId?: () => string
  seed?: PostRecord[]
}): {
  bag: ShareLinkBag
  seed: (post: PostRecord) => void
  createLink: (input: CreateLinkPostInput) => ShareLinkMutationResult
  createShare: (input: CreateSharePostInput) => ShareLinkMutationResult
  get: (postId: string) => PostRecord | null
  resolveShare: (
    shareId: string,
    viewCtx: CanViewPostContext,
  ) => ShareCard | null
} {
  const bag: ShareLinkBag = { posts: new Map() }
  for (const post of opts?.seed ?? []) {
    bag.posts.set(post.id, post)
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    seed: (post) => {
      bag.posts.set(post.id, post)
    },
    createLink: (input) =>
      applyCreateLinkPost(bag, input, { now: now(), newId }),
    createShare: (input) =>
      applyCreateSharePost(bag, input, { now: now(), newId }),
    get: (postId) => bag.posts.get(postId.trim()) ?? null,
    resolveShare: (shareId, viewCtx) => {
      const share = bag.posts.get(shareId.trim()) ?? null
      if (!share || share.kind !== 'share') return null
      const target = share.sharedPostId
        ? bag.posts.get(share.sharedPostId) ?? null
        : null
      return resolveShareCard(share, target, viewCtx)
    },
  }
}
