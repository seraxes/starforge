/**
 * product:social groups — categories, membership, wall posts, invite.
 *
 * Categories kind: general | team | association. Membership is unique per
 * (groupId, userId); a second invite updates the open row. canViewPost uses
 * isActiveGroupMember for audience=group. Invites call canInteract (block /
 * hidden / banned) — they do not re-derive the block rule.
 * Team tools (ranks, docs, announcements) live in group-tools.ts (slice 14).
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
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
  resolveGroupPermissions,
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
  type GroupTransferResult,
  type RemoveGroupMemberInput,
  type SetGroupFormDefinitionInput,
  type SetGroupMemberRoleInput,
  type TransferGroupInput,
} from './group-tools'
import {
  createPostRecord,
  type CreatePostInput,
  type PostMutationResult,
  type PostRecord,
} from './posts'

export const GROUP_CATEGORY_KINDS = ['general', 'team', 'association'] as const
export type GroupCategoryKind = (typeof GROUP_CATEGORY_KINDS)[number]

export const GROUP_VISIBILITIES = ['open', 'closed'] as const
export type GroupVisibility = (typeof GROUP_VISIBILITIES)[number]

export const GROUP_MEMBER_ROLES = ['owner', 'admin', 'member'] as const
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number]

export const GROUP_MEMBER_STATUSES = ['active', 'invited', 'requested'] as const
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number]

export type GroupCategoryRecord = {
  id: string
  name: string
  slug: string
  kind: GroupCategoryKind
  createdAt: Date
  updatedAt: Date
}

export type GroupRecord = {
  id: string
  name: string
  slug: string
  description: string
  coverMediaId: string | null
  categoryId: string
  visibility: GroupVisibility
  ownerUserId: string
  formDefinitionId: string | null
  verifiedAt: Date | null
  extensions: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type GroupMemberRecord = {
  id: string
  groupId: string
  userId: string
  role: GroupMemberRole
  status: GroupMemberStatus
  invitedByUserId: string | null
  /** Optional team/association rank (slice 14). */
  rankId: string | null
  createdAt: Date
  updatedAt: Date
}

export type GroupRefuseReason =
  | 'invalid'
  | 'invalid_kind'
  | 'invalid_visibility'
  | 'not_found'
  | 'slug_taken'
  | 'not_member'
  | 'already_member'
  | 'already_invited'
  | 'not_invited'
  | 'not_requested'
  | 'not_admin'
  | 'not_open'
  | 'not_closed'
  | 'blocked'
  | 'banned'
  | 'cannot_interact'
  | 'self'
  | 'not_owner'
  | 'not_team_tools'
  | 'protected_member'
  | 'unknown_media'
  | 'rank_required'
  | 'not_allowed'
  /** Pack allowGroups / tool switch is off, or creator role refuses. */
  | 'disabled'
  /** Pack maxGroupMembers reached. */
  | 'member_cap'

export type GroupMutationResult =
  | { ok: true; group: GroupRecord }
  | { ok: false; reason: GroupRefuseReason }

export type GroupCategoryMutationResult =
  | { ok: true; category: GroupCategoryRecord }
  | { ok: false; reason: GroupRefuseReason }

export type GroupMemberMutationResult =
  | { ok: true; membership: GroupMemberRecord }
  | { ok: false; reason: GroupRefuseReason }

export type CreateGroupCategoryInput = {
  name: string
  slug?: string
  kind: GroupCategoryKind | string
}

export type CreateGroupInput = {
  name: string
  slug?: string
  description?: string
  coverMediaId?: string | null
  categoryId: string
  visibility?: GroupVisibility | string
  ownerUserId: string
  formDefinitionId?: string | null
  extensions?: Record<string, unknown>
}

export type InviteToGroupInput = {
  groupId: string
  actorUserId: string
  inviteeUserId: string
  interact: CanInteractContext
}

export type ApproveGroupJoinInput = {
  groupId: string
  actorUserId: string
  targetUserId: string
}

export type DeclineGroupJoinInput = {
  groupId: string
  actorUserId: string
  targetUserId: string
}

export type CreateGroupWallPostInput = CreatePostInput & {
  groupId: string
}

