/**
 * product:social groups persistence — categories, membership, wall, directory.
 */

import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  canManageGroupMembers,
  createGroupWallPost,
  decideAcceptGroupInvite,
  decideCreateGroup,
  decideCreateGroupCategory,
  decideInviteToGroup,
  decideJoinGroup,
  decideSetGroupVerified,
  isActiveGroupMember,
  isGroupCategoryKind,
  isGroupMemberRole,
  isGroupMemberStatus,
  isGroupVisibility,
  slugifyGroupLabel,
  type CreateGroupCategoryInput,
  type CreateGroupInput,
  type CreateGroupWallPostInput,
  type GroupCategoryMutationResult,
  type GroupCategoryRecord,
  type GroupMemberMutationResult,
  type GroupMemberRecord,
  type GroupMutationResult,
  type GroupRecord,
  type GroupRefuseReason,
  type InviteToGroupInput,
} from './groups'
import {
  announceGroupPostWithMail,
  decideAddGroupDocument,
  decideAnnounceGroupPost,
  decideAssignGroupRank,
  decideCreateGroupRank,
  decideDeleteGroup,
  decideRemoveGroupMember,
  decideSetGroupFormDefinition,
  decideSetGroupMemberRole,
  decideTransferGroup,
  type AddGroupDocumentInput,
  type AnnounceGroupPostInput,
  type AssignGroupRankInput,
  type CreateGroupRankInput,
  type DeleteGroupInput,
  type GroupAnnounceResult,
  type GroupDeleteResult,
  type GroupDocumentMutationResult,
  type GroupDocumentRecord,
  type GroupMemberToolsResult,
  type GroupRankMutationResult,
  type GroupRankRecord,
  type GroupToolsRefuseReason,
  type GroupTransferResult,
  type RemoveGroupMemberInput,
  type SetGroupFormDefinitionInput,
  type SetGroupMemberRoleInput,
  type TransferGroupInput,
} from './group-tools'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt } from './members-store'
import {
  toPostRecord,
  type PostMutationResult,
  type PostRecord,
} from './posts'
import { findPost, hydratePostsMedia } from './posts-store'
import {
  sfSocialActivities,
  sfSocialComments,
  sfSocialGroupCategories,
  sfSocialGroupDocuments,
  sfSocialGroupMembers,
  sfSocialGroupRanks,
  sfSocialGroups,
  sfSocialPostMedia,
  sfSocialPosts,
  sfSocialReactions,
} from './schema'

