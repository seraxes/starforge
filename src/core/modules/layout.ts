import defaultLayoutJson from './default-layout.json'
import type { LayoutAssignment, LayoutDocument, LayoutPositionId } from './types'

/**
 * Load the active layout document.
 *
 * Today: static JSON (`default-layout.json`) — any module → any position.
 * Later: visual layout editor writes the same shape (YAML/JSON) to disk or DB;
 * this helper stays the single read path for public rendering.
 */
export function getLayoutDocument(): LayoutDocument {
  const raw = defaultLayoutJson as LayoutDocument
  if (!raw || raw.version !== 1 || !Array.isArray(raw.assignments)) {
    return { version: 1, assignments: [] }
  }
  return {
    version: 1,
    assignments: raw.assignments.map(normalizeAssignment).filter(Boolean) as LayoutAssignment[],
  }
}

function normalizeAssignment(entry: LayoutAssignment | null | undefined): LayoutAssignment | null {
  if (!entry || typeof entry.moduleId !== 'string' || !entry.moduleId.trim()) return null
  if (typeof entry.position !== 'string' || !entry.position.trim()) return null
  return {
    moduleId: entry.moduleId.trim(),
    position: entry.position.trim() as LayoutPositionId,
    enabled: entry.enabled !== false,
    order: typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : 0,
  }
}

/** Assignments for one position, enabled only, sorted by `order`. */
export function getAssignmentsForPosition(position: LayoutPositionId): LayoutAssignment[] {
  return getLayoutDocument()
    .assignments.filter((a) => a.enabled !== false && a.position === position)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.moduleId.localeCompare(b.moduleId))
}
