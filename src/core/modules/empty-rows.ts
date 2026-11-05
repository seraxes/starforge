import type { LayoutDocument, LayoutRow, LayoutSection } from './types'

export function layoutRowIsEmpty(row: LayoutRow): boolean {
  return !Array.isArray(row.slots) || row.slots.length === 0
}

/** Stable empty-row ids so normalize-on-load does not remount the canvas every refresh. */
function nextEmptyRowId(sectionId: string, usedIds: Set<string>): string {
  const base = `${sectionId}__empty-row`
  if (!usedIds.has(base)) return base
  let n = 2
  while (usedIds.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

function makeEmptyRow(sectionId: string, order: number, usedIds: Set<string>): LayoutRow {
  const id = nextEmptyRowId(sectionId, usedIds)
  usedIds.add(id)
  return {
    id,
    order,
    slots: [],
  }
}

function reindexRowOrders(rows: LayoutRow[]): void {
  rows.forEach((row, index) => {
    row.order = index
  })
}

/**
 * Normalize empty rows for Layout (opt-in drop rows):
 * - Collapse consecutive empties only (keep at most one empty in a run).
 * - Do **not** auto-add a trailing empty (UI + row opens one).
 * - Empty section stays empty (UI shows + row).
 *
 * Mutates `section.rows` in place and reindexes `order`.
 */
export function ensureSectionEmptyRows(section: LayoutSection): void {
  const sorted = [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )

  const collapsed: LayoutRow[] = []
  for (const row of sorted) {
    if (
      layoutRowIsEmpty(row) &&
      collapsed.length > 0 &&
      layoutRowIsEmpty(collapsed[collapsed.length - 1]!)
    ) {
      continue
    }
    collapsed.push(row)
  }

  reindexRowOrders(collapsed)
  section.rows = collapsed
}

/** Apply empty-row normalize to every section in a layout document. */
export function ensureDocumentEmptyRows(doc: LayoutDocument): void {
  for (const section of doc.sections) {
    ensureSectionEmptyRows(section)
  }
}

/**
 * One-shot heal for legacy SF-87 docs that always stored a trailing empty:
 * drop empty rows that have no slots so the canvas default is filled rows only.
 * Does not run on every mutate — only when loading/normalizing a document for admin.
 */
export function stripEmptyLayoutRows(section: LayoutSection): void {
  const sorted = [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )
  const filled = sorted.filter((row) => !layoutRowIsEmpty(row))
  reindexRowOrders(filled)
  section.rows = filled
}

export function stripDocumentEmptyRows(doc: LayoutDocument): void {
  for (const section of doc.sections) {
    stripEmptyLayoutRows(section)
  }
}

/** Append one empty drop row at the end of a section (UI + row). */
export function appendEmptyLayoutRow(section: LayoutSection): LayoutRow {
  ensureSectionEmptyRows(section)
  const last = section.rows[section.rows.length - 1]
  if (last && layoutRowIsEmpty(last)) return last
  const usedIds = new Set(section.rows.map((r) => r.id))
  const empty = makeEmptyRow(section.id, section.rows.length, usedIds)
  section.rows.push(empty)
  reindexRowOrders(section.rows)
  return empty
}

/**
 * Remove an empty drop row. Refuses if the row has particles.
 * Returns false when not found / not empty.
 */
export function removeEmptyLayoutRow(section: LayoutSection, rowId: string): boolean {
  const idx = section.rows.findIndex((r) => r.id === rowId)
  if (idx < 0) return false
  const row = section.rows[idx]!
  if (!layoutRowIsEmpty(row)) return false
  section.rows.splice(idx, 1)
  ensureSectionEmptyRows(section)
  return true
}