function mapCategory(
  row: typeof sfSocialGroupCategories.$inferSelect,
): GroupCategoryRecord | null {
  if (!isGroupCategoryKind(row.kind)) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapGroup(row: typeof sfSocialGroups.$inferSelect): GroupRecord | null {
  if (!isGroupVisibility(row.visibility)) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverMediaId: row.coverMediaId,
    categoryId: row.categoryId,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    formDefinitionId: row.formDefinitionId,
    verifiedAt: row.verifiedAt,
    extensions: (row.extensions ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMembership(
  row: typeof sfSocialGroupMembers.$inferSelect,
): GroupMemberRecord | null {
  if (!isGroupMemberRole(row.role) || !isGroupMemberStatus(row.status)) return null
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invitedByUserId,
    rankId: row.rankId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPostRow(row: typeof sfSocialPosts.$inferSelect): PostRecord | null {
  return toPostRecord(row)
}

const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string
  slug: string
  kind: 'general' | 'team' | 'association'
}> = [
  { name: 'General', slug: 'general', kind: 'general' },
  { name: 'Team', slug: 'team', kind: 'team' },
  { name: 'Association', slug: 'association', kind: 'association' },
]

export async function findGroupCategory(
  categoryId: string,
): Promise<GroupCategoryRecord | null> {
  const id = categoryId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupCategories)
      .where(eq(sfSocialGroupCategories.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapCategory(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_categories|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function listGroupCategories(): Promise<GroupCategoryRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupCategories)
      .orderBy(sfSocialGroupCategories.name)
    return rows.map(mapCategory).filter((row): row is GroupCategoryRecord => Boolean(row))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_categories|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Ensure the three default kinds exist (by slug). Idempotent. */
export async function ensureDefaultGroupCategories(): Promise<GroupCategoryRecord[]> {
  const existing = await listGroupCategories()
  const bySlug = new Map(existing.map((row) => [row.slug, row]))
  for (const seed of DEFAULT_CATEGORIES) {
    if (bySlug.has(seed.slug)) continue
    const created = await createGroupCategory(seed)
    if (created.ok) bySlug.set(created.category.slug, created.category)
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createGroupCategory(
  input: CreateGroupCategoryInput,
): Promise<GroupCategoryMutationResult> {
  const slug = (input.slug?.trim() || slugifyGroupLabel(input.name)).trim()
  let slugTaken = false
  try {
    const clash = await db
      .select({ id: sfSocialGroupCategories.id })
      .from(sfSocialGroupCategories)
      .where(eq(sfSocialGroupCategories.slug, slug))
      .limit(1)
    slugTaken = clash.length > 0
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_categories|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const decision = decideCreateGroupCategory(input, { slugTaken })
  if (!decision.ok) return decision
  try {
    await db.insert(sfSocialGroupCategories).values({
      id: decision.category.id,
      name: decision.category.name,
      slug: decision.category.slug,
      kind: decision.category.kind,
      createdAt: decision.category.createdAt,
      updatedAt: decision.category.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate/i.test(msg)) return { ok: false, reason: 'slug_taken' }
    if (/sf_social_group_categories|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function findGroup(groupId: string): Promise<GroupRecord | null> {
  const id = groupId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialGroups)
      .where(eq(sfSocialGroups.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapGroup(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findGroupBySlug(slug: string): Promise<GroupRecord | null> {
  const key = slug.trim().toLowerCase()
  if (!key) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialGroups)
      .where(eq(sfSocialGroups.slug, key))
      .limit(1)
    const row = rows[0]
    return row ? mapGroup(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findGroupMembership(
  groupId: string,
  userId: string,
): Promise<GroupMemberRecord | null> {
  const g = groupId.trim()
  const u = userId.trim()
  if (!g || !u) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupMembers)
      .where(
        and(eq(sfSocialGroupMembers.groupId, g), eq(sfSocialGroupMembers.userId, u)),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapMembership(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/** Active group ids for canViewPost / home-feed membership sets. */
export async function listActiveMemberGroupIds(userId: string): Promise<string[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select({ groupId: sfSocialGroupMembers.groupId })
      .from(sfSocialGroupMembers)
      .where(
        and(
          eq(sfSocialGroupMembers.userId, self),
          eq(sfSocialGroupMembers.status, 'active'),
        ),
      )
    return rows.map((row) => row.groupId).filter(Boolean)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function isUserActiveGroupMember(
  userId: string,
  groupId: string,
): Promise<boolean> {
  const membership = await findGroupMembership(groupId, userId)
  return isActiveGroupMember(membership)
}

export async function createGroup(
  input: CreateGroupInput,
  extras?: { canCreate?: boolean },
): Promise<
  | { ok: true; group: GroupRecord; ownerMembership: GroupMemberRecord }
  | { ok: false; reason: GroupRefuseReason }
> {
  const slug = (input.slug?.trim() || slugifyGroupLabel(input.name)).trim().toLowerCase()
  const { loadSocialModuleSettings } = await import('./settings')
  const [category, slugClash, ownerBannedAt, pack] = await Promise.all([
    findGroupCategory(input.categoryId),
    (async () => {
      try {
        const rows = await db
          .select({ id: sfSocialGroups.id })
          .from(sfSocialGroups)
          .where(eq(sfSocialGroups.slug, slug))
          .limit(1)
        return rows.length > 0
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (/sf_social_groups|does not exist|relation/i.test(msg)) return false
        throw error
      }
    })(),
    getMemberBannedAt(input.ownerUserId),
    loadSocialModuleSettings(),
  ])

  const decision = decideCreateGroup(
    { ...input, slug },
    {
      categoryExists: Boolean(category),
      slugTaken: slugClash,
      ownerBannedAt,
      allowGroups: pack.settings.allowGroups,
      canCreate: extras?.canCreate,
      groupsNeedApproval: pack.settings.groupsNeedApproval,
      defaultJoinRule: pack.settings.defaultGroupJoinRule,
      allowGroupJoinForm: pack.settings.allowGroupJoinForm,
    },
  )
  if (!decision.ok) return decision

  try {
    await db.transaction(async (tx) => {
      await tx.insert(sfSocialGroups).values({
        id: decision.group.id,
        name: decision.group.name,
        slug: decision.group.slug,
        description: decision.group.description,
        coverMediaId: decision.group.coverMediaId,
        categoryId: decision.group.categoryId,
        visibility: decision.group.visibility,
        ownerUserId: decision.group.ownerUserId,
        formDefinitionId: decision.group.formDefinitionId,
        verifiedAt: decision.group.verifiedAt,
        extensions: decision.group.extensions,
        createdAt: decision.group.createdAt,
        updatedAt: decision.group.updatedAt,
      })
      await tx.insert(sfSocialGroupMembers).values({
        id: decision.ownerMembership.id,
        groupId: decision.ownerMembership.groupId,
        userId: decision.ownerMembership.userId,
        role: decision.ownerMembership.role,
        status: decision.ownerMembership.status,
        invitedByUserId: decision.ownerMembership.invitedByUserId,
        rankId: decision.ownerMembership.rankId,
        createdAt: decision.ownerMembership.createdAt,
        updatedAt: decision.ownerMembership.updatedAt,
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate/i.test(msg)) return { ok: false, reason: 'slug_taken' }
    if (/sf_social_groups|sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

async function upsertMembership(
  membership: GroupMemberRecord,
): Promise<void> {
  await db
    .insert(sfSocialGroupMembers)
    .values({
      id: membership.id,
      groupId: membership.groupId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      invitedByUserId: membership.invitedByUserId,
      rankId: membership.rankId,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    })
    .onConflictDoUpdate({
      target: [sfSocialGroupMembers.groupId, sfSocialGroupMembers.userId],
      set: {
        role: membership.role,
        status: membership.status,
        invitedByUserId: membership.invitedByUserId,
        rankId: membership.rankId,
        updatedAt: membership.updatedAt,
      },
    })
}

export async function joinGroup(
  groupId: string,
  actorUserId: string,
): Promise<GroupMemberMutationResult> {
  const { loadSocialModuleSettings } = await import('./settings')
  const [group, current, actorBannedAt, pack, activeMemberCount] = await Promise.all([
    findGroup(groupId),
    findGroupMembership(groupId, actorUserId),
    getMemberBannedAt(actorUserId),
    loadSocialModuleSettings(),
    countActiveGroupMembers(groupId),
  ])
  const decision = decideJoinGroup(group, current, actorUserId, {
    actorBannedAt,
    allowGroups: pack.settings.allowGroups,
    maxGroupMembers: pack.settings.maxGroupMembers,
    activeMemberCount,
  })
  if (!decision.ok) return decision
  try {
    await upsertMembership(decision.membership)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/** Staff verify / clear verifiedAt (admin groups list). */
export async function setGroupVerified(
  groupId: string,
  verified: boolean,
): Promise<GroupMutationResult> {
  const group = await findGroup(groupId)
  const decision = decideSetGroupVerified(group, verified)
  if (!decision.ok) return decision
  try {
    await db
      .update(sfSocialGroups)
      .set({
        verifiedAt: decision.group.verifiedAt,
        updatedAt: decision.group.updatedAt,
      })
      .where(eq(sfSocialGroups.id, decision.group.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function inviteToGroup(
  input: InviteToGroupInput,
): Promise<GroupMemberMutationResult> {
  const [group, actorMembership, current] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    findGroupMembership(input.groupId, input.inviteeUserId),
  ])
  const decision = decideInviteToGroup(group, actorMembership, current, input)
  if (!decision.ok) return decision
  try {
    await upsertMembership(decision.membership)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

async function loadInteractContext(
  actorUserId: string,
  otherUserId: string,
): Promise<CanInteractContext> {
  const { areBlocked } = await import('./friends-store')
  const { getMemberBannedAt, isMemberAccountHidden } = await import('./members-store')
  const actor = actorUserId.trim()
  const other = otherUserId.trim()
  const [isBlocked, actorBannedAt, otherBannedAt, actorHidden, otherHidden] =
    await Promise.all([
      actor && other && actor !== other ? areBlocked(actor, other) : Promise.resolve(false),
      getMemberBannedAt(actor),
      getMemberBannedAt(other),
      isMemberAccountHidden(actor),
      isMemberAccountHidden(other),
    ])
  return {
    isBlocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  }
}

/**
 * Invite then emit `product:social/group.invited`.
 * Resolves canInteract facts. Mail failure does not roll back.
 */
export async function inviteToGroupNotifying(
  input: { groupId: string; actorUserId: string; inviteeUserId: string },
  opts?: { inviteeEmail?: string },
): Promise<GroupMemberMutationResult> {
  const { inviteToGroupWithMail } = await import('./groups')
  const { emitGroupInvitedEmail } = await import('./email')
  const interact = await loadInteractContext(input.actorUserId, input.inviteeUserId)
  const full: InviteToGroupInput = { ...input, interact }
  return inviteToGroupWithMail(
    () => inviteToGroup(full),
    async (membership) => {
      await emitGroupInvitedEmail({
        groupId: membership.groupId,
        membershipId: membership.id,
        inviterUserId: input.actorUserId,
        inviteeUserId: membership.userId,
        inviteeEmail: opts?.inviteeEmail,
      })
    },
  )
}

export async function acceptGroupInvite(
  groupId: string,
  actorUserId: string,
): Promise<GroupMemberMutationResult> {
  const [group, current] = await Promise.all([
    findGroup(groupId),
    findGroupMembership(groupId, actorUserId),
  ])
  const decision = decideAcceptGroupInvite(group, current, actorUserId)
  if (!decision.ok) return decision
  try {
    await upsertMembership(decision.membership)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function createGroupWallPostInDb(
  input: CreateGroupWallPostInput,
): Promise<PostMutationResult> {
  const membership = await findGroupMembership(input.groupId, input.authorUserId)
  const authorBannedAt = await getMemberBannedAt(input.authorUserId)
  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decision = createGroupWallPost(membership, input, {
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

export type GroupDirectoryItem = {
  group: GroupRecord
  category: GroupCategoryRecord | null
  memberCount: number
}

/** Directory `/feed/groups` — optional category filter. */
export async function listGroupsDirectory(opts?: {
  categoryId?: string | null
  limit?: number
}): Promise<GroupDirectoryItem[]> {
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)
  const categoryId = opts?.categoryId?.trim() || null
  try {
    await ensureDefaultGroupCategories()
    const rows = categoryId
      ? await db
          .select()
          .from(sfSocialGroups)
          .where(eq(sfSocialGroups.categoryId, categoryId))
          .orderBy(desc(sfSocialGroups.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(sfSocialGroups)
          .orderBy(desc(sfSocialGroups.createdAt))
          .limit(limit)

    const groups = rows.map(mapGroup).filter((row): row is GroupRecord => Boolean(row))
    if (groups.length === 0) return []

    const categoryIds = [...new Set(groups.map((g) => g.categoryId))]
    const groupIds = groups.map((g) => g.id)
    const [categories, counts] = await Promise.all([
      db
        .select()
        .from(sfSocialGroupCategories)
        .where(inArray(sfSocialGroupCategories.id, categoryIds)),
      db
        .select({
          groupId: sfSocialGroupMembers.groupId,
          count: sql<number>`count(*)::int`,
        })
        .from(sfSocialGroupMembers)
        .where(
          and(
            inArray(sfSocialGroupMembers.groupId, groupIds),
            eq(sfSocialGroupMembers.status, 'active'),
          ),
        )
        .groupBy(sfSocialGroupMembers.groupId),
    ])
    const categoryById = new Map(
      categories
        .map(mapCategory)
        .filter((row): row is GroupCategoryRecord => Boolean(row))
        .map((row) => [row.id, row]),
    )
    const countById = new Map(counts.map((row) => [row.groupId, Number(row.count) || 0]))
    return groups.map((group) => ({
      group,
      category: categoryById.get(group.categoryId) ?? null,
      memberCount: countById.get(group.id) ?? 0,
    }))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export type SocialGroupListItem = {
  groupId: string
  name: string
  slug: string
  memberCount: number
}

/** Groups the viewer actively belongs to (social-groups particle). */
export async function listMyGroups(
  userId: string,
  limit = 20,
): Promise<SocialGroupListItem[]> {
  const self = userId.trim()
  if (!self) return []
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100)
  try {
    const memberships = await db
      .select()
      .from(sfSocialGroupMembers)
      .where(
        and(
          eq(sfSocialGroupMembers.userId, self),
          eq(sfSocialGroupMembers.status, 'active'),
        ),
      )
      .orderBy(desc(sfSocialGroupMembers.updatedAt))
      .limit(capped)
    if (memberships.length === 0) return []
    const groupIds = memberships.map((row) => row.groupId)
    const groups = await db
      .select()
      .from(sfSocialGroups)
      .where(inArray(sfSocialGroups.id, groupIds))
    const byId = new Map(
      groups
        .map(mapGroup)
        .filter((row): row is GroupRecord => Boolean(row))
        .map((row) => [row.id, row]),
    )
    const counts = await db
      .select({
        groupId: sfSocialGroupMembers.groupId,
        count: sql<number>`count(*)::int`,
      })
      .from(sfSocialGroupMembers)
      .where(
        and(
          inArray(sfSocialGroupMembers.groupId, groupIds),
          eq(sfSocialGroupMembers.status, 'active'),
        ),
      )
      .groupBy(sfSocialGroupMembers.groupId)
    const countById = new Map(counts.map((row) => [row.groupId, Number(row.count) || 0]))
    const out: SocialGroupListItem[] = []
    for (const membership of memberships) {
      const group = byId.get(membership.groupId)
      if (!group) continue
      out.push({
        groupId: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: countById.get(group.id) ?? 0,
      })
    }
    return out
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Groups this member owns (personal composer group choice). */
export async function listOwnedGroups(userId: string): Promise<GroupRecord[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialGroups)
      .where(eq(sfSocialGroups.ownerUserId, self))
      .orderBy(sfSocialGroups.name)
    return rows.map(mapGroup).filter((row): row is GroupRecord => Boolean(row))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Wall posts for `/feed/g/[slug]` (newest first). */
export async function listGroupWallPosts(
  groupId: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const id = groupId.trim()
  if (!id) return []
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)
  try {
    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(
        and(eq(sfSocialPosts.groupId, id), eq(sfSocialPosts.audience, 'group')),
      )
      .orderBy(desc(sfSocialPosts.isAnnouncement), desc(sfSocialPosts.createdAt))
      .limit(limit)
    const posts = rows.map(mapPostRow).filter((row): row is PostRecord => Boolean(row))
    return hydratePostsMedia(posts)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function countActiveGroupMembers(groupId: string): Promise<number> {
  const id = groupId.trim()
  if (!id) return 0
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sfSocialGroupMembers)
      .where(
        and(
          eq(sfSocialGroupMembers.groupId, id),
          eq(sfSocialGroupMembers.status, 'active'),
        ),
      )
    return Number(rows[0]?.count) || 0
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) return 0
    throw error
  }
}

function mapRank(row: typeof sfSocialGroupRanks.$inferSelect): GroupRankRecord {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    sortOrder: row.sortOrder,
    canAnnounce: row.canAnnounce,
    canManageDocuments: row.canManageDocuments,
    canManageCalendar: row.canManageCalendar,
    canManageMembers: row.canManageMembers,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapDocument(
  row: typeof sfSocialGroupDocuments.$inferSelect,
): GroupDocumentRecord {
  return {
    id: row.id,
    groupId: row.groupId,
    mediaId: row.mediaId,
    title: row.title,
    addedByUserId: row.addedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findGroupRank(rankId: string): Promise<GroupRankRecord | null> {
  const id = rankId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupRanks)
      .where(eq(sfSocialGroupRanks.id, id))
      .limit(1)
    return rows[0] ? mapRank(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_ranks|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function listGroupRanks(groupId: string): Promise<GroupRankRecord[]> {
  const id = groupId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupRanks)
      .where(eq(sfSocialGroupRanks.groupId, id))
      .orderBy(sfSocialGroupRanks.sortOrder, sfSocialGroupRanks.name)
    return rows.map(mapRank)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_ranks|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function listGroupDocuments(
  groupId: string,
): Promise<GroupDocumentRecord[]> {
  const id = groupId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupDocuments)
      .where(eq(sfSocialGroupDocuments.groupId, id))
      .orderBy(desc(sfSocialGroupDocuments.createdAt))
    return rows.map(mapDocument)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_documents|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function listActiveGroupMembers(
  groupId: string,
): Promise<GroupMemberRecord[]> {
  const id = groupId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialGroupMembers)
      .where(
        and(
          eq(sfSocialGroupMembers.groupId, id),
          eq(sfSocialGroupMembers.status, 'active'),
        ),
      )
      .orderBy(sfSocialGroupMembers.createdAt)
    return rows.map(mapMembership).filter((row): row is GroupMemberRecord => Boolean(row))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

async function loadActorRank(
  membership: GroupMemberRecord | null,
): Promise<GroupRankRecord | null> {
  if (!membership?.rankId) return null
  return findGroupRank(membership.rankId)
}

export async function createGroupRank(
  input: CreateGroupRankInput,
): Promise<GroupRankMutationResult> {
  const [group, actorMembership] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
  ])
  const category = group ? await findGroupCategory(group.categoryId) : null
  const decision = decideCreateGroupRank(group, category, actorMembership, input)
  if (!decision.ok) return decision
  try {
    await db.insert(sfSocialGroupRanks).values({
      id: decision.rank.id,
      groupId: decision.rank.groupId,
      name: decision.rank.name,
      sortOrder: decision.rank.sortOrder,
      canAnnounce: decision.rank.canAnnounce,
      canManageDocuments: decision.rank.canManageDocuments,
      canManageCalendar: decision.rank.canManageCalendar,
      canManageMembers: decision.rank.canManageMembers,
      createdAt: decision.rank.createdAt,
      updatedAt: decision.rank.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_ranks|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function assignGroupRank(
  input: AssignGroupRankInput,
): Promise<GroupMemberToolsResult> {
  const [group, actorMembership, targetMembership] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    findGroupMembership(input.groupId, input.targetUserId),
  ])
  const category = group ? await findGroupCategory(group.categoryId) : null
  const rankId = input.rankId?.trim() || null
  const rank = rankId ? await findGroupRank(rankId) : null
  const decision = decideAssignGroupRank(
    group,
    category,
    actorMembership,
    targetMembership,
    rank,
    input,
  )
  if (!decision.ok) return decision
  try {
    await upsertMembership(decision.membership)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function setGroupMemberRole(
  input: SetGroupMemberRoleInput,
): Promise<GroupMemberToolsResult> {
  const [group, actorMembership, targetMembership] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    findGroupMembership(input.groupId, input.targetUserId),
  ])
  const decision = decideSetGroupMemberRole(
    group,
    actorMembership,
    targetMembership,
    input,
  )
  if (!decision.ok) return decision
  try {
    await upsertMembership(decision.membership)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function removeGroupMember(
  input: RemoveGroupMemberInput,
): Promise<
  | { ok: true; removed: GroupMemberRecord }
  | { ok: false; reason: GroupToolsRefuseReason }
> {
  const [group, actorMembership, targetMembership] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    findGroupMembership(input.groupId, input.targetUserId),
  ])
  const category = group ? await findGroupCategory(group.categoryId) : null
  const actorRank = await loadActorRank(actorMembership)
  const decision = decideRemoveGroupMember(
    group,
    category,
    actorMembership,
    actorRank,
    targetMembership,
    input,
  )
  if (!decision.ok) return decision
  try {
    await db
      .delete(sfSocialGroupMembers)
      .where(eq(sfSocialGroupMembers.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function addGroupDocument(
  input: AddGroupDocumentInput,
): Promise<GroupDocumentMutationResult> {
  const { loadSocialModuleSettings } = await import('./settings')
  const [group, actorMembership, pack] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    loadSocialModuleSettings(),
  ])
  const category = group ? await findGroupCategory(group.categoryId) : null
  const actorRank = await loadActorRank(actorMembership)
  const mediaId = input.mediaId.trim()
  let mediaExists = false
  if (mediaId) {
    const { memberOwnsMedia } = await import('@/modules/media/api.server')
    mediaExists = await memberOwnsMedia(input.actorUserId.trim(), mediaId)
  }
  const decision = decideAddGroupDocument(
    group,
    category,
    actorMembership,
    actorRank,
    input,
    {
      mediaExists,
      allowGroupDocuments: pack.settings.allowGroupDocuments,
    },
  )
  if (!decision.ok) return decision
  try {
    await db.insert(sfSocialGroupDocuments).values({
      id: decision.document.id,
      groupId: decision.document.groupId,
      mediaId: decision.document.mediaId,
      title: decision.document.title,
      addedByUserId: decision.document.addedByUserId,
      createdAt: decision.document.createdAt,
      updatedAt: decision.document.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group_documents|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function announceGroupPost(
  input: AnnounceGroupPostInput,
): Promise<GroupAnnounceResult> {
  const { loadSocialModuleSettings } = await import('./settings')
  const [group, actorMembership, post, pack] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    findPost(input.postId),
    loadSocialModuleSettings(),
  ])
  const category = group ? await findGroupCategory(group.categoryId) : null
  const actorRank = await loadActorRank(actorMembership)
  const decision = decideAnnounceGroupPost(
    group,
    category,
    actorMembership,
    actorRank,
    post,
    input,
    { allowGroupAnnouncements: pack.settings.allowGroupAnnouncements },
  )
  if (!decision.ok) return decision
  try {
    await db
      .update(sfSocialPosts)
      .set({
        isAnnouncement: true,
        updatedAt: decision.post.updatedAt,
      })
      .where(eq(sfSocialPosts.id, decision.post.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/**
 * Announce then emit `product:social/group.announced`.
 * Mail failure does not roll back the pin.
 */
export async function announceGroupPostNotifying(
  input: AnnounceGroupPostInput,
): Promise<GroupAnnounceResult> {
  const { emitGroupAnnouncedEmail } = await import('./email')
  return announceGroupPostWithMail(
    () => announceGroupPost(input),
    async (post) => {
      await emitGroupAnnouncedEmail({
        groupId: post.groupId ?? input.groupId,
        postId: post.id,
        actorUserId: input.actorUserId,
      })
    },
  )
}

export async function setGroupFormDefinition(
  input: SetGroupFormDefinitionInput,
): Promise<
  | { ok: true; group: GroupRecord }
  | { ok: false; reason: GroupToolsRefuseReason }
> {
  const { loadSocialModuleSettings } = await import('./settings')
  const [group, actorMembership, pack] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
    loadSocialModuleSettings(),
  ])
  const decision = decideSetGroupFormDefinition(group, actorMembership, input, {
    allowGroupJoinForm: pack.settings.allowGroupJoinForm,
  })
  if (!decision.ok) return decision
  try {
    await db
      .update(sfSocialGroups)
      .set({
        formDefinitionId: decision.group.formDefinitionId,
        updatedAt: decision.group.updatedAt,
      })
      .where(eq(sfSocialGroups.id, decision.group.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_groups|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function transferGroup(
  input: Omit<TransferGroupInput, 'interact'> & { interact?: CanInteractContext },
): Promise<GroupTransferResult> {
  const interact =
    input.interact ??
    (await loadInteractContext(input.actorUserId, input.newOwnerUserId))
  const full: TransferGroupInput = { ...input, interact }
  const [group, actorMembership, newOwnerMembership] = await Promise.all([
    findGroup(full.groupId),
    findGroupMembership(full.groupId, full.actorUserId),
    findGroupMembership(full.groupId, full.newOwnerUserId),
  ])
  const decision = decideTransferGroup(
    group,
    actorMembership,
    newOwnerMembership,
    full,
  )
  if (!decision.ok) return decision
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sfSocialGroups)
        .set({
          ownerUserId: decision.group.ownerUserId,
          updatedAt: decision.group.updatedAt,
        })
        .where(eq(sfSocialGroups.id, decision.group.id))
      await tx
        .update(sfSocialGroupMembers)
        .set({
          role: decision.previousOwner.role,
          rankId: decision.previousOwner.rankId,
          updatedAt: decision.previousOwner.updatedAt,
        })
        .where(eq(sfSocialGroupMembers.id, decision.previousOwner.id))
      await tx
        .update(sfSocialGroupMembers)
        .set({
          role: decision.newOwner.role,
          rankId: decision.newOwner.rankId,
          updatedAt: decision.newOwner.updatedAt,
        })
        .where(eq(sfSocialGroupMembers.id, decision.newOwner.id))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_group|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function deleteGroup(
  input: DeleteGroupInput,
): Promise<GroupDeleteResult> {
  const [group, actorMembership] = await Promise.all([
    findGroup(input.groupId),
    findGroupMembership(input.groupId, input.actorUserId),
  ])
  const decision = decideDeleteGroup(group, actorMembership, input)
  if (!decision.ok) return decision
  const gid = decision.groupId
  try {
    await db.transaction(async (tx) => {
      const wall = await tx
        .select({ id: sfSocialPosts.id })
        .from(sfSocialPosts)
        .where(eq(sfSocialPosts.groupId, gid))
      const postIds = wall.map((row) => row.id)
      if (postIds.length > 0) {
        await tx.delete(sfSocialComments).where(inArray(sfSocialComments.postId, postIds))
        await tx
          .delete(sfSocialReactions)
          .where(
            and(
              eq(sfSocialReactions.targetType, 'post'),
              inArray(sfSocialReactions.targetId, postIds),
            ),
          )
        await tx
          .delete(sfSocialPostMedia)
          .where(inArray(sfSocialPostMedia.postId, postIds))
        await tx
          .delete(sfSocialActivities)
          .where(inArray(sfSocialActivities.postId, postIds))
        // Report rows are kept (post delete rule).
        await tx.delete(sfSocialPosts).where(inArray(sfSocialPosts.id, postIds))
      }
      await tx
        .delete(sfSocialGroupDocuments)
        .where(eq(sfSocialGroupDocuments.groupId, gid))
      await tx.delete(sfSocialGroupRanks).where(eq(sfSocialGroupRanks.groupId, gid))
      await tx
        .delete(sfSocialGroupMembers)
        .where(eq(sfSocialGroupMembers.groupId, gid))
      await tx.delete(sfSocialGroups).where(eq(sfSocialGroups.id, gid))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export { canManageGroupMembers }
export type { CanInteractContext }
