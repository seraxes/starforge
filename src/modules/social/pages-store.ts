/**
 * product:social pages persistence — directory, admins, likes, wall.
 */

import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { areBlocked } from './friends-store'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import {
  createPageWallPost,
  decideAddPageAdmin,
  decideCreatePage,
  decideLikePage,
  decideSetPageVerified,
  decideUnlikePage,
  isPageAdminRow,
  slugifyPageLabel,
  type AddPageAdminInput,
  type CreatePageInput,
  type CreatePageWallPostInput,
  type LikePageInput,
  type PageAdminMutationResult,
  type PageAdminRecord,
  type PageLikeMutationResult,
  type PageLikeRecord,
  type PageMutationResult,
  type PageRecord,
  type PageRefuseReason,
} from './pages'
import {
  toPostRecord,
  type PostMutationResult,
  type PostRecord,
} from './posts'
import { hydratePostsMedia } from './posts-store'
import {
  sfSocialPageAdmins,
  sfSocialPageLikes,
  sfSocialPages,
  sfSocialPosts,
} from './schema'

function mapPage(row: typeof sfSocialPages.$inferSelect): PageRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverMediaId: row.coverMediaId,
    ownerUserId: row.ownerUserId,
    sitePageId: row.sitePageId,
    verifiedAt: row.verifiedAt,
    extensions: (row.extensions ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapAdmin(row: typeof sfSocialPageAdmins.$inferSelect): PageAdminRecord {
  return {
    id: row.id,
    pageId: row.pageId,
    userId: row.userId,
    addedByUserId: row.addedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapLike(row: typeof sfSocialPageLikes.$inferSelect): PageLikeRecord {
  return {
    id: row.id,
    pageId: row.pageId,
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPostRow(row: typeof sfSocialPosts.$inferSelect): PostRecord | null {
  return toPostRecord(row)
}

export async function findPage(pageId: string): Promise<PageRecord | null> {
  const id = pageId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPages)
      .where(eq(sfSocialPages.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapPage(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_pages|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findPageBySlug(slug: string): Promise<PageRecord | null> {
  const s = slug.trim().toLowerCase()
  if (!s) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPages)
      .where(eq(sfSocialPages.slug, s))
      .limit(1)
    const row = rows[0]
    return row ? mapPage(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_pages|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findPageAdmin(
  pageId: string,
  userId: string,
): Promise<PageAdminRecord | null> {
  const p = pageId.trim()
  const u = userId.trim()
  if (!p || !u) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPageAdmins)
      .where(
        and(eq(sfSocialPageAdmins.pageId, p), eq(sfSocialPageAdmins.userId, u)),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapAdmin(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_admins|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findPageLike(
  pageId: string,
  userId: string,
): Promise<PageLikeRecord | null> {
  const p = pageId.trim()
  const u = userId.trim()
  if (!p || !u) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPageLikes)
      .where(and(eq(sfSocialPageLikes.pageId, p), eq(sfSocialPageLikes.userId, u)))
      .limit(1)
    const row = rows[0]
    return row ? mapLike(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_likes|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/** Page ids this member likes (home-feed / canViewPost sets). */
export async function listLikedPageIds(userId: string): Promise<string[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select({ pageId: sfSocialPageLikes.pageId })
      .from(sfSocialPageLikes)
      .where(eq(sfSocialPageLikes.userId, self))
    return rows.map((row) => row.pageId).filter(Boolean)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_likes|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Page ids this member admins (home-feed / canViewPost sets). */
export async function listAdminPageIds(userId: string): Promise<string[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select({ pageId: sfSocialPageAdmins.pageId })
      .from(sfSocialPageAdmins)
      .where(eq(sfSocialPageAdmins.userId, self))
    return rows.map((row) => row.pageId).filter(Boolean)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_admins|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function isUserPageLiker(
  userId: string,
  pageId: string,
): Promise<boolean> {
  const like = await findPageLike(pageId, userId)
  return Boolean(like)
}

export async function isUserPageAdmin(
  userId: string,
  pageId: string,
): Promise<boolean> {
  const admin = await findPageAdmin(pageId, userId)
  return isPageAdminRow(admin)
}

export async function createPage(
  input: CreatePageInput,
  extras?: { canCreate?: boolean },
): Promise<
  | { ok: true; page: PageRecord; ownerAdmin: PageAdminRecord }
  | { ok: false; reason: PageRefuseReason }
> {
  const slug = (input.slug?.trim() || slugifyPageLabel(input.name)).trim().toLowerCase()
  const { loadSocialModuleSettings } = await import('./settings')
  const [slugClash, ownerBannedAt, pack] = await Promise.all([
    (async () => {
      try {
        const rows = await db
          .select({ id: sfSocialPages.id })
          .from(sfSocialPages)
          .where(eq(sfSocialPages.slug, slug))
          .limit(1)
        return rows.length > 0
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (/sf_social_pages|does not exist|relation/i.test(msg)) return false
        throw error
      }
    })(),
    getMemberBannedAt(input.ownerUserId),
    loadSocialModuleSettings(),
  ])

  const decision = decideCreatePage(
    { ...input, slug },
    {
      slugTaken: slugClash,
      ownerBannedAt,
      allowPages: pack.settings.allowPages,
      canCreate: extras?.canCreate,
      pagesNeedApproval: pack.settings.pagesNeedApproval,
    },
  )
  if (!decision.ok) return decision

  try {
    await db.transaction(async (tx) => {
      await tx.insert(sfSocialPages).values({
        id: decision.page.id,
        name: decision.page.name,
        slug: decision.page.slug,
        description: decision.page.description,
        coverMediaId: decision.page.coverMediaId,
        ownerUserId: decision.page.ownerUserId,
        sitePageId: decision.page.sitePageId,
        verifiedAt: decision.page.verifiedAt,
        extensions: decision.page.extensions,
        createdAt: decision.page.createdAt,
        updatedAt: decision.page.updatedAt,
      })
      await tx.insert(sfSocialPageAdmins).values({
        id: decision.ownerAdmin.id,
        pageId: decision.ownerAdmin.pageId,
        userId: decision.ownerAdmin.userId,
        addedByUserId: decision.ownerAdmin.addedByUserId,
        createdAt: decision.ownerAdmin.createdAt,
        updatedAt: decision.ownerAdmin.updatedAt,
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page|unique|duplicate|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'slug_taken' }
    }
    throw error
  }
  return decision
}

async function interactAgainstOwner(
  actorUserId: string,
  ownerUserId: string,
): Promise<CanInteractContext> {
  const actor = actorUserId.trim()
  const owner = ownerUserId.trim()
  if (!actor || !owner || actor === owner) {
    return {
      isBlocked: false,
      actorHidden: false,
      otherHidden: false,
      actorBannedAt: null,
      otherBannedAt: null,
    }
  }
  const [blocked, actorHidden, otherHidden, actorBannedAt, otherBannedAt] =
    await Promise.all([
      areBlocked(actor, owner),
      isMemberAccountHidden(actor),
      isMemberAccountHidden(owner),
      getMemberBannedAt(actor),
      getMemberBannedAt(owner),
    ])
  return {
    isBlocked: blocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  }
}

export async function addPageAdmin(
  input: Omit<AddPageAdminInput, 'interact'> & { interact?: CanInteractContext },
): Promise<PageAdminMutationResult> {
  const [page, actorAdmin, current] = await Promise.all([
    findPage(input.pageId),
    findPageAdmin(input.pageId, input.actorUserId),
    findPageAdmin(input.pageId, input.targetUserId),
  ])
  const interact =
    input.interact ??
    (page
      ? await interactAgainstOwner(input.actorUserId, input.targetUserId)
      : {
          isBlocked: false,
          actorHidden: false,
          otherHidden: false,
          actorBannedAt: null,
          otherBannedAt: null,
        })
  const decision = decideAddPageAdmin(page, actorAdmin, current, {
    ...input,
    interact,
  })
  if (!decision.ok) return decision
  try {
    await db.insert(sfSocialPageAdmins).values({
      id: decision.admin.id,
      pageId: decision.admin.pageId,
      userId: decision.admin.userId,
      addedByUserId: decision.admin.addedByUserId,
      createdAt: decision.admin.createdAt,
      updatedAt: decision.admin.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate/i.test(msg)) return { ok: false, reason: 'already_admin' }
    if (/sf_social_page_admins|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function likePage(
  input: Omit<LikePageInput, 'interact' | 'ownerUserId'> & {
    interact?: CanInteractContext
  },
): Promise<PageLikeMutationResult> {
  const { loadSocialModuleSettings } = await import('./settings')
  const [page, current, pack] = await Promise.all([
    findPage(input.pageId),
    findPageLike(input.pageId, input.userId),
    loadSocialModuleSettings(),
  ])
  const interact =
    input.interact ??
    (page ? await interactAgainstOwner(input.userId, page.ownerUserId) : undefined)
  const decision = decideLikePage(
    page,
    current,
    {
      ...input,
      interact,
      ownerUserId: page?.ownerUserId,
    },
    {
      allowPages: pack.settings.allowPages,
      allowPageLikes: pack.settings.allowPageLikes,
    },
  )
  if (!decision.ok) return decision
  try {
    if (current) {
      await db
        .update(sfSocialPageLikes)
        .set({ updatedAt: decision.like.updatedAt })
        .where(eq(sfSocialPageLikes.id, current.id))
    } else {
      await db.insert(sfSocialPageLikes).values({
        id: decision.like.id,
        pageId: decision.like.pageId,
        userId: decision.like.userId,
        createdAt: decision.like.createdAt,
        updatedAt: decision.like.updatedAt,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate/i.test(msg)) {
      // Concurrent insert — treat as update of the open row.
      const existing = await findPageLike(input.pageId, input.userId)
      if (existing) {
        await db
          .update(sfSocialPageLikes)
          .set({ updatedAt: decision.like.updatedAt })
          .where(eq(sfSocialPageLikes.id, existing.id))
        return { ok: true, like: { ...existing, updatedAt: decision.like.updatedAt } }
      }
      return { ok: false, reason: 'already_liked' }
    }
    if (/sf_social_page_likes|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/** Staff verify / clear verifiedAt (admin pages list). */
export async function setPageVerified(
  pageId: string,
  verified: boolean,
): Promise<PageMutationResult> {
  const page = await findPage(pageId)
  const decision = decideSetPageVerified(page, verified)
  if (!decision.ok) return decision
  try {
    await db
      .update(sfSocialPages)
      .set({
        verifiedAt: decision.page.verifiedAt,
        updatedAt: decision.page.updatedAt,
      })
      .where(eq(sfSocialPages.id, decision.page.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_pages|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function unlikePage(
  pageId: string,
  userId: string,
): Promise<
  | { ok: true; removed: PageLikeRecord }
  | { ok: false; reason: PageRefuseReason }
> {
  const [page, current] = await Promise.all([
    findPage(pageId),
    findPageLike(pageId, userId),
  ])
  const decision = decideUnlikePage(page, current, userId)
  if (!decision.ok) return decision
  try {
    await db
      .delete(sfSocialPageLikes)
      .where(eq(sfSocialPageLikes.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_likes|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function createPageWallPostInDb(
  input: CreatePageWallPostInput,
): Promise<PostMutationResult> {
  const admin = await findPageAdmin(input.pageId, input.authorUserId)
  const authorBannedAt = await getMemberBannedAt(input.authorUserId)
  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decision = createPageWallPost(admin, input, {
    authorBannedAt,
    isKindEnabled: (kind) => isComposerPostKindEnabled(kind, pack.settings),
    holdForStaffReview: pack.settings.holdNewPostsForReview,
  })
  if (!decision.ok) return decision

  try {
    await db.insert(sfSocialPosts).values({
      id: decision.post.id,
      authorUserId: decision.post.authorUserId,
      body: decision.post.body,
      kind: decision.post.kind,
      audience: decision.post.audience,
      groupId: decision.post.groupId,
      pageId: decision.post.pageId,
      staffHidden: decision.post.staffHidden,
      pendingReview: decision.post.pendingReview,
      isAnnouncement: decision.post.isAnnouncement,
      editedAt: decision.post.editedAt,
      extensions: decision.post.extensions,
      createdAt: decision.post.createdAt,
      updatedAt: decision.post.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export type PageDirectoryItem = {
  page: PageRecord
  likeCount: number
}

/** Directory `/feed/pages`. */
export async function listPagesDirectory(opts?: {
  limit?: number
}): Promise<PageDirectoryItem[]> {
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)
  try {
    const rows = await db
      .select()
      .from(sfSocialPages)
      .orderBy(desc(sfSocialPages.createdAt))
      .limit(limit)
    const pages = rows.map(mapPage)
    if (pages.length === 0) return []
    const pageIds = pages.map((p) => p.id)
    const counts = await db
      .select({
        pageId: sfSocialPageLikes.pageId,
        count: sql<number>`count(*)::int`,
      })
      .from(sfSocialPageLikes)
      .where(inArray(sfSocialPageLikes.pageId, pageIds))
      .groupBy(sfSocialPageLikes.pageId)
    const countById = new Map(counts.map((row) => [row.pageId, Number(row.count) || 0]))
    return pages.map((page) => ({
      page,
      likeCount: countById.get(page.id) ?? 0,
    }))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_pages|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export type SocialPageListItem = {
  pageId: string
  name: string
  slug: string
  likeCount: number
  coverMediaId: string | null
  ownerUserId: string
}

function toSocialPageListItem(page: PageRecord, likeCount: number): SocialPageListItem {
  return {
    pageId: page.id,
    name: page.name,
    slug: page.slug,
    likeCount,
    coverMediaId: page.coverMediaId,
    ownerUserId: page.ownerUserId,
  }
}

async function likeCountsForPages(pageIds: string[]): Promise<Map<string, number>> {
  if (pageIds.length === 0) return new Map()
  const counts = await db
    .select({
      pageId: sfSocialPageLikes.pageId,
      count: sql<number>`count(*)::int`,
    })
    .from(sfSocialPageLikes)
    .where(inArray(sfSocialPageLikes.pageId, pageIds))
    .groupBy(sfSocialPageLikes.pageId)
  return new Map(counts.map((row) => [row.pageId, Number(row.count) || 0]))
}

/** Pages the viewer likes (social-pages particle source=viewer). */
export async function listMyLikedPages(
  userId: string,
  limit = 20,
): Promise<SocialPageListItem[]> {
  const self = userId.trim()
  if (!self) return []
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  try {
    const likes = await db
      .select()
      .from(sfSocialPageLikes)
      .where(eq(sfSocialPageLikes.userId, self))
      .orderBy(desc(sfSocialPageLikes.updatedAt))
      .limit(capped)
    if (likes.length === 0) return []
    const pageIds = likes.map((row) => row.pageId)
    const pages = await db
      .select()
      .from(sfSocialPages)
      .where(inArray(sfSocialPages.id, pageIds))
    const byId = new Map(pages.map(mapPage).map((row) => [row.id, row]))
    const countById = await likeCountsForPages(pageIds)
    const out: SocialPageListItem[] = []
    for (const like of likes) {
      const page = byId.get(like.pageId)
      if (!page) continue
      out.push(toSocialPageListItem(page, countById.get(page.id) ?? 0))
    }
    return out
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Selected pages by id (social-pages particle source=groups). */
export async function listPagesByIds(
  pageIds: readonly string[],
  limit = 20,
): Promise<SocialPageListItem[]> {
  const ids = [...new Set(pageIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  const slice = ids.slice(0, capped)
  try {
    const pages = await db
      .select()
      .from(sfSocialPages)
      .where(inArray(sfSocialPages.id, slice))
    const byId = new Map(pages.map(mapPage).map((row) => [row.id, row]))
    const countById = await likeCountsForPages(slice)
    const out: SocialPageListItem[] = []
    for (const id of slice) {
      const page = byId.get(id)
      if (!page) continue
      out.push(toSocialPageListItem(page, countById.get(page.id) ?? 0))
    }
    return out
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Directory rows shaped for the social-pages particle (source=all). */
export async function listPagesForParticle(
  limit = 20,
): Promise<SocialPageListItem[]> {
  const directory = await listPagesDirectory({ limit })
  return directory.map((row) => toSocialPageListItem(row.page, row.likeCount))
}

/** Wall posts for `/feed/p/[slug]` (newest first). */
export async function listPageWallPosts(
  pageId: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const id = pageId.trim()
  if (!id) return []
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)
  try {
    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.pageId, id))
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(limit)
    const posts = rows.map(mapPostRow).filter((row): row is PostRecord => Boolean(row))
    return hydratePostsMedia(posts)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function countPageLikes(pageId: string): Promise<number> {
  const id = pageId.trim()
  if (!id) return 0
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sfSocialPageLikes)
      .where(eq(sfSocialPageLikes.pageId, id))
    return Number(rows[0]?.count) || 0
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_page_likes|does not exist|relation/i.test(msg)) return 0
    throw error
  }
}
