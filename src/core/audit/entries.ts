/**
 * Pure admin-audit keys. Callers pass these into `recordAdminAudit`.
 * Never include passwords, session tokens, two-factor secrets, env values,
 * or merchant payment keys. The environment entry is a fixed fact of a save.
 */

export type AdminAuditTarget = {
  type: string
  id: string
}

export type AdminAuditInput = {
  actorId: string
  action: string
  target: AdminAuditTarget
}

export type NormalizedAdminAudit = {
  actorId: string
  action: string
  targetType: string
  targetId: string
}

const ACTION_RE = /^[a-z][a-z0-9.-]{1,80}$/
const TYPE_RE = /^[a-z][a-z-]{1,31}$/
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9:._@+-]{0,199}$/
const FORBIDDEN =
  /password|secret|token|credential|private|api[_-]?key|begin |cvv|pan\b/i

function clean(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!pattern.test(trimmed)) return null
  if (FORBIDDEN.test(trimmed)) return null
  if (/[\s="'\\]/.test(trimmed)) return null
  return trimmed
}

/** Rejects dumps, secrets, and free text. Throws a message that does not echo the value. */
export function normalizeAdminAuditInput(input: AdminAuditInput): NormalizedAdminAudit {
  const actorId = clean(input?.actorId, ID_RE)
  const action = clean(input?.action, ACTION_RE)
  const targetType = clean(input?.target?.type, TYPE_RE)
  const targetId = clean(input?.target?.id, ID_RE)
  if (!actorId || !action || !targetType || !targetId) {
    throw new Error('Invalid admin audit record.')
  }
  return { actorId, action, targetType, targetId }
}

export function userRoleAction(role: string): 'user.role.admin' | 'user.role.member' | null {
  if (role === 'admin') return 'user.role.admin'
  if (role === 'member') return 'user.role.member'
  return null
}

export function userDisabledAction(disabled: boolean): 'user.disable' | 'user.enable' {
  return disabled ? 'user.disable' : 'user.enable'
}

export function userCmsAction(enabled: boolean): 'user.cms.on' | 'user.cms.off' {
  return enabled ? 'user.cms.on' : 'user.cms.off'
}

export const USER_GROUPS_ACTION = 'user.groups'
export const USER_GROUP_ADD_ACTION = 'user.group.add'
export const USER_GROUP_REMOVE_ACTION = 'user.group.remove'

export const REDIRECT_CREATE_ACTION = 'redirect.create'
export const REDIRECT_UPDATE_ACTION = 'redirect.update'
export const REDIRECT_DELETE_ACTION = 'redirect.delete'

export function moduleOnOffAudit(
  moduleId: string,
  enabled: boolean,
): { action: 'module.on' | 'module.off'; target: AdminAuditTarget } | null {
  const id = clean(moduleId, ID_RE)
  if (!id) return null
  return {
    action: enabled ? 'module.on' : 'module.off',
    target: { type: 'module', id },
  }
}

/**
 * One row per CSV import. The imported count is the action suffix and the target id.
 * Returns null when nothing was imported (the caller must not write a row).
 */
export function redirectImportAudit(imported: number): {
  action: string
  target: AdminAuditTarget
} | null {
  if (!Number.isInteger(imported) || imported < 1 || imported > 100_000) return null
  const count = String(imported)
  return {
    action: `redirect.import.${count}`,
    target: { type: 'redirect', id: count },
  }
}

/**
 * Environment editor save. Fixed action and target — no key names, no values.
 */
export function environmentSaveAudit(): {
  action: 'environment.save'
  target: { type: 'environment'; id: 'overlay' }
} {
  return {
    action: 'environment.save',
    target: { type: 'environment', id: 'overlay' },
  }
}
