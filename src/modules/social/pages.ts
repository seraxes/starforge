/**
 * product:social pages — directory, admins, likes, page wall posts.
 *
 * Page posts are visible to likers and page admins (canViewPost). Creating a
 * page seeds the owner as admin. Likes are unique per (userId, pageId); a
 * second like updates that row. Adding an admin calls canInteract (block /
 * hidden / banned) — it does not re-derive the block rule.
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import {
  createPostRecord,
  type CreatePostInput,
  type PostMutationResult,
  type PostRecord,
} from './posts'

export type PageRecord = {
  id: string
  name: string
  slug: string
  description: string
  coverMediaId: string | null
  ownerUserId: string
  sitePageId: string | null
  verifiedAt: Date | null
  extensions: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type PageAdminRecord = {
  id: string
  pageId: string
  userId: string
  addedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export type PageLikeRecord = {
  id: string
  pageId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type PageRefuseReason =
  | 'invalid'
  | 'not_found'
  | 'slug_taken'
  | 'not_admin'
  | 'already_admin'
  | 'already_liked'
  | 'not_liked'
  | 'blocked'
  | 'banned'
  | 'cannot_interact'
  | 'self'
  | 'not_owner'
  | 'not_allowed'
  /** Pack allowPages / allowPageLikes is off, or creator role refuses. */
  | 'disabled'

export type PageMutationResult =
  | { ok: true; page: PageRecord }
  | { ok: false; reason: PageRefuseReason }

export type PageAdminMutationResult =
  | { ok: true; admin: PageAdminRecord }
  | { ok: false; reason: PageRefuseReason }

export type PageLikeMutationResult =
  | { ok: true; like: PageLikeRecord }
  | { ok: false; reason: PageRefuseReason }

export type CreatePageInput = {
  name: string
  slug?: string
  description?: string
  coverMediaId?: string | null
  ownerUserId: string
  sitePageId?: string | null
  extensions?: Record<string, unknown>
}

export type AddPageAdminInput = {
  pageId: string
  actorUserId: string
  targetUserId: string
  interact: CanInteractContext
}

export type LikePageInput = {
  pageId: string
  userId: string
  /** Optional — when liking is gated against the page owner. */
  interact?: CanInteractContext
  ownerUserId?: string
}

export type CreatePageWallPostInput = CreatePostInput & {
  pageId: string
}

/** Permalink / directory path for a page. */
export function pageHref(slug: string): string {
  return `/feed/p/${encodeURIComponent(slug.trim())}`
}

/** Normalize a display name into a URL slug. */
export function slugifyPageLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function isPageAdminRow(
  row: PageAdminRecord | null | undefined,
): boolean {
  return Boolean(row?.pageId && row?.userId)
}

