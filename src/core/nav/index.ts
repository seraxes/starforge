export {
  createNavMenuAction,
  renameNavMenuAction,
  duplicateNavMenuAction,
  deleteNavMenuAction,
  saveNavMenuItemsAction,
  moveNavMenuItemAction,
  addNavMenuItemAction,
  pasteNavMenuItemAction,
  listNavOutlineAssignmentsAction,
  toggleNavItemOutlineAssignmentAction,
} from './actions'
export type { NavActionState } from './actions'

export {
  emptyNavMenuDocument,
  createNavMenuItem,
  cloneNavMenuItem,
  flattenNavItemsInOrder,
  moveNavItemAmongSiblings,
  normalizeNavMenuDocument,
  normalizeNavMenuItem,
  parseNavMenuDocumentJson,
  serializeNavMenuDocument,
  slugifyNavMenuId,
} from './document'

export {
  listEnabledModuleNavOptions,
  resolveModuleNavHref,
} from './module-views'

export {
  findNavOverridesForPath,
  resolveLegacyPrimaryNav,
  resolveNavMenuItems,
} from './resolve'
export type { ResolvedNavItem } from './resolve'
export {
  pageKeyForNavItem,
  syncNavItemOutlineToPageChrome,
  syncNavMenuOutlinesToPageChrome,
  clearNavItemOutlineFromPageChrome,
  listNavOutlineAssignmentTree,
  setNavItemOutlineAssignment,
} from './outline-assign'
export {
  createNavMenu,
  deleteNavMenu,
  duplicateNavMenu,
  ensureDefaultNavMenuSeeded,
  getCachedNavMenu,
  listNavMenus,
  listNavPageOptions,
  loadNavMenu,
  migrateLegacyPrimaryNavToMain,
  renameNavMenu,
  replaceNavMenuItems,
  reorderNavMenuItem,
  seedMainNavFromPages,
  saveNavMenuDocument,
} from './store'

export type {
  NavAccessLevel,
  NavLinkType,
  NavMenuDocument,
  NavMenuItem,
  NavMenuMeta,
  NavModuleOption,
  NavModuleViewOption,
  NavOutlineAssignmentItem,
  NavOutlineAssignmentMenu,
  NavPageOption,
} from './types'

export { DEFAULT_NAV_MENU_ID } from '@/core/db'
