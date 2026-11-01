/**
 * User groups + group-keyed ACL foundation (SF-41).
 *
 * **Client components** must import from:
 * - `@/core/acl/actions` (server actions)
 * - `@/core/acl/types` (types / constants)
 * - `@/core/acl/nav-access` (pure visibility helpers)
 *
 * Do **not** import this barrel from client components — it re-exports
 * server-only session helpers (`access.ts` → `next/headers`).
 */

/** Pure helpers — safe for shared server/client graphs when imported directly. */
export {
  accessTagsForStorage,
  canSeeNavAccessLevel,
  canSeeNavAccessTags,
  filterNavItemsForViewer,
  normalizeAccessTags,
  resolveAccessTags,
  toggleAccessTag,
} from './nav-access'

/** Session-bound checks — server-only (`import 'server-only'`). */
export { getAccessViewer, viewerMayAccessAdminResource } from './access'

export type { AccessViewer } from './types'
export {
  ACL_ADMIN_RESOURCES,
  ACL_ADMIN_RESOURCE_KEYS,
  isAclAdminResourceKey,
} from './types'
export type {
  AclAdminResourceKey,
  AclPermissionRow,
  UserGroup,
  UserGroupOption,
} from './types'
export { slugifyGroupId } from './slug'
export {
  createUserGroup,
  deleteUserGroup,
  ensureDefaultUserGroupsSeeded,
  getUserGroup,
  listUserGroupOptions,
  listUserGroups,
  renameUserGroup,
} from './groups'
export {
  addUserToGroup,
  listGroupIdsByUserIds,
  listGroupIdsForUser,
  listGroupMembers,
  removeUserFromGroup,
  setUserGroups,
} from './members'
export type { GroupMemberRow } from './members'
export {
  anyGroupAllowsResource,
  getGroupAclMatrix,
  replaceGroupAclMatrix,
  setGroupAclPermission,
} from './permissions'
export {
  addGroupMemberAction,
  createUserGroupAction,
  deleteUserGroupAction,
  removeGroupMemberAction,
  renameUserGroupAction,
  saveAllGroupsAclMatrixAction,
  saveGroupAclMatrixAction,
  setUserGroupsAction,
} from './actions'
export type { AclActionState } from './actions'
