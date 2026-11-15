import type { SectionsLayoutMode } from './types'

/**
 * Identity of the public surround painted for one URL.
 * Client navigations compare this so a reused locale shell is refreshed
 * when the next page is a different outline or sections width.
 */
export type PublicShellKey = {
  /** Outline document id (`data-sf-layout-id`), or `minimal` when Layouts is off. */
  layoutId: string
  /** Body class outline (`sf-outline-*`). */
  outlineId: string
  sectionsLayout: SectionsLayoutMode
}

export function normalizePublicPath(path: string): string {
  const bare = (path.split('?')[0]?.split('#')[0] ?? '').trim()
  if (!bare) return '/'
  const withSlash = bare.startsWith('/') ? bare : `/${bare}`
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1)
  return withSlash
}

/** Reject protocol-relative and non-path values before a shell lookup. */
export function sanitizePublicShellPath(path: string): string | null {
  const normalized = normalizePublicPath(path)
  if (!normalized.startsWith('/')) return null
  if (normalized.startsWith('//')) return null
  if (normalized.includes('\\') || normalized.includes('://')) return null
  if (normalized.length > 512) return null
  return normalized
}

export function publicShellKeyMatches(a: PublicShellKey, b: PublicShellKey): boolean {
  return (
    a.layoutId === b.layoutId &&
    a.outlineId === b.outlineId &&
    a.sectionsLayout === b.sectionsLayout
  )
}
