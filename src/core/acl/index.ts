/**
 * User groups + group-keyed ACL foundation (SF-41).
 *
 * Groups live under Users admin. Nav `accessLevel: group:<id>` resolves
 * against membership. Admin-area ACL is a stub matrix stored in Core DB —
 * global app admins still gate `/app/admin` today.
 */

export {
  canSeeNavAccessLevel,
  filterNavItemsForViewer,
  getAccessViewer,
  viewerMayAccessAdminResource,
} from './access'
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
  saveGroupAclMatrixAction,
  setUserGroupsAction,
} from './actions'
export type { AclActionState } from './actions'
