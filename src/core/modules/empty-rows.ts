import type { LayoutDocument, LayoutRow, LayoutSection } from './types'

function rowIsEmpty(row: LayoutRow): boolean {
  return !Array.isArray(row.slots) || row.slots.length === 0
}

/** Stable empty-row ids so normalize-on-load does not remount the canvas every refresh. */
function nextEmptyRowId(sectionId: string, usedIds: Set<string>): string {
  const base = `${sectionId}__trailing-empty`
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
 * Auto empty-row rules for the Layout manager (SF-87):
 * - Default: one open empty row per section.
 * - After any row has ≥1 module, keep one empty trailing row (cascade as rows fill).
 * - Consecutive empties collapse (e.g. clearing the last module beside a trailing empty).
 *
 * Mutates `section.rows` in place and reindexes `order`.
 */
export function ensureSectionEmptyRows(section: LayoutSection): void {
  const sorted = [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )

  const collapsed: LayoutRow[] = []
  for (const row of sorted) {
    if (rowIsEmpty(row) && collapsed.length > 0 && rowIsEmpty(collapsed[collapsed.length - 1]!)) {
      continue
    }
    collapsed.push(row)
  }

  const usedIds = new Set(collapsed.map((row) => row.id))

  if (collapsed.length === 0) {
    section.rows = [makeEmptyRow(section.id, 0, usedIds)]
    return
  }

  const last = collapsed[collapsed.length - 1]!
  if (!rowIsEmpty(last)) {
    collapsed.push(makeEmptyRow(section.id, collapsed.length, usedIds))
  }

  reindexRowOrders(collapsed)
  section.rows = collapsed
}

/** Apply empty-row rules to every section in a layout document. */
export function ensureDocumentEmptyRows(doc: LayoutDocument): void {
  for (const section of doc.sections) {
    ensureSectionEmptyRows(section)
  }
}
