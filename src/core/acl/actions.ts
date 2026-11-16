'use server'

import {
  USER_GROUP_ADD_ACTION,
  USER_GROUP_REMOVE_ACTION,
  USER_GROUPS_ACTION,
  recordAdminAudit,
} from '@/core/audit'
import { requireAppAdmin } from '@/core/auth/admin'
// Client components import this module for server actions only — keep free of session/headers.
//
// Do not call `revalidatePath` from these `useActionState` handlers.
// Same hang as Localization / Site Chrome offline: path revalidation (especially
// `/` or layout) rebuilds the public tree in the same action response and can
// wedge Turbopack until restart. Clients already `router.refresh()` / `push` on ok.

import { isAclGrantLevel, type AclGrantLevel } from './levels'
import {
  createUserGroup,
  deleteUserGroup,
  renameUserGroup,
} from './groups'
import {
  addUserToGroup,
  removeUserFromGroup,
  setUserGroups,
} from './members'
import { getGroupAclMatrix, replaceGroupAclLevels } from './permissions'
import { isAclAdminResourceKey, type AclPermissionRow } from './types'

export type AclActionState = {
  error?: string
  ok?: boolean
  message?: string
  groupId?: string
}

async function requireActorId(): Promise<string | null> {
  const admin = await requireAppAdmin()
  const id = admin?.user?.id?.trim()
  return id || null
}

async function auditGroup(actorId: string, action: string, groupId: string) {
  try {
    await recordAdminAudit({
      actorId,
      action,
      target: { type: 'group', id: groupId },
    })
  } catch {
    console.error('[audit] group row skipped')
  }
}

async function auditAclDiff(
  actorId: string,
  groupId: string,
  before: AclPermissionRow[],
  after: AclPermissionRow[],
) {
  const prior = new Map(before.map((row) => [row.resource, row.level]))
  for (const row of after) {
    if ((prior.get(row.resource) ?? null) === row.level) continue
    const action = row.level ? `acl.${row.level}` : 'acl.none'
    try {
      await recordAdminAudit({
        actorId,
        action,
        target: { type: 'acl', id: `${groupId}.${row.resource}` },
      })
    } catch {
      console.error('[audit] acl row skipped')
    }
  }
}

function parseGrant(raw: string): {
  groupId: string
  resource: string
  level: AclGrantLevel
} | null {
  const parts = raw.split('::')
  if (parts.length !== 3) return null
  const groupId = parts[0]?.trim() ?? ''
  const resource = parts[1]?.trim() ?? ''
  const level = parts[2]?.trim() ?? ''
  if (!groupId || !isAclAdminResourceKey(resource) || !isAclGrantLevel(level)) return null
  return { groupId, resource, level }
}

export async function createUserGroupAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const label = String(formData.get('label') ?? '')
  const id = String(formData.get('id') ?? '')
  const description = String(formData.get('description') ?? '')
  const parentId = String(formData.get('parentId') ?? '').trim() || null
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await createUserGroup({ label, id, description, parentId })
  if ('error' in result) return { error: result.error }
  await auditGroup(actorId, 'group.create', result.group.id)

  return {
    ok: true,
    message: `Group “${result.group.label}” created.`,
    groupId: openAfter ? result.group.id : undefined,
  }
}

export async function renameUserGroupAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const id = String(formData.get('groupId') ?? '').trim()
  const label = String(formData.get('label') ?? '')
  const descriptionRaw = formData.get('description')
  const description =
    descriptionRaw == null ? undefined : String(descriptionRaw)
  const parentRaw = formData.get('parentId')
  const parentId =
    parentRaw == null ? undefined : String(parentRaw).trim() || null

  const result = await renameUserGroup(id, label, description, parentId)
  if ('error' in result) return { error: result.error }
  await auditGroup(actorId, 'group.rename', id)

  return { ok: true, message: `Group “${result.group.label}” updated.`, groupId: id }
}

export async function deleteUserGroupAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const id = String(formData.get('groupId') ?? '').trim()
  const result = await deleteUserGroup(id)
  if ('error' in result) return { error: result.error }
  await auditGroup(actorId, 'group.delete', id)

  return { ok: true, message: `Group “${id}” deleted.` }
}

export async function addGroupMemberAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const result = await addUserToGroup(groupId, userId)
  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId,
    action: USER_GROUP_ADD_ACTION,
    target: { type: 'user', id: userId },
  })

  return { ok: true, message: 'Member added.', groupId }
}

export async function removeGroupMemberAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const result = await removeUserFromGroup(groupId, userId)
  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId,
    action: USER_GROUP_REMOVE_ACTION,
    target: { type: 'user', id: userId },
  })

  return { ok: true, message: 'Member removed.', groupId }
}

export async function setUserGroupsAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const groupIds = formData.getAll('groupId').map((v) => String(v ?? ''))
  const result = await setUserGroups(userId, groupIds)
  if ('error' in result) return { error: result.error }

  await recordAdminAudit({
    actorId,
    action: USER_GROUPS_ACTION,
    target: { type: 'user', id: userId },
  })

  return { ok: true, message: 'Groups updated.' }
}

export async function saveGroupAclMatrixAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage ACL.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const levels = new Map<string, AclGrantLevel | null>()
  for (const raw of formData.getAll('grant').map((v) => String(v ?? ''))) {
    const parsed = parseGrant(raw)
    if (!parsed || parsed.groupId !== groupId) continue
    levels.set(parsed.resource, parsed.level)
  }

  const before = await getGroupAclMatrix(groupId)
  const result = await replaceGroupAclLevels(groupId, levels)
  if ('error' in result) return { error: result.error }
  await auditAclDiff(actorId, groupId, before, await getGroupAclMatrix(groupId))

  return { ok: true, message: 'ACL matrix saved.', groupId }
}

/**
 * Save admin ACL for all groups from the Users → ACL matrix page.
 * Select values are `groupId::resourceKey::level`. Missing selects are none.
 */
export async function saveAllGroupsAclMatrixAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  const actorId = await requireActorId()
  if (!actorId) {
    return { error: 'Sign in as a Starforge app admin to manage ACL.' }
  }

  const groupIds = formData
    .getAll('matrixGroupId')
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)

  const levelsByGroup = new Map<string, Map<string, AclGrantLevel | null>>()
  for (const id of groupIds) levelsByGroup.set(id, new Map())

  for (const raw of formData.getAll('grant').map((v) => String(v ?? ''))) {
    const parsed = parseGrant(raw)
    if (!parsed || !levelsByGroup.has(parsed.groupId)) continue
    levelsByGroup.get(parsed.groupId)?.set(parsed.resource, parsed.level)
  }

  for (const [groupId, levels] of levelsByGroup) {
    const before = await getGroupAclMatrix(groupId)
    const result = await replaceGroupAclLevels(groupId, levels)
    if ('error' in result) return { error: result.error }
    await auditAclDiff(actorId, groupId, before, await getGroupAclMatrix(groupId))
  }

  return { ok: true, message: 'ACL matrix saved.' }
}
