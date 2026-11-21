/**
 * product:social team / association tools — ranks, documents, announcements,
 * formDefinitionId bind, remove / transfer / delete.
 *
 * Owner and admin are structural roles. A rank adds actions for a member.
 * A rank cannot remove, demote, or reassign the owner, and it cannot remove
 * an admin. Only the owner deletes or transfers the group. Ranks do not write
 * Core ACL. Calendar hosting lives on Events (`hostModule` / `hostKind` / `hostId`).
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import type {
  GroupCategoryKind,
  GroupCategoryRecord,
  GroupMemberRecord,
  GroupMemberRole,
  GroupRecord,
  GroupRefuseReason,
} from './groups'
import type { PostRecord } from './posts'

export type GroupRankRecord = {
  id: string
  groupId: string
  name: string
  sortOrder: number
  canAnnounce: boolean
  canManageDocuments: boolean
  canManageCalendar: boolean
  canManageMembers: boolean
  createdAt: Date
  updatedAt: Date
}

export type GroupDocumentRecord = {
  id: string
  groupId: string
  mediaId: string
  title: string
  addedByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type GroupToolsRefuseReason =
  | GroupRefuseReason
  | 'not_owner'
  | 'not_team_tools'
  | 'protected_member'
  | 'unknown_media'
  | 'rank_required'
  | 'not_allowed'

export type GroupRankMutationResult =
  | { ok: true; rank: GroupRankRecord }
  | { ok: false; reason: GroupToolsRefuseReason }

export type GroupDocumentMutationResult =
  | { ok: true; document: GroupDocumentRecord }
  | { ok: false; reason: GroupToolsRefuseReason }

export type GroupMemberToolsResult =
  | { ok: true; membership: GroupMemberRecord }
  | { ok: false; reason: GroupToolsRefuseReason }

export type GroupDeleteResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: GroupToolsRefuseReason }

export type GroupTransferResult =
  | { ok: true; group: GroupRecord; previousOwner: GroupMemberRecord; newOwner: GroupMemberRecord }
  | { ok: false; reason: GroupToolsRefuseReason }

export type GroupAnnounceResult =
  | { ok: true; post: PostRecord }
  | { ok: false; reason: GroupToolsRefuseReason }

export type CreateGroupRankInput = {
  groupId: string
  actorUserId: string
  name: string
  sortOrder?: number
  canAnnounce?: boolean
  canManageDocuments?: boolean
  canManageCalendar?: boolean
  canManageMembers?: boolean
}

export type AssignGroupRankInput = {
  groupId: string
  actorUserId: string
  targetUserId: string
  rankId: string | null
}

export type RemoveGroupMemberInput = {
  groupId: string
  actorUserId: string
  targetUserId: string
}

export type SetGroupMemberRoleInput = {
  groupId: string
  actorUserId: string
  targetUserId: string
  role: 'admin' | 'member'
}

export type AddGroupDocumentInput = {
  groupId: string
  actorUserId: string
  mediaId: string
  title?: string
}

export type AnnounceGroupPostInput = {
  groupId: string
  actorUserId: string
  postId: string
}

export type TransferGroupInput = {
  groupId: string
  actorUserId: string
  newOwnerUserId: string
  interact: CanInteractContext
}

export type DeleteGroupInput = {
  groupId: string
  actorUserId: string
}

export type SetGroupFormDefinitionInput = {
  groupId: string
  actorUserId: string
  formDefinitionId: string | null
}

export type GroupEffectivePermissions = {
  canAnnounce: boolean
  canManageDocuments: boolean
  canManageCalendar: boolean
  canManageMembers: boolean
  /** True when permission comes only from a rank (not owner/admin role). */
  membersViaRankOnly: boolean
  isOwner: boolean
  isAdmin: boolean
}

/** Team tools (ranks, docs, announcements) apply to team and association only. */
export function categorySupportsTeamTools(
  kind: GroupCategoryKind | string | null | undefined,
): boolean {
  return kind === 'team' || kind === 'association'
}