export function isGroupCategoryKind(value: string): value is GroupCategoryKind {
  return (GROUP_CATEGORY_KINDS as readonly string[]).includes(value)
}

export function isGroupVisibility(value: string): value is GroupVisibility {
  return (GROUP_VISIBILITIES as readonly string[]).includes(value)
}

export function isGroupMemberRole(value: string): value is GroupMemberRole {
  return (GROUP_MEMBER_ROLES as readonly string[]).includes(value)
}

export function isGroupMemberStatus(value: string): value is GroupMemberStatus {
  return (GROUP_MEMBER_STATUSES as readonly string[]).includes(value)
}

/** Active membership is the only input that makes isGroupMember true. */
export function isActiveGroupMember(
  row: GroupMemberRecord | null | undefined,
): boolean {
  return row?.status === 'active'
}

export function canManageGroupMembers(
  row: GroupMemberRecord | null | undefined,
): boolean {
  if (!isActiveGroupMember(row)) return false
  return row!.role === 'owner' || row!.role === 'admin'
}

/** Permalink / directory path for a group. */
export function groupHref(slug: string): string {
  return `/feed/g/${encodeURIComponent(slug.trim())}`
}

/**
 * Media serve path for a stored group cover id.
 * Empty when unset — the page must not render a cover img.
 */
export function groupCoverMediaSrc(
  coverMediaId: string | null | undefined,
): string {
  const id = (coverMediaId ?? '').trim()
  return id ? `/api/media/${encodeURIComponent(id)}` : ''
}

/**
 * Group page shell flags for `/feed/g/[slug]`.
 * Cover src is set only when coverMediaId is stored. Member roster and wall
 * are for active members; non-members (and strangers) see neither. Manager
 * tools and staff pending-join review stay additive outside this helper.
 */
export function buildGroupPageShell(input: {
  coverMediaId: string | null | undefined
  membership: GroupMemberRecord | null | undefined
}): {
  coverSrc: string | null
  showMembersList: boolean
  showWall: boolean
} {
  const coverSrc = groupCoverMediaSrc(input.coverMediaId) || null
  const isMember = isActiveGroupMember(input.membership)
  return {
    coverSrc,
    showMembersList: isMember,
    showWall: isMember,
  }
}

