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
  ROLE_ADMIN_ACCESS_TAG,
  accessTagsForStorage,
  canSeeNavAccessLevel,
  canSeeNavAccessTags,
  filterNavItemsForViewer,
  isAdminNavRestrictTag,
  normalizeAccessTag,
  normalizeAccessTags,
  resolveAccessTags,
  toggleAccessTag,
} from './nav-access'

/** Session-bound checks — server-only (`import 'server-only'`). */
export {
  getAccessViewer,
  getAdminAccessViewer,
  listViewerAllowedAdminResources,
  requireAdminArea,
  requireAdminAreaForRequest,
  viewerMayAccessAdminResource,
  viewerMayEnterAdminShell,
} from './access'

/** Pure ACL decision helpers — safe for unit tests / shared graphs. */
export {
  adminAreaGateForPath,
  adminHrefAllowed,
  adminResourcesForHref,
  decideAdminResourceAccess,
  decideAdminShellAccess,
  firstAdminLandingPath,
  viewerAllowsGate,
} from './decide'
export type { AdminAreaGate } from './decide'

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
  ensureManagersDashboardAcl,
  ensureManagersLocalizationAcl,
  expandGroupIdsWithAncestors,
  getUserGroup,
  listGroupParentMap,
  listUserGroupOptions,
  listUserGroups,
  MAX_GROUP_DEPTH,
  renameUserGroup,
} from './groups'
export {
  depthUnderParent,
  groupDepth,
  maxRelativeSubtreeDepth,
  orderGroupsAsTree,
  wouldCreateCycle,
} from './hierarchy'
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
  listAllowedResourcesForGroups,
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