export function decideCreatePage(
  input: CreatePageInput,
  opts?: {
    now?: Date
    newId?: () => string
    slugTaken?: boolean
    ownerBannedAt?: Date | null
    /** Pack allowPages. Default true. */
    allowPages?: boolean
    /** Creator role gate. Default true. */
    canCreate?: boolean
    /**
     * When true, new pages stay unverified until staff sets verifiedAt.
     * When false, create stamps verifiedAt.
     */
    pagesNeedApproval?: boolean
  },
):
  | { ok: true; page: PageRecord; ownerAdmin: PageAdminRecord }
  | { ok: false; reason: PageRefuseReason } {
  const ownerUserId = input.ownerUserId.trim()
  const name = input.name.trim()
  if (!ownerUserId || !name) return { ok: false, reason: 'invalid' }
  if (opts?.allowPages === false) return { ok: false, reason: 'disabled' }
  if (opts?.canCreate === false) return { ok: false, reason: 'not_allowed' }
  if (isSocialBanned(opts?.ownerBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }

  const slug = (input.slug?.trim() || slugifyPageLabel(name)).trim()
  if (!slug) return { ok: false, reason: 'invalid' }
  if (opts?.slugTaken) return { ok: false, reason: 'slug_taken' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const pageId = newId()
  const page: PageRecord = {
    id: pageId,
    name,
    slug,
    description: (input.description ?? '').trim(),
    coverMediaId: input.coverMediaId?.trim() || null,
    ownerUserId,
    sitePageId: input.sitePageId?.trim() || null,
    // Stamp verified when pack says approval is not required; otherwise leave null.
    verifiedAt: opts?.pagesNeedApproval === false ? now : null,
    extensions: input.extensions ?? {},
    createdAt: now,
    updatedAt: now,
  }
  const ownerAdmin: PageAdminRecord = {
    id: newId(),
    pageId,
    userId: ownerUserId,
    addedByUserId: null,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, page, ownerAdmin }
}

/** Staff verify / clear verifiedAt on a page (admin list). */
export function decideSetPageVerified(
  page: PageRecord | null,
  verified: boolean,
  opts?: { now?: Date },
): PageMutationResult {
  if (!page) return { ok: false, reason: 'not_found' }
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    page: {
      ...page,
      verifiedAt: verified ? now : null,
      updatedAt: now,
    },
  }
}

/**
 * Owner / admin adds another admin. Calls canInteract — blocked / hidden / banned refuse.
 * Unique (pageId, userId): existing admin → already_admin (or updates updatedAt via upsert path).
 */
export function decideAddPageAdmin(
  page: PageRecord | null,
  actorAdmin: PageAdminRecord | null,
  current: PageAdminRecord | null,
  input: AddPageAdminInput,
  opts?: { now?: Date; newId?: () => string },
): PageAdminMutationResult {
  if (!page) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  const target = input.targetUserId.trim()
  if (!actor || !target) return { ok: false, reason: 'invalid' }
  if (actor === target) return { ok: false, reason: 'self' }
  if (page.id.trim() !== input.pageId.trim()) return { ok: false, reason: 'invalid' }
  if (!isPageAdminRow(actorAdmin) || actorAdmin!.userId !== actor) {
    return { ok: false, reason: 'not_admin' }
  }

  if (
    isSocialBanned(input.interact.actorBannedAt) ||
    isSocialBanned(input.interact.otherBannedAt)
  ) {
    return { ok: false, reason: 'banned' }
  }
  if (!canInteract(actor, target, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current && current.pageId === page.id && current.userId === target) {
    return { ok: false, reason: 'already_admin' }
  }

  return {
    ok: true,
    admin: {
      id: newId(),
      pageId: page.id,
      userId: target,
      addedByUserId: actor,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Like a page. Unique (userId, pageId): existing like updates that row’s updatedAt.
 * When interact + ownerUserId are provided, blocked / hidden / banned refuse.
 */
export function decideLikePage(
  page: PageRecord | null,
  current: PageLikeRecord | null,
  input: LikePageInput,
  opts?: {
    now?: Date
    newId?: () => string
    /** Pack allowPages. Default true. */
    allowPages?: boolean
    /** Pack allowPageLikes. Default true. */
    allowPageLikes?: boolean
  },
): PageLikeMutationResult {
  if (!page) return { ok: false, reason: 'not_found' }
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }
  if (page.id.trim() !== input.pageId.trim()) return { ok: false, reason: 'invalid' }
  if (opts?.allowPages === false || opts?.allowPageLikes === false) {
    return { ok: false, reason: 'disabled' }
  }

  if (input.interact && input.ownerUserId) {
    const owner = input.ownerUserId.trim()
    if (owner && owner !== userId) {
      if (
        isSocialBanned(input.interact.actorBannedAt) ||
        isSocialBanned(input.interact.otherBannedAt)
      ) {
        return { ok: false, reason: 'banned' }
      }
      if (!canInteract(userId, owner, input.interact)) {
        if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
        return { ok: false, reason: 'cannot_interact' }
      }
    }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current && current.pageId === page.id && current.userId === userId) {
    return {
      ok: true,
      like: {
        ...current,
        updatedAt: now,
      },
    }
  }

  return {
    ok: true,
    like: {
      id: newId(),
      pageId: page.id,
      userId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideUnlikePage(
  page: PageRecord | null,
  current: PageLikeRecord | null,
  userId: string,
):
  | { ok: true; removed: PageLikeRecord }
  | { ok: false; reason: PageRefuseReason } {
  if (!page) return { ok: false, reason: 'not_found' }
  const actor = userId.trim()
  if (!actor || !current || current.userId !== actor || current.pageId !== page.id) {
    return { ok: false, reason: 'not_liked' }
  }
  return { ok: true, removed: current }
}

/**
 * Wall post for a page. Author must be a page admin.
 * Visibility is pageId (likers + admins), not the audience picker.
 */
export function createPageWallPost(
  admin: PageAdminRecord | null,
  input: CreatePageWallPostInput,
  opts?: Parameters<typeof createPostRecord>[1],
): PostMutationResult {
  const pageId = input.pageId.trim()
  const author = input.authorUserId.trim()
  if (!pageId || !author) return { ok: false, reason: 'invalid' }
  if (!isPageAdminRow(admin) || admin!.userId !== author) {
    return { ok: false, reason: 'invalid' }
  }
  if (admin!.pageId !== pageId) return { ok: false, reason: 'invalid' }

  return createPostRecord(
    {
      ...input,
      authorUserId: author,
      audience: 'public',
      groupId: null,
      pageId,
    },
    opts,
  )
}

/** Build canViewPost.isPageLiker from a like row for this post’s pageId. */
export function isPageLikerForPost(
  postPageId: string | null | undefined,
  like: PageLikeRecord | null | undefined,
): boolean {
  const pageId = postPageId?.trim() || ''
  if (!pageId) return false
  if (!like) return false
  return like.pageId === pageId
}

/** Build canViewPost.isPageAdmin from an admin row for this post’s pageId. */
export function isPageAdminForPost(
  postPageId: string | null | undefined,
  admin: PageAdminRecord | null | undefined,
): boolean {
  const pageId = postPageId?.trim() || ''
  if (!pageId) return false
  if (!isPageAdminRow(admin)) return false
  return admin!.pageId === pageId
}

export type PageBag = {
  pages: Map<string, PageRecord>
  admins: Map<string, PageAdminRecord>
  likes: Map<string, PageLikeRecord>
  posts: Map<string, PostRecord>
}

function adminKey(pageId: string, userId: string): string {
  return `${pageId}\0${userId}`
}

function likeKey(pageId: string, userId: string): string {
  return `${pageId}\0${userId}`
}

/** In-memory pages for unit tests — same unique like / admin rules as the DB. */
export function createPageMemory(opts?: {
  newId?: () => string
  now?: () => Date
}): {
  bag: PageBag
  createPage: (
    input: CreatePageInput,
  ) =>
    | { ok: true; page: PageRecord; ownerAdmin: PageAdminRecord }
    | { ok: false; reason: PageRefuseReason }
  addAdmin: (input: AddPageAdminInput) => PageAdminMutationResult
  like: (input: LikePageInput) => PageLikeMutationResult
  unlike: (pageId: string, userId: string) =>
    | { ok: true; removed: PageLikeRecord }
    | { ok: false; reason: PageRefuseReason }
  getPage: (pageId: string) => PageRecord | null
  getAdmin: (pageId: string, userId: string) => PageAdminRecord | null
  getLike: (pageId: string, userId: string) => PageLikeRecord | null
  wallPost: (input: CreatePageWallPostInput) => PostMutationResult
  likedPageIds: (userId: string) => Set<string>
  adminPageIds: (userId: string) => Set<string>
} {
  const bag: PageBag = {
    pages: new Map(),
    admins: new Map(),
    likes: new Map(),
    posts: new Map(),
  }
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())

  function getAdmin(pageId: string, userId: string): PageAdminRecord | null {
    return bag.admins.get(adminKey(pageId.trim(), userId.trim())) ?? null
  }

  function getLike(pageId: string, userId: string): PageLikeRecord | null {
    return bag.likes.get(likeKey(pageId.trim(), userId.trim())) ?? null
  }

  return {
    bag,
    createPage: (input) => {
      const slug = (input.slug?.trim() || slugifyPageLabel(input.name)).trim()
      const slugTaken = [...bag.pages.values()].some((row) => row.slug === slug)
      const decision = decideCreatePage(input, {
        now: now(),
        newId,
        slugTaken,
      })
      if (!decision.ok) return decision
      bag.pages.set(decision.page.id, decision.page)
      bag.admins.set(
        adminKey(decision.ownerAdmin.pageId, decision.ownerAdmin.userId),
        decision.ownerAdmin,
      )
      return decision
    },
    addAdmin: (input) => {
      const page = bag.pages.get(input.pageId.trim()) ?? null
      const actorAdmin = getAdmin(input.pageId, input.actorUserId)
      const current = getAdmin(input.pageId, input.targetUserId)
      const decision = decideAddPageAdmin(page, actorAdmin, current, input, {
        now: now(),
        newId,
      })
      if (!decision.ok) return decision
      bag.admins.set(
        adminKey(decision.admin.pageId, decision.admin.userId),
        decision.admin,
      )
      return decision
    },
    like: (input) => {
      const page = bag.pages.get(input.pageId.trim()) ?? null
      const current = getLike(input.pageId, input.userId)
      const decision = decideLikePage(page, current, input, {
        now: now(),
        newId,
      })
      if (!decision.ok) return decision
      bag.likes.set(likeKey(decision.like.pageId, decision.like.userId), decision.like)
      return decision
    },
    unlike: (pageId, userId) => {
      const page = bag.pages.get(pageId.trim()) ?? null
      const current = getLike(pageId, userId)
      const decision = decideUnlikePage(page, current, userId)
      if (!decision.ok) return decision
      bag.likes.delete(likeKey(decision.removed.pageId, decision.removed.userId))
      return decision
    },
    getPage: (pageId) => bag.pages.get(pageId.trim()) ?? null,
    getAdmin,
    getLike,
    wallPost: (input) => {
      const admin = getAdmin(input.pageId, input.authorUserId)
      const decision = createPageWallPost(admin, input, {
        now: now(),
        newId,
      })
      if (!decision.ok) return decision
      bag.posts.set(decision.post.id, decision.post)
      return decision
    },
    likedPageIds: (userId) => {
      const id = userId.trim()
      const out = new Set<string>()
      for (const like of bag.likes.values()) {
        if (like.userId === id) out.add(like.pageId)
      }
      return out
    },
    adminPageIds: (userId) => {
      const id = userId.trim()
      const out = new Set<string>()
      for (const admin of bag.admins.values()) {
        if (admin.userId === id) out.add(admin.pageId)
      }
      return out
    },
  }
}