export function resolveGroupPermissions(
  membership: GroupMemberRecord | null | undefined,
  rank: GroupRankRecord | null | undefined,
): GroupEffectivePermissions {
  const active = membership?.status === 'active'
  const role = active ? membership!.role : null
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin'
  const structural = isOwner || isAdmin
  const rankOk =
    active && role === 'member' && rank && rank.groupId === membership!.groupId
      ? rank
      : null

  return {
    canAnnounce: structural || Boolean(rankOk?.canAnnounce),
    canManageDocuments: structural || Boolean(rankOk?.canManageDocuments),
    canManageCalendar: structural || Boolean(rankOk?.canManageCalendar),
    canManageMembers: structural || Boolean(rankOk?.canManageMembers),
    membersViaRankOnly: !structural && Boolean(rankOk?.canManageMembers),
    isOwner,
    isAdmin,
  }
}

function requireTeamTools(
  category: GroupCategoryRecord | null | undefined,
): GroupToolsRefuseReason | null {
  if (!category) return 'not_found'
  if (!categorySupportsTeamTools(category.kind)) return 'not_team_tools'
  return null
}

function requireActiveActor(
  membership: GroupMemberRecord | null | undefined,
  actorUserId: string,
): GroupToolsRefuseReason | null {
  const actor = actorUserId.trim()
  if (!actor) return 'invalid'
  if (!membership || membership.userId !== actor || membership.status !== 'active') {
    return 'not_member'
  }
  return null
}

/** Owner or admin may define ranks. */
export function decideCreateGroupRank(
  group: GroupRecord | null,
  category: GroupCategoryRecord | null,
  actorMembership: GroupMemberRecord | null,
  input: CreateGroupRankInput,
  opts?: { now?: Date; newId?: () => string },
): GroupRankMutationResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const teamGate = requireTeamTools(category)
  if (teamGate) return { ok: false, reason: teamGate }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  const perms = resolveGroupPermissions(actorMembership, null)
  if (!perms.isOwner && !perms.isAdmin) return { ok: false, reason: 'not_admin' }

  const name = input.name.trim()
  if (!name) return { ok: false, reason: 'invalid' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    rank: {
      id: newId(),
      groupId: group.id,
      name,
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
      canAnnounce: Boolean(input.canAnnounce),
      canManageDocuments: Boolean(input.canManageDocuments),
      canManageCalendar: Boolean(input.canManageCalendar),
      canManageMembers: Boolean(input.canManageMembers),
      createdAt: now,
      updatedAt: now,
    },
  }
}

/** Owner / admin assign a rank to an active member (not the owner). */
export function decideAssignGroupRank(
  group: GroupRecord | null,
  category: GroupCategoryRecord | null,
  actorMembership: GroupMemberRecord | null,
  targetMembership: GroupMemberRecord | null,
  rank: GroupRankRecord | null,
  input: AssignGroupRankInput,
  opts?: { now?: Date },
): GroupMemberToolsResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const teamGate = requireTeamTools(category)
  if (teamGate) return { ok: false, reason: teamGate }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  const perms = resolveGroupPermissions(actorMembership, null)
  if (!perms.isOwner && !perms.isAdmin) return { ok: false, reason: 'not_admin' }

  if (
    !targetMembership ||
    targetMembership.groupId !== group.id ||
    targetMembership.userId !== input.targetUserId.trim() ||
    targetMembership.status !== 'active'
  ) {
    return { ok: false, reason: 'not_member' }
  }
  if (targetMembership.role === 'owner') {
    return { ok: false, reason: 'protected_member' }
  }

  const rankId = input.rankId?.trim() || null
  if (rankId) {
    if (!rank || rank.id !== rankId || rank.groupId !== group.id) {
      return { ok: false, reason: 'not_found' }
    }
  }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    membership: {
      ...targetMembership,
      rankId,
      updatedAt: now,
    },
  }
}

/**
 * Remove an active member.
 * Owner may remove admin or member (not self).
 * Admin may remove members only.
 * Rank with canManageMembers may remove members only — never owner or admin.
 */
