/**
 * product:pages client door.
 * Server reads and writes: `@/modules/pages/api.server`.
 */

export type {
  NavPageBind,
  PageListFilters,
  PageListSort,
  PageLocaleMaps,
  PageVersionLocales,
  PageVersionRecord,
  PageRecord,
  PageStatus,
  PageTagRecord,
  PagesAdminActionState,
  SavePageInput,
} from './types'
export { isPageStatus, PAGE_VERSION_KEEP } from './types'
