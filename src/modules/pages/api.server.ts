/**
 * product:pages server door.
 *
 * Core reaches this through the generated `pages-api` door
 * (`loadModuleDoor`), not by importing the pack. That keeps the
 * module-boundary check free of a Core → pack edge.
 *
 *   import { createPagesPageReads, listNavPageOptions } from '@/modules/pages/api.server'
 */

import 'server-only'

export { createPagesPageReads } from './page-reads'
export {
  deletePage,
  findNavPageByLegacyId,
  findNavPageBySlug,
  findPageById,
  findPageBySlug,
  listNavPageOptions,
  listPages,
  loadPageLocaleMaps,
  savePage,
} from './store'
export type { NavPageBind, PageListSort, PageLocaleMaps, PageRecord, SavePageInput } from './types'
