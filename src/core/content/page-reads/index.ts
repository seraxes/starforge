/**
 * PageReadsPort — Core port for the four layout-host page reads (slice 9).
 *
 * Methods: published by slug, draft preview, search list, sitemap summaries
 * (Nav page-link slug resolve shares the sitemap summary list).
 *
 * Payload stays the content manager. This port makes those reads swappable later.
 * It does not add a second CMS or change `/cms` editorial UI.
 *
 * Remaining `getPayload()` callers (not moved in this slice — stop here):
 * - `src/core/media/*` — library, resolve, ingest, form-upload, category-store
 * - `src/core/settings/index.ts` — site settings global
 * - `src/core/nav/store.ts` — admin page-bind picker, seed / migrate helpers
 * - `src/core/cms-bridge/*` — session + user bridge (`index`, `payload-session`)
 * - `src/app/api/cms/exchange/route.ts` — CMS exchange
 * - `src/seed.ts` — seed script
 */

import 'server-only'

import { createPayloadPageReads } from './payload'
import type { PageReadsPort } from './types'

export type {
  PageReadsPort,
  PageReadsPublishedSummary,
  PageReadsSearchDoc,
  PageReadsSearchResult,
} from './types'
export { createPayloadPageReads } from './payload'

type PortGlobal = typeof globalThis & {
  __starforgePageReads?: PageReadsPort
}

/**
 * Active PageReadsPort.
 * Payload adapter today — swap when another content-manager pack is chosen.
 */
export function getPageReads(): PageReadsPort {
  const g = globalThis as PortGlobal
  if (!g.__starforgePageReads) {
    g.__starforgePageReads = createPayloadPageReads()
  }
  return g.__starforgePageReads
}

/** Test helper — drop the resolved singleton. */
export function resetPageReadsForTests(): void {
  const g = globalThis as PortGlobal
  delete g.__starforgePageReads
}
