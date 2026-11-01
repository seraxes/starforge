'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
// Client components import this module for server actions only — keep free of session/headers.

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
import { replaceGroupAclMatrix } from './permissions'
import { isAclAdminResourceKey } from './types'

export type AclActionState = {
  error?: string
  ok?: boolean
  message?: string
  groupId?: string
}

function revalidateUsersPaths(groupId?: string) {
  revalidatePath('/app/admin/users')
  revalidatePath('/app/admin/users/groups')
  if (groupId) {
    revalidatePath(`/app/admin/users/groups/${encodeURIComponent(groupId)}`)
  }
  // Nav editor group picker + public header may change after membership edits.
  revalidatePath('/app/admin/nav')
  revalidatePath('/')
}

export async function createUserGroupAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const label = String(formData.get('label') ?? '')
  const id = String(formData.get('id') ?? '')
  const description = String(formData.get('description') ?? '')
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await createUserGroup({ label, id, description })
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths(result.group.id)
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
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const id = String(formData.get('groupId') ?? '').trim()
  const label = String(formData.get('label') ?? '')
  const descriptionRaw = formData.get('description')
  const description =
    descriptionRaw == null ? undefined : String(descriptionRaw)

  const result = await renameUserGroup(id, label, description)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths(id)
  return { ok: true, message: `Group “${result.group.label}” updated.`, groupId: id }
}

export async function deleteUserGroupAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const id = String(formData.get('groupId') ?? '').trim()
  const result = await deleteUserGroup(id)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths()
  return { ok: true, message: `Group “${id}” deleted.` }
}

export async function addGroupMemberAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const result = await addUserToGroup(groupId, userId)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths(groupId)
  return { ok: true, message: 'Member added.', groupId }
}

export async function removeGroupMemberAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  const result = await removeUserFromGroup(groupId, userId)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths(groupId)
  return { ok: true, message: 'Member removed.', groupId }
}

export async function setUserGroupsAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage groups.' }
  }

  const userId = String(formData.get('userId') ?? '').trim()
  const groupIds = formData.getAll('groupId').map((v) => String(v ?? ''))
  const result = await setUserGroups(userId, groupIds)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths()
  return { ok: true, message: 'Groups updated.' }
}

export async function saveGroupAclMatrixAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage ACL.' }
  }

  const groupId = String(formData.get('groupId') ?? '').trim()
  const allowed = formData
    .getAll('resource')
    .map((v) => String(v ?? ''))
    .filter((r) => isAclAdminResourceKey(r))

  const result = await replaceGroupAclMatrix(groupId, allowed)
  if ('error' in result) return { error: result.error }

  revalidateUsersPaths(groupId)
  return { ok: true, message: 'ACL matrix saved (stub).', groupId }
}

/**
 * Save admin ACL stub for all groups from the Users → ACL matrix page.
 * Checkbox values are `groupId::resourceKey`.
 */
export async function saveAllGroupsAclMatrixAction(
  _prev: AclActionState,
  formData: FormData,
): Promise<AclActionState> {
  if (!(await requireAppAdmin())) {
    return { error: 'Sign in as a Starforge app admin to manage ACL.' }
  }

  const groupIds = formData
    .getAll('matrixGroupId')
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)

  const grants = formData.getAll('grant').map((v) => String(v ?? ''))
  const allowedByGroup = new Map<string, string[]>()
  for (const id of groupIds) allowedByGroup.set(id, [])

  for (const raw of grants) {
    const sep = raw.indexOf('::')
    if (sep <= 0) continue
    const groupId = raw.slice(0, sep).trim()
    const resource = raw.slice(sep + 2).trim()
    if (!groupId || !isAclAdminResourceKey(resource)) continue
    const list = allowedByGroup.get(groupId) ?? []
    list.push(resource)
    allowedByGroup.set(groupId, list)
  }

  for (const [groupId, resources] of allowedByGroup) {
    const result = await replaceGroupAclMatrix(groupId, resources)
    if ('error' in result) return { error: result.error }
  }

  revalidateUsersPaths()
  revalidatePath('/app/admin/users/acl')
  return { ok: true, message: 'ACL matrix saved (stub).' }
}