export function decideRemoveGroupMember(
  group: GroupRecord | null,
  category: GroupCategoryRecord | null,
  actorMembership: GroupMemberRecord | null,
  actorRank: GroupRankRecord | null,
  targetMembership: GroupMemberRecord | null,
  input: RemoveGroupMemberInput,
  opts?: { now?: Date },
):
  | { ok: true; removed: GroupMemberRecord }
  | { ok: false; reason: GroupToolsRefuseReason } {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const teamGate = requireTeamTools(category)
  if (teamGate) return { ok: false, reason: teamGate }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }

  const actor = input.actorUserId.trim()
  const target = input.targetUserId.trim()
  if (!target) return { ok: false, reason: 'invalid' }
  if (actor === target) return { ok: false, reason: 'self' }

  if (
    !targetMembership ||
    targetMembership.groupId !== group.id ||
    targetMembership.userId !== target ||
    targetMembership.status !== 'active'
  ) {
    return { ok: false, reason: 'not_member' }
  }

  const perms = resolveGroupPermissions(actorMembership, actorRank)
  if (!perms.canManageMembers) return { ok: false, reason: 'not_allowed' }

  if (targetMembership.role === 'owner') {
    return { ok: false, reason: 'protected_member' }
  }
  if (targetMembership.role === 'admin') {
    // Owner may remove an admin; rank (and admin peers) may not.
    if (!perms.isOwner) return { ok: false, reason: 'protected_member' }
  } else if (targetMembership.role !== 'member') {
    return { ok: false, reason: 'protected_member' }
  }

  void opts
  return { ok: true, removed: targetMembership }
}

/** Only the owner promotes / demotes admin (not via rank). */
export function decideSetGroupMemberRole(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  targetMembership: GroupMemberRecord | null,
  input: SetGroupMemberRoleInput,
  opts?: { now?: Date },
): GroupMemberToolsResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  if (actorMembership!.role !== 'owner') return { ok: false, reason: 'not_owner' }

  const target = input.targetUserId.trim()
  if (!target || target === input.actorUserId.trim()) return { ok: false, reason: 'self' }
  if (
    !targetMembership ||
    targetMembership.groupId !== group.id ||
    targetMembership.userId !== target ||
    targetMembership.status !== 'active'
  ) {
    return { ok: false, reason: 'not_member' }
  }
  if (targetMembership.role === 'owner') {
    return { ok: false, reason: 'protected_member' }
  }
  if (input.role !== 'admin' && input.role !== 'member') {
    return { ok: false, reason: 'invalid' }
  }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    membership: {
      ...targetMembership,
      role: input.role,
      // Admins do not keep a member rank.
      rankId: input.role === 'admin' ? null : targetMembership.rankId,
      updatedAt: now,
    },
  }
}

/** Documents through Media — file stays in product:media. */
export function decideAddGroupDocument(
  group: GroupRecord | null,
  category: GroupCategoryRecord | null,
  actorMembership: GroupMemberRecord | null,
  actorRank: GroupRankRecord | null,
  input: AddGroupDocumentInput,
  opts?: {
    now?: Date
    newId?: () => string
    mediaExists?: boolean
    /** Pack allowGroupDocuments. Default true. */
    allowGroupDocuments?: boolean
  },
): GroupDocumentMutationResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  if (opts?.allowGroupDocuments === false) return { ok: false, reason: 'disabled' }
  const teamGate = requireTeamTools(category)
  if (teamGate) return { ok: false, reason: teamGate }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  const perms = resolveGroupPermissions(actorMembership, actorRank)
  if (!perms.canManageDocuments) return { ok: false, reason: 'not_allowed' }

  const mediaId = input.mediaId.trim()
  if (!mediaId) return { ok: false, reason: 'invalid' }
  if (opts?.mediaExists === false) return { ok: false, reason: 'unknown_media' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const title = (input.title ?? '').trim() || mediaId
  return {
    ok: true,
    document: {
      id: newId(),
      groupId: group.id,
      mediaId,
      title,
      addedByUserId: input.actorUserId.trim(),
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Mark a group wall post as an announcement (pinned).
 * Caller emits product:social/group.announced after persist (soft-fail).
 */
export function decideAnnounceGroupPost(
  group: GroupRecord | null,
  category: GroupCategoryRecord | null,
  actorMembership: GroupMemberRecord | null,
  actorRank: GroupRankRecord | null,
  post: PostRecord | null,
  input: AnnounceGroupPostInput,
  opts?: {
    now?: Date
    /** Pack allowGroupAnnouncements. Default true. */
    allowGroupAnnouncements?: boolean
  },
): GroupAnnounceResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  if (opts?.allowGroupAnnouncements === false) return { ok: false, reason: 'disabled' }
  const teamGate = requireTeamTools(category)
  if (teamGate) return { ok: false, reason: teamGate }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  const perms = resolveGroupPermissions(actorMembership, actorRank)
  if (!perms.canAnnounce) return { ok: false, reason: 'not_allowed' }

  if (!post || post.id !== input.postId.trim()) return { ok: false, reason: 'not_found' }
  if (post.groupId !== group.id || post.audience !== 'group') {
    return { ok: false, reason: 'invalid' }
  }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...post,
      isAnnouncement: true,
      updatedAt: now,
    },
  }
}