/** Normalize a display name into a URL slug. */
export function slugifyGroupLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function decideCreateGroupCategory(
  input: CreateGroupCategoryInput,
  opts?: { now?: Date; newId?: () => string; slugTaken?: boolean },
): GroupCategoryMutationResult {
  const name = input.name.trim()
  if (!name) return { ok: false, reason: 'invalid' }
  const kindRaw = typeof input.kind === 'string' ? input.kind.trim() : ''
  if (!isGroupCategoryKind(kindRaw)) return { ok: false, reason: 'invalid_kind' }
  const slug = (input.slug?.trim() || slugifyGroupLabel(name)).trim()
  if (!slug) return { ok: false, reason: 'invalid' }
  if (opts?.slugTaken) return { ok: false, reason: 'slug_taken' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    category: {
      id: newId(),
      name,
      slug,
      kind: kindRaw,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideCreateGroup(
  input: CreateGroupInput,
  opts?: {
    now?: Date
    newId?: () => string
    categoryExists?: boolean
    slugTaken?: boolean
    ownerBannedAt?: Date | null
    /** Pack allowGroups. Default true. */
    allowGroups?: boolean
    /** Creator role gate. Default true. */
    canCreate?: boolean
    /**
     * When true, new groups stay unverified until staff sets verifiedAt.
     * When false, create stamps verifiedAt.
     */
    groupsNeedApproval?: boolean
    /** Pack default join rule when input.visibility is blank. */
    defaultJoinRule?: GroupVisibility | string
    /** Pack allowGroupJoinForm. Blank form id when false. */
    allowGroupJoinForm?: boolean
  },
):
  | { ok: true; group: GroupRecord; ownerMembership: GroupMemberRecord }
  | { ok: false; reason: GroupRefuseReason } {
  const ownerUserId = input.ownerUserId.trim()
  const name = input.name.trim()
  const categoryId = input.categoryId.trim()
  if (!ownerUserId || !name || !categoryId) return { ok: false, reason: 'invalid' }
  if (opts?.allowGroups === false) return { ok: false, reason: 'disabled' }
  if (opts?.canCreate === false) return { ok: false, reason: 'not_allowed' }
  if (isSocialBanned(opts?.ownerBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (opts?.categoryExists === false) return { ok: false, reason: 'not_found' }

  const slug = (input.slug?.trim() || slugifyGroupLabel(name)).trim()
  if (!slug) return { ok: false, reason: 'invalid' }
  if (opts?.slugTaken) return { ok: false, reason: 'slug_taken' }

  const defaultRule =
    typeof opts?.defaultJoinRule === 'string' && opts.defaultJoinRule.trim()
      ? opts.defaultJoinRule.trim()
      : 'open'
  const visibilityRaw =
    typeof input.visibility === 'string' && input.visibility.trim()
      ? input.visibility.trim()
      : defaultRule
  if (!isGroupVisibility(visibilityRaw)) {
    return { ok: false, reason: 'invalid_visibility' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const groupId = newId()
  const joinFormAllowed = opts?.allowGroupJoinForm !== false
  const group: GroupRecord = {
    id: groupId,
    name,
    slug,
    description: (input.description ?? '').trim(),
    coverMediaId: input.coverMediaId?.trim() || null,
    categoryId,
    visibility: visibilityRaw,
    ownerUserId,
    formDefinitionId: joinFormAllowed ? input.formDefinitionId?.trim() || null : null,
    // Stamp verified when pack says approval is not required; otherwise leave null.
    verifiedAt: opts?.groupsNeedApproval === false ? now : null,
    extensions: input.extensions ?? {},
    createdAt: now,
    updatedAt: now,
  }
  const ownerMembership: GroupMemberRecord = {
    id: newId(),
    groupId,
    userId: ownerUserId,
    role: 'owner',
    status: 'active',
    invitedByUserId: null,
    rankId: null,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, group, ownerMembership }
}

/** Staff verify / clear verifiedAt on a group (admin list). */
export function decideSetGroupVerified(
  group: GroupRecord | null,
  verified: boolean,
  opts?: { now?: Date },
): GroupMutationResult {
  if (!group) return { ok: false, reason: 'not_found' }
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    group: {
      ...group,
      verifiedAt: verified ? now : null,
      updatedAt: now,
    },
  }
}

/**
 * Open group: any signed-in member becomes active.
 * Closed group: creates a requested row (admin approves later).
 */
export function decideJoinGroup(
  group: GroupRecord | null,
  current: GroupMemberRecord | null,
  actorUserId: string,
  opts?: {
    now?: Date
    newId?: () => string
    actorBannedAt?: Date | null
    /** Active member count before this join. */
    activeMemberCount?: number
    /** Pack maxGroupMembers (0 = no cap). */
    maxGroupMembers?: number
    /** Pack allowGroups. Default true. */
    allowGroups?: boolean
  },
): GroupMemberMutationResult {
  if (!group) return { ok: false, reason: 'not_found' }
  const actor = actorUserId.trim()
  if (!actor) return { ok: false, reason: 'invalid' }
  if (opts?.allowGroups === false) return { ok: false, reason: 'disabled' }
  if (isSocialBanned(opts?.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (current && current.groupId === group.id && current.userId === actor) {
    if (current.status === 'active') return { ok: false, reason: 'already_member' }
    if (current.status === 'invited') {
      const now = opts?.now ?? new Date()
      const max = opts?.maxGroupMembers ?? 0
      const count = opts?.activeMemberCount ?? 0
      if (Number.isInteger(max) && max > 0 && Number.isInteger(count) && count >= max) {
        return { ok: false, reason: 'member_cap' }
      }
      return {
        ok: true,
        membership: {
          ...current,
          status: 'active',
          role: current.role === 'owner' ? 'owner' : 'member',
          rankId: current.role === 'owner' ? current.rankId : null,
          updatedAt: now,
        },
      }
    }
    if (current.status === 'requested') {
      return { ok: true, membership: current }
    }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const max = opts?.maxGroupMembers ?? 0
  const count = opts?.activeMemberCount ?? 0
  const atCap =
    Number.isInteger(max) && max > 0 && Number.isInteger(count) && count >= max
  if (group.visibility === 'open') {
    if (atCap) return { ok: false, reason: 'member_cap' }
    return {
      ok: true,
      membership: {
        id: current?.id ?? newId(),
        groupId: group.id,
        userId: actor,
        role: 'member',
        status: 'active',
        invitedByUserId: null,
        rankId: null,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      },
    }
  }
  return {
    ok: true,
    membership: {
      id: current?.id ?? newId(),
      groupId: group.id,
      userId: actor,
      role: 'member',
      status: 'requested',
      invitedByUserId: null,
      rankId: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    },
  }
}

/**
 * Owner / admin invite. Calls canInteract — blocked / hidden / banned refuse.
 * Unique (groupId, userId): active → already_member; invited → update row.
 */
export function decideInviteToGroup(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  current: GroupMemberRecord | null,
  input: InviteToGroupInput,
  opts?: { now?: Date; newId?: () => string },
): GroupMemberMutationResult {
  if (!group) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  const invitee = input.inviteeUserId.trim()
  if (!actor || !invitee) return { ok: false, reason: 'invalid' }
  if (actor === invitee) return { ok: false, reason: 'self' }
  if (group.id.trim() !== input.groupId.trim()) return { ok: false, reason: 'invalid' }
  if (!canManageGroupMembers(actorMembership)) {
    return { ok: false, reason: 'not_admin' }
  }

  if (
    isSocialBanned(input.interact.actorBannedAt) ||
    isSocialBanned(input.interact.otherBannedAt)
  ) {
    return { ok: false, reason: 'banned' }
  }
  if (!canInteract(actor, invitee, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current && current.groupId === group.id && current.userId === invitee) {
    if (current.status === 'active') return { ok: false, reason: 'already_member' }
    return {
      ok: true,
      membership: {
        ...current,
        status: 'invited',
        role: current.role === 'owner' ? 'owner' : 'member',
        rankId: current.role === 'owner' ? current.rankId : null,
        invitedByUserId: actor,
        updatedAt: now,
      },
    }
  }

  return {
    ok: true,
    membership: {
      id: newId(),
      groupId: group.id,
      userId: invitee,
      role: 'member',
      status: 'invited',
      invitedByUserId: actor,
      rankId: null,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/** Invitee accepts → active member. */
export function decideAcceptGroupInvite(
  group: GroupRecord | null,
  current: GroupMemberRecord | null,
  actorUserId: string,
  opts?: { now?: Date },
): GroupMemberMutationResult {
  if (!group) return { ok: false, reason: 'not_found' }
  const actor = actorUserId.trim()
  if (!actor || !current || current.userId !== actor || current.groupId !== group.id) {
    return { ok: false, reason: 'not_found' }
  }
  if (current.status === 'active') return { ok: false, reason: 'already_member' }
  if (current.status !== 'invited') return { ok: false, reason: 'not_invited' }
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    membership: {
      ...current,
      status: 'active',
      role: 'member',
      rankId: null,
      updatedAt: now,
    },
  }
}

function actorMayReviewGroupJoinRequests(
  actorMembership: GroupMemberRecord | null | undefined,
  actorRank: GroupRankRecord | null | undefined,
  staffCanManageMembers: boolean,
): boolean {
  if (staffCanManageMembers) return true
  return resolveGroupPermissions(actorMembership, actorRank).canManageMembers
}

/**
 * Owner / admin / rank with canManageMembers (or Social staff) promote a
 * requested row to active. Open-group joins stay instant via decideJoinGroup.
 */
export function decideApproveGroupJoinRequest(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  actorRank: GroupRankRecord | null,
  targetMembership: GroupMemberRecord | null,
  input: ApproveGroupJoinInput,
  opts?: {
    now?: Date
    actorBannedAt?: Date | null
    activeMemberCount?: number
    maxGroupMembers?: number
    /** App admin / admin.social edit — additive with group ACL. */
    staffCanManageMembers?: boolean
  },
): GroupMemberMutationResult {
  if (!group || group.id.trim() !== input.groupId.trim()) {
    return { ok: false, reason: 'not_found' }
  }
  const actor = input.actorUserId.trim()
  const target = input.targetUserId.trim()
  if (!actor || !target) return { ok: false, reason: 'invalid' }
  if (actor === target) return { ok: false, reason: 'self' }
  if (isSocialBanned(opts?.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (
    !actorMayReviewGroupJoinRequests(
      actorMembership,
      actorRank,
      Boolean(opts?.staffCanManageMembers),
    )
  ) {
    return { ok: false, reason: 'not_allowed' }
  }
  if (
    !targetMembership ||
    targetMembership.groupId !== group.id ||
    targetMembership.userId !== target
  ) {
    return { ok: false, reason: 'not_found' }
  }
  if (targetMembership.status === 'active') {
    return { ok: false, reason: 'already_member' }
  }
  if (targetMembership.status !== 'requested') {
    return { ok: false, reason: 'not_requested' }
  }

  const max = opts?.maxGroupMembers ?? 0
  const count = opts?.activeMemberCount ?? 0
  if (Number.isInteger(max) && max > 0 && Number.isInteger(count) && count >= max) {
    return { ok: false, reason: 'member_cap' }
  }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    membership: {
      ...targetMembership,
      status: 'active',
      role: 'member',
      rankId: null,
      updatedAt: now,
    },
  }
}

/**
 * Clear a requested row so the person can ask again. Same ACL as approve.
 */
export function decideDeclineGroupJoinRequest(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  actorRank: GroupRankRecord | null,
  targetMembership: GroupMemberRecord | null,
  input: DeclineGroupJoinInput,
  opts?: {
    actorBannedAt?: Date | null
    /** App admin / admin.social edit — additive with group ACL. */
    staffCanManageMembers?: boolean
  },
):
  | { ok: true; declined: GroupMemberRecord }
  | { ok: false; reason: GroupRefuseReason } {
  if (!group || group.id.trim() !== input.groupId.trim()) {
    return { ok: false, reason: 'not_found' }
  }
  const actor = input.actorUserId.trim()
  const target = input.targetUserId.trim()
  if (!actor || !target) return { ok: false, reason: 'invalid' }
  if (actor === target) return { ok: false, reason: 'self' }
  if (isSocialBanned(opts?.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (
    !actorMayReviewGroupJoinRequests(
      actorMembership,
      actorRank,
      Boolean(opts?.staffCanManageMembers),
    )
  ) {
    return { ok: false, reason: 'not_allowed' }
  }
  if (
    !targetMembership ||
    targetMembership.groupId !== group.id ||
    targetMembership.userId !== target
  ) {
    return { ok: false, reason: 'not_found' }
  }
  if (targetMembership.status === 'active') {
    return { ok: false, reason: 'already_member' }
  }
  if (targetMembership.status !== 'requested') {
    return { ok: false, reason: 'not_requested' }
  }
  return { ok: true, declined: targetMembership }
}

/**
 * Wall post for a group. Author must be an active member (owner or not).
 * Audience is always `group` with this groupId.
 */
export function createGroupWallPost(
  membership: GroupMemberRecord | null,
  input: CreateGroupWallPostInput,
  opts?: Parameters<typeof createPostRecord>[1],
): PostMutationResult {
  const groupId = input.groupId.trim()
  const author = input.authorUserId.trim()
  if (!groupId || !author) return { ok: false, reason: 'invalid' }
  if (!isActiveGroupMember(membership) || membership!.userId !== author) {
    return { ok: false, reason: 'invalid' }
  }
  if (membership!.groupId !== groupId) return { ok: false, reason: 'invalid' }

  return createPostRecord(
    {
      ...input,
      authorUserId: author,
      audience: 'group',
      groupId,
      pageId: null,
    },
    opts,
  )
}

/**
 * Build canViewPost.isGroupMember from a membership row for this post’s groupId.
 */
export function isGroupMemberForPost(
  postGroupId: string | null | undefined,
  membership: GroupMemberRecord | null | undefined,
): boolean {
  const groupId = postGroupId?.trim() || ''
  if (!groupId) return false
  if (!isActiveGroupMember(membership)) return false
  return membership!.groupId === groupId
}

/**
 * Persist invite then emit mail. Mail failure does not roll back the row.
 */
export async function inviteToGroupWithMail(
  persist: () => Promise<GroupMemberMutationResult> | GroupMemberMutationResult,
  emitMail: (membership: GroupMemberRecord) => Promise<void>,
): Promise<GroupMemberMutationResult> {
  const result = await persist()
  if (!result.ok) return result
  try {
    await emitMail(result.membership)
  } catch {
    // Soft-fail — the invite row must stay.
  }
  return result
}

export type GroupBag = {
  categories: Map<string, GroupCategoryRecord>
  groups: Map<string, GroupRecord>
  members: Map<string, GroupMemberRecord>
  posts: Map<string, PostRecord>
  ranks: Map<string, GroupRankRecord>
  documents: Map<string, GroupDocumentRecord>
}

function memberKey(groupId: string, userId: string): string {
  return `${groupId}\0${userId}`
}

/** In-memory groups for unit tests — same unique membership rule as the DB. */
export function createGroupMemory(opts?: {
  newId?: () => string
  now?: () => Date
  resolveMedia?: (mediaId: string) => boolean
}): {
  bag: GroupBag
  createCategory: (input: CreateGroupCategoryInput) => GroupCategoryMutationResult
  createGroup: (
    input: CreateGroupInput,
  ) =>
    | { ok: true; group: GroupRecord; ownerMembership: GroupMemberRecord }
    | { ok: false; reason: GroupRefuseReason }
  join: (groupId: string, actorUserId: string) => GroupMemberMutationResult
  invite: (
    input: InviteToGroupInput,
  ) => GroupMemberMutationResult
  acceptInvite: (groupId: string, actorUserId: string) => GroupMemberMutationResult
  approveJoin: (
    input: ApproveGroupJoinInput,
    opts?: {
      actorBannedAt?: Date | null
      activeMemberCount?: number
      maxGroupMembers?: number
      staffCanManageMembers?: boolean
    },
  ) => GroupMemberMutationResult
  declineJoin: (
    input: DeclineGroupJoinInput,
    opts?: {
      actorBannedAt?: Date | null
      staffCanManageMembers?: boolean
    },
  ) =>
    | { ok: true; declined: GroupMemberRecord }
    | { ok: false; reason: GroupRefuseReason }
  getMembership: (groupId: string, userId: string) => GroupMemberRecord | null
  getGroup: (groupId: string) => GroupRecord | null
  getCategory: (categoryId: string) => GroupCategoryRecord | null
  getRank: (rankId: string) => GroupRankRecord | null
  wallPost: (input: CreateGroupWallPostInput) => PostMutationResult
  activeMemberGroupIds: (userId: string) => Set<string>
  createRank: (input: CreateGroupRankInput) => GroupRankMutationResult
  assignRank: (input: AssignGroupRankInput) => GroupMemberToolsResult
  setMemberRole: (input: SetGroupMemberRoleInput) => GroupMemberToolsResult
  removeMember: (
    input: RemoveGroupMemberInput,
  ) =>
    | { ok: true; removed: GroupMemberRecord }
    | { ok: false; reason: GroupRefuseReason }
  addDocument: (input: AddGroupDocumentInput) => GroupDocumentMutationResult
  announcePost: (input: AnnounceGroupPostInput) => GroupAnnounceResult
  announcePostWithMail: (
    input: AnnounceGroupPostInput,
    emitMail: (post: PostRecord) => Promise<void>,
  ) => Promise<GroupAnnounceResult>
  setFormDefinition: (
    input: SetGroupFormDefinitionInput,
  ) =>
    | { ok: true; group: GroupRecord }
    | { ok: false; reason: GroupRefuseReason }
  transfer: (input: TransferGroupInput) => GroupTransferResult
  deleteGroup: (input: DeleteGroupInput) => GroupDeleteResult
} {
  const bag: GroupBag = {
    categories: new Map(),
    groups: new Map(),
    members: new Map(),
    posts: new Map(),
    ranks: new Map(),
    documents: new Map(),
  }
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())
  const resolveMedia = opts?.resolveMedia ?? (() => true)

  function getMembership(groupId: string, userId: string): GroupMemberRecord | null {
    return bag.members.get(memberKey(groupId.trim(), userId.trim())) ?? null
  }

  function getCategoryForGroup(group: GroupRecord | null): GroupCategoryRecord | null {
    if (!group) return null
    return bag.categories.get(group.categoryId) ?? null
  }

  function actorRank(membership: GroupMemberRecord | null): GroupRankRecord | null {
    if (!membership?.rankId) return null
    return bag.ranks.get(membership.rankId) ?? null
  }

  return {
    bag,
    createCategory: (input) => {
      const slug = (input.slug?.trim() || slugifyGroupLabel(input.name)).trim()
      const slugTaken = [...bag.categories.values()].some((row) => row.slug === slug)
      const decision = decideCreateGroupCategory(input, {
        now: now(),
        newId,
        slugTaken,
      })
      if (!decision.ok) return decision
      bag.categories.set(decision.category.id, decision.category)
      return decision
    },
    createGroup: (input) => {
      const slug = (input.slug?.trim() || slugifyGroupLabel(input.name)).trim()
      const slugTaken = [...bag.groups.values()].some((row) => row.slug === slug)
      const categoryExists = bag.categories.has(input.categoryId.trim())
      const decision = decideCreateGroup(input, {
        now: now(),
        newId,
        categoryExists,
        slugTaken,
      })
      if (!decision.ok) return decision
      bag.groups.set(decision.group.id, decision.group)
      bag.members.set(
        memberKey(decision.ownerMembership.groupId, decision.ownerMembership.userId),
        decision.ownerMembership,
      )
      return decision
    },
    join: (groupId, actorUserId) => {
      const group = bag.groups.get(groupId.trim()) ?? null
      const current = getMembership(groupId, actorUserId)
      const decision = decideJoinGroup(group, current, actorUserId, {
        now: now(),
        newId,
      })
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    invite: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const current = getMembership(input.groupId, input.inviteeUserId)
      const decision = decideInviteToGroup(
        group,
        actorMembership,
        current,
        input,
        { now: now(), newId },
      )
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    acceptInvite: (groupId, actorUserId) => {
      const group = bag.groups.get(groupId.trim()) ?? null
      const current = getMembership(groupId, actorUserId)
      const decision = decideAcceptGroupInvite(group, current, actorUserId, {
        now: now(),
      })
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    approveJoin: (input, opts) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const decision = decideApproveGroupJoinRequest(
        group,
        actorMembership,
        actorRank(actorMembership),
        getMembership(input.groupId, input.targetUserId),
        input,
        {
          now: now(),
          actorBannedAt: opts?.actorBannedAt,
          activeMemberCount:
            opts?.activeMemberCount ??
            [...bag.members.values()].filter(
              (row) => row.groupId === input.groupId.trim() && row.status === 'active',
            ).length,
          maxGroupMembers: opts?.maxGroupMembers,
          staffCanManageMembers: opts?.staffCanManageMembers,
        },
      )
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    declineJoin: (input, opts) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const decision = decideDeclineGroupJoinRequest(
        group,
        actorMembership,
        actorRank(actorMembership),
        getMembership(input.groupId, input.targetUserId),
        input,
        {
          actorBannedAt: opts?.actorBannedAt,
          staffCanManageMembers: opts?.staffCanManageMembers,
        },
      )
      if (!decision.ok) return decision
      bag.members.delete(memberKey(decision.declined.groupId, decision.declined.userId))
      return decision
    },
    getMembership,
    getGroup: (groupId) => bag.groups.get(groupId.trim()) ?? null,
    getCategory: (categoryId) => bag.categories.get(categoryId.trim()) ?? null,
    getRank: (rankId) => bag.ranks.get(rankId.trim()) ?? null,
    wallPost: (input) => {
      const membership = getMembership(input.groupId, input.authorUserId)
      const decision = createGroupWallPost(membership, input, {
        now: now(),
        newId,
      })
      if (!decision.ok) return decision
      bag.posts.set(decision.post.id, decision.post)
      return decision
    },
    activeMemberGroupIds: (userId) => {
      const id = userId.trim()
      const out = new Set<string>()
      for (const row of bag.members.values()) {
        if (row.userId === id && row.status === 'active') out.add(row.groupId)
      }
      return out
    },
    createRank: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const decision = decideCreateGroupRank(
        group,
        getCategoryForGroup(group),
        getMembership(input.groupId, input.actorUserId),
        input,
        { now: now(), newId },
      )
      if (!decision.ok) return decision
      bag.ranks.set(decision.rank.id, decision.rank)
      return decision
    },
    assignRank: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const rankId = input.rankId?.trim() || null
      const decision = decideAssignGroupRank(
        group,
        getCategoryForGroup(group),
        getMembership(input.groupId, input.actorUserId),
        getMembership(input.groupId, input.targetUserId),
        rankId ? (bag.ranks.get(rankId) ?? null) : null,
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    setMemberRole: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const decision = decideSetGroupMemberRole(
        group,
        getMembership(input.groupId, input.actorUserId),
        getMembership(input.groupId, input.targetUserId),
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.members.set(
        memberKey(decision.membership.groupId, decision.membership.userId),
        decision.membership,
      )
      return decision
    },
    removeMember: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const decision = decideRemoveGroupMember(
        group,
        getCategoryForGroup(group),
        actorMembership,
        actorRank(actorMembership),
        getMembership(input.groupId, input.targetUserId),
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.members.delete(memberKey(decision.removed.groupId, decision.removed.userId))
      return decision
    },
    addDocument: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const decision = decideAddGroupDocument(
        group,
        getCategoryForGroup(group),
        actorMembership,
        actorRank(actorMembership),
        input,
        {
          now: now(),
          newId,
          mediaExists: resolveMedia(input.mediaId),
        },
      )
      if (!decision.ok) return decision
      bag.documents.set(decision.document.id, decision.document)
      return decision
    },
    announcePost: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const actorMembership = getMembership(input.groupId, input.actorUserId)
      const post = bag.posts.get(input.postId.trim()) ?? null
      const decision = decideAnnounceGroupPost(
        group,
        getCategoryForGroup(group),
        actorMembership,
        actorRank(actorMembership),
        post,
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.posts.set(decision.post.id, decision.post)
      return decision
    },
    announcePostWithMail: async (input, emitMail) =>
      announceGroupPostWithMail(() => {
        const group = bag.groups.get(input.groupId.trim()) ?? null
        const actorMembership = getMembership(input.groupId, input.actorUserId)
        const post = bag.posts.get(input.postId.trim()) ?? null
        const decision = decideAnnounceGroupPost(
          group,
          getCategoryForGroup(group),
          actorMembership,
          actorRank(actorMembership),
          post,
          input,
          { now: now() },
        )
        if (!decision.ok) return decision
        bag.posts.set(decision.post.id, decision.post)
        return decision
      }, emitMail),
    setFormDefinition: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const decision = decideSetGroupFormDefinition(
        group,
        getMembership(input.groupId, input.actorUserId),
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.groups.set(decision.group.id, decision.group)
      return decision
    },
    transfer: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const decision = decideTransferGroup(
        group,
        getMembership(input.groupId, input.actorUserId),
        getMembership(input.groupId, input.newOwnerUserId),
        input,
        { now: now() },
      )
      if (!decision.ok) return decision
      bag.groups.set(decision.group.id, decision.group)
      bag.members.set(
        memberKey(decision.previousOwner.groupId, decision.previousOwner.userId),
        decision.previousOwner,
      )
      bag.members.set(
        memberKey(decision.newOwner.groupId, decision.newOwner.userId),
        decision.newOwner,
      )
      return decision
    },
    deleteGroup: (input) => {
      const group = bag.groups.get(input.groupId.trim()) ?? null
      const decision = decideDeleteGroup(
        group,
        getMembership(input.groupId, input.actorUserId),
        input,
      )
      if (!decision.ok) return decision
      const gid = decision.groupId
      bag.groups.delete(gid)
      for (const [key, row] of bag.members) {
        if (row.groupId === gid) bag.members.delete(key)
      }
      for (const [id, row] of bag.ranks) {
        if (row.groupId === gid) bag.ranks.delete(id)
      }
      for (const [id, row] of bag.documents) {
        if (row.groupId === gid) bag.documents.delete(id)
      }
      for (const [id, row] of bag.posts) {
        if (row.groupId === gid) bag.posts.delete(id)
      }
      return decision
    },
  }
}
