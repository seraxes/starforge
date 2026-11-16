/**
 * PageReadsPort — Core port for the four layout-host page reads (slice 9).
 *
 * Methods: published by slug, draft preview, search list, sitemap summaries
 * (Nav page-link slug resolve shares the sitemap summary list).
 *
 * When `product:pages` is enabled, these four reads use that pack’s public
 * door. When the pack is off, the reads are empty. Editorial sites enable
 * the pack. There is no Payload fallback.
 */

import 'server-only'

import { loadPagesPackDoor } from '@/core/content/pages-pack-door'

import type { PageReadsPort } from './types'

export type {
  PageReadsPort,
  PageReadsPublishedSummary,
  PageReadsSearchDoc,
  PageReadsSearchResult,
} from './types'

/** Bump when the port factory changes so a dev reload drops a stale singleton. */
const PAGE_READS_VERSION = 3

type PortGlobal = typeof globalThis & {
  __starforgePageReads?: PageReadsPort
  __starforgePageReadsVersion?: number
}

const emptyPageReads: PageReadsPort = {
  async findPublishedBySlug() {
    return null
  },
  async findDraftBySlug() {
    return null
  },
  async searchPublished() {
    return { docs: [], totalDocs: 0 }
  },
  async listPublishedSummaries() {
    return []
  },
}

/**
 * Active PageReadsPort.
 * Each read uses the pages pack when that module is enabled.
 */
function createSwitchingPageReads(): PageReadsPort {
  return {
    async findPublishedBySlug(slug, locale) {
      const door = await loadPagesPackDoor()
      if (!door) return null
      return door.createPagesPageReads().findPublishedBySlug(slug, locale)
    },
    async findDraftBySlug(slug, locale) {
      const door = await loadPagesPackDoor()
      if (!door) return null
      return door.createPagesPageReads().findDraftBySlug(slug, locale)
    },
    async searchPublished(query, locale, options) {
      const door = await loadPagesPackDoor()
      if (!door) return { docs: [], totalDocs: 0 }
      return door.createPagesPageReads().searchPublished(query, locale, options)
    },
    async listPublishedSummaries() {
      const door = await loadPagesPackDoor()
      if (!door) return []
      return door.createPagesPageReads().listPublishedSummaries()
    },
  }
}

export function getPageReads(): PageReadsPort {
  const g = globalThis as PortGlobal
  if (!g.__starforgePageReads || g.__starforgePageReadsVersion !== PAGE_READS_VERSION) {
    g.__starforgePageReads = createSwitchingPageReads()
    g.__starforgePageReadsVersion = PAGE_READS_VERSION
  }
  return g.__starforgePageReads
}

/** Test helper — drop the resolved singleton. */
export function resetPageReadsForTests(): void {
  const g = globalThis as PortGlobal
  delete g.__starforgePageReads
  delete g.__starforgePageReadsVersion
}

export { emptyPageReads }