/** Owner / admin may bind Forms join definition (closed groups). */
export function decideSetGroupFormDefinition(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  input: SetGroupFormDefinitionInput,
  opts?: {
    now?: Date
    /** Pack allowGroupJoinForm. Default true. */
    allowGroupJoinForm?: boolean
  },
):
  | { ok: true; group: GroupRecord }
  | { ok: false; reason: GroupToolsRefuseReason } {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  if (opts?.allowGroupJoinForm === false) return { ok: false, reason: 'disabled' }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  const perms = resolveGroupPermissions(actorMembership, null)
  if (!perms.isOwner && !perms.isAdmin) return { ok: false, reason: 'not_admin' }

  const now = opts?.now ?? new Date()
  const formDefinitionId = input.formDefinitionId?.trim() || null
  return {
    ok: true,
    group: {
      ...group,
      formDefinitionId,
      updatedAt: now,
    },
  }
}

/**
 * Only the owner transfers ownership. Calls canInteract — blocked / hidden /
 * banned refuse (blocked-user case for this slice).
 */
export function decideTransferGroup(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  newOwnerMembership: GroupMemberRecord | null,
  input: TransferGroupInput,
  opts?: { now?: Date },
): GroupTransferResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  if (actorMembership!.role !== 'owner') return { ok: false, reason: 'not_owner' }

  const actor = input.actorUserId.trim()
  const nextOwner = input.newOwnerUserId.trim()
  if (!nextOwner) return { ok: false, reason: 'invalid' }
  if (actor === nextOwner) return { ok: false, reason: 'self' }

  if (isSocialBanned(input.interact.actorBannedAt) || isSocialBanned(input.interact.otherBannedAt)) {
    return { ok: false, reason: 'banned' }
  }
  if (!canInteract(actor, nextOwner, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  if (
    !newOwnerMembership ||
    newOwnerMembership.groupId !== group.id ||
    newOwnerMembership.userId !== nextOwner ||
    newOwnerMembership.status !== 'active'
  ) {
    return { ok: false, reason: 'not_member' }
  }

  const now = opts?.now ?? new Date()
  const previousOwner: GroupMemberRecord = {
    ...actorMembership!,
    role: 'admin',
    rankId: null,
    updatedAt: now,
  }
  const newOwner: GroupMemberRecord = {
    ...newOwnerMembership,
    role: 'owner',
    rankId: null,
    updatedAt: now,
  }
  return {
    ok: true,
    group: {
      ...group,
      ownerUserId: nextOwner,
      updatedAt: now,
    },
    previousOwner,
    newOwner,
  }
}

/** Only the owner deletes the group. */
export function decideDeleteGroup(
  group: GroupRecord | null,
  actorMembership: GroupMemberRecord | null,
  input: DeleteGroupInput,
): GroupDeleteResult {
  if (!group || group.id !== input.groupId.trim()) return { ok: false, reason: 'not_found' }
  const actorGate = requireActiveActor(actorMembership, input.actorUserId)
  if (actorGate) return { ok: false, reason: actorGate }
  if (actorMembership!.role !== 'owner') return { ok: false, reason: 'not_owner' }
  return { ok: true, groupId: group.id }
}

/**
 * Persist announce then emit mail. Mail failure does not roll back the pin.
 */
export async function announceGroupPostWithMail(
  persist: () => Promise<GroupAnnounceResult> | GroupAnnounceResult,
  emitMail: (post: PostRecord) => Promise<void>,
): Promise<GroupAnnounceResult> {
  const result = await persist()
  if (!result.ok) return result
  try {
    await emitMail(result.post)
  } catch {
    // Soft-fail — the announcement pin must stay.
  }
  return result
}

export type GroupMemberRoleWithRank = GroupMemberRole

/** Ensure GroupMemberRecord carries optional rankId (slice 14). */
export function withMemberRankId(
  row: Omit<GroupMemberRecord, 'rankId'> & { rankId?: string | null },
): GroupMemberRecord {
  return {
    ...row,
    rankId: row.rankId ?? null,
  }
}
