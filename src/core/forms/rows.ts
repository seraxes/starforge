/**
 * Form section row / column layout helpers (Gantry-like %).
 * Client-safe — no server-only imports.
 */

import {
  clampGridWidth,
  evenColumnWidths,
  LAYOUT_WIDTH_FULL,
  LAYOUT_WIDTH_MIN,
  normalizeRowWidthsToPercent,
  resizeAdjacentPair,
} from '@/core/modules/grid'

import type { FormFieldDef, FormRowColumn, FormRowDef, FormSectionDef } from './types'

export { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, LAYOUT_WIDTH_MIN, resizeAdjacentPair }

function newRowId(): string {
  return `row_${Math.random().toString(36).slice(2, 10)}`
}

/** Flatten section rows → ordered field names. */
export function sectionFieldNames(section: FormSectionDef): string[] {
  return section.rows.flatMap((r) => r.columns.map((c) => c.fieldName))
}

/** Flatten all sections → ordered field names. */
export function sectionsFieldNames(sections: FormSectionDef[]): string[] {
  return sections.flatMap(sectionFieldNames)
}

/** Build a single-column row at 100% (or custom width). */
export function createRowDraft(fieldName: string, width: number = LAYOUT_WIDTH_FULL): FormRowDef {
  return {
    id: newRowId(),
    columns: [{ fieldName, width: clampGridWidth(width, LAYOUT_WIDTH_FULL) }],
  }
}

/** Evenly redistribute column widths so they sum to 100%. */
export function redistributeRowWidths(row: FormRowDef): FormRowDef {
  const widths = evenColumnWidths(row.columns.length)
  return {
    ...row,
    columns: row.columns.map((col, i) => ({
      ...col,
      width: widths[i] ?? LAYOUT_WIDTH_FULL,
    })),
  }
}

/**
 * Normalize raw row JSON (or legacy fieldNames) into rows with clamped % widths.
 * Assigns each field name at most once (first wins); returns assigned set for orphan pass.
 */
export function normalizeSectionRows(
  rawRows: unknown,
  legacyFieldNames: unknown,
  nameSet: Set<string>,
  assigned: Set<string>,
): FormRowDef[] {
  const rows: FormRowDef[] = []

  if (Array.isArray(rawRows) && rawRows.length > 0) {
    for (const entry of rawRows) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as Record<string, unknown>
      const id =
        typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newRowId()
      const rawColumns = Array.isArray(row.columns) ? row.columns : []
      const columns: FormRowColumn[] = []
      const rawWidths: number[] = []
      const pendingNames: string[] = []

      for (const colEntry of rawColumns) {
        if (!colEntry || typeof colEntry !== 'object') continue
        const col = colEntry as Record<string, unknown>
        const fieldName =
          typeof col.fieldName === 'string'
            ? col.fieldName
            : typeof col.name === 'string'
              ? col.name
              : ''
        if (!fieldName || !nameSet.has(fieldName) || assigned.has(fieldName)) continue
        assigned.add(fieldName)
        pendingNames.push(fieldName)
        rawWidths.push(
          typeof col.width === 'number' && Number.isFinite(col.width)
            ? col.width
            : LAYOUT_WIDTH_FULL,
        )
      }

      if (pendingNames.length === 0) continue

      const widths =
        pendingNames.length === 1
          ? [LAYOUT_WIDTH_FULL]
          : normalizeRowWidthsToPercent(
              rawWidths.length === pendingNames.length
                ? rawWidths
                : evenColumnWidths(pendingNames.length),
            )
      // Re-normalize so multi-col rows sum to ~100.
      const even =
        pendingNames.length > 1 && widths.reduce((a, b) => a + b, 0) !== LAYOUT_WIDTH_FULL
          ? evenColumnWidths(pendingNames.length)
          : widths

      for (let i = 0; i < pendingNames.length; i++) {
        columns.push({
          fieldName: pendingNames[i]!,
          width: clampGridWidth(even[i] ?? LAYOUT_WIDTH_FULL),
        })
      }
      rows.push({ id, columns })
    }
  }

  // Legacy: fieldNames → one field per row at 100%.
  if (rows.length === 0 && Array.isArray(legacyFieldNames)) {
    for (const n of legacyFieldNames) {
      if (typeof n !== 'string' || !nameSet.has(n) || assigned.has(n)) continue
      assigned.add(n)
      rows.push(createRowDraft(n))
    }
  }

  return rows
}

/** Append orphan field names as full-width rows onto the first section. */
export function appendOrphanFieldRows(
  sections: FormSectionDef[],
  orphanNames: string[],
): FormSectionDef[] {
  if (!orphanNames.length || !sections[0]) return sections
  const next = [...sections]
  next[0] = {
    ...next[0],
    rows: [...next[0].rows, ...orphanNames.map((n) => createRowDraft(n))],
  }
  return next
}

/**
 * Ensure every field appears exactly once across section rows.
 * Prefer existing row structure; orphans → trailing full-width rows on first section.
 */
export function reconcileSectionRowsWithFields(
  sections: FormSectionDef[],
  fields: FormFieldDef[],
): FormSectionDef[] {
  const nameSet = new Set(fields.map((f) => f.name))
  const assigned = new Set<string>()
  const next: FormSectionDef[] = []

  for (const section of sections) {
    const rows: FormRowDef[] = []
    for (const row of section.rows) {
      const columns: FormRowColumn[] = []
      for (const col of row.columns) {
        if (!nameSet.has(col.fieldName) || assigned.has(col.fieldName)) continue
        assigned.add(col.fieldName)
        columns.push({
          fieldName: col.fieldName,
          width: clampGridWidth(col.width),
        })
      }
      if (columns.length === 0) continue
      rows.push(
        columns.length === row.columns.length
          ? { id: row.id, columns }
          : redistributeRowWidths({ id: row.id, columns }),
      )
    }
    next.push({ id: section.id, label: section.label, rows })
  }

  const orphan = fields.map((f) => f.name).filter((n) => !assigned.has(n))
  if (next.length === 0) {
    return [
      {
        id: 'sec_main',
        label: 'Fields',
        rows: orphan.map((n) => createRowDraft(n)),
      },
    ]
  }
  return appendOrphanFieldRows(next, orphan)
}

/** Remove a field from all rows; drop empty rows; redistribute remaining widths. */
export function removeFieldFromSections(
  sections: FormSectionDef[],
  fieldName: string,
): FormSectionDef[] {
  return sections.map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => {
        const columns = row.columns.filter((c) => c.fieldName !== fieldName)
        if (columns.length === 0) return null
        if (columns.length === row.columns.length) return row
        return redistributeRowWidths({ ...row, columns })
      })
      .filter((r): r is FormRowDef => Boolean(r)),
  }))
}

/** Rename a field across all section rows. */
export function renameFieldInSections(
  sections: FormSectionDef[],
  prevName: string,
  nextName: string,
): FormSectionDef[] {
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      columns: row.columns.map((c) =>
        c.fieldName === prevName ? { ...c, fieldName: nextName } : c,
      ),
    })),
  }))
}

/** Append a new full-width row with one field into a section. */
export function appendFieldRow(
  sections: FormSectionDef[],
  sectionId: string,
  fieldName: string,
): FormSectionDef[] {
  return sections.map((s) =>
    s.id === sectionId
      ? { ...s, rows: [...s.rows, createRowDraft(fieldName)] }
      : s,
  )
}

/**
 * Add a field as a new column in an existing row (even widths).
 * If the row is missing, falls back to a new full-width row in that section.
 */
export function addFieldToRow(
  sections: FormSectionDef[],
  sectionId: string,
  rowId: string,
  fieldName: string,
  index?: number,
): FormSectionDef[] {
  return sections.map((s) => {
    if (s.id !== sectionId) return s
    const rowIndex = s.rows.findIndex((r) => r.id === rowId)
    if (rowIndex < 0) {
      return { ...s, rows: [...s.rows, createRowDraft(fieldName)] }
    }
    const row = s.rows[rowIndex]!
    const insertAt =
      index == null ? row.columns.length : Math.max(0, Math.min(row.columns.length, index))
    const columns = [
      ...row.columns.slice(0, insertAt),
      { fieldName, width: LAYOUT_WIDTH_MIN },
      ...row.columns.slice(insertAt),
    ]
    const nextRows = [...s.rows]
    nextRows[rowIndex] = redistributeRowWidths({ ...row, columns })
    return { ...s, rows: nextRows }
  })
}

/** Move a field into another row (or new solo row). Redistributes widths. */
export function moveFieldInSections(
  sections: FormSectionDef[],
  fieldName: string,
  target: { sectionId: string; rowId: string | null; index: number },
): FormSectionDef[] {
  const found: FormRowColumn[] = []
  const stripped = sections.map((section) => ({
    ...section,
    rows: section.rows
      .map((row) => {
        const idx = row.columns.findIndex((c) => c.fieldName === fieldName)
        if (idx < 0) return row
        const hit = row.columns[idx]
        if (hit) found.push(hit)
        const columns = row.columns.filter((c) => c.fieldName !== fieldName)
        if (columns.length === 0) return null
        return redistributeRowWidths({ ...row, columns })
      })
      .filter((r): r is FormRowDef => Boolean(r)),
  }))

  const movedCol = found[0]
  if (!movedCol) return sections
  const col: FormRowColumn = { fieldName: movedCol.fieldName, width: movedCol.width }

  return stripped.map((section) => {
    if (section.id !== target.sectionId) return section

    // null rowId → insert as a new solo row at `index` among rows
    if (target.rowId == null) {
      const solo = createRowDraft(col.fieldName)
      const at = Math.max(0, Math.min(section.rows.length, target.index))
      const rows = [...section.rows.slice(0, at), solo, ...section.rows.slice(at)]
      return { ...section, rows }
    }

    const rowIndex = section.rows.findIndex((r) => r.id === target.rowId)
    if (rowIndex < 0) {
      return { ...section, rows: [...section.rows, createRowDraft(col.fieldName)] }
    }
    const row = section.rows[rowIndex]!
    const insertAt = Math.max(0, Math.min(row.columns.length, target.index))
    const columns = [
      ...row.columns.slice(0, insertAt),
      { fieldName: col.fieldName, width: LAYOUT_WIDTH_MIN },
      ...row.columns.slice(insertAt),
    ]
    const rows = [...section.rows]
    rows[rowIndex] = redistributeRowWidths({ ...row, columns })
    return { ...section, rows }
  })
}

/** Split a column out of a multi-column row into its own full-width row (after the source). */
export function splitFieldToOwnRow(
  sections: FormSectionDef[],
  sectionId: string,
  fieldName: string,
): FormSectionDef[] {
  return sections.map((section) => {
    if (section.id !== sectionId) return section
    const rows: FormRowDef[] = []
    for (const row of section.rows) {
      const idx = row.columns.findIndex((c) => c.fieldName === fieldName)
      if (idx < 0 || row.columns.length <= 1) {
        rows.push(row)
        continue
      }
      const remaining = row.columns.filter((c) => c.fieldName !== fieldName)
      rows.push(redistributeRowWidths({ ...row, columns: remaining }))
      rows.push(createRowDraft(fieldName))
    }
    return { ...section, rows }
  })
}

/** Merge `sourceRowId` into `targetRowId` (append columns, even widths). */
export function mergeRows(
  sections: FormSectionDef[],
  sectionId: string,
  targetRowId: string,
  sourceRowId: string,
): FormSectionDef[] {
  if (targetRowId === sourceRowId) return sections
  return sections.map((section) => {
    if (section.id !== sectionId) return section
    const target = section.rows.find((r) => r.id === targetRowId)
    const source = section.rows.find((r) => r.id === sourceRowId)
    if (!target || !source) return section
    const columns = [...target.columns, ...source.columns]
    const merged = redistributeRowWidths({ ...target, columns })
    return {
      ...section,
      rows: section.rows
        .filter((r) => r.id !== sourceRowId)
        .map((r) => (r.id === targetRowId ? merged : r)),
    }
  })
}

/** Resize two adjacent columns in a row (1% steps, ≥5% each). */
export function resizeRowColumns(
  sections: FormSectionDef[],
  sectionId: string,
  rowId: string,
  leftIndex: number,
  newLeftWidth: number,
): FormSectionDef[] {
  return sections.map((section) => {
    if (section.id !== sectionId) return section
    return {
      ...section,
      rows: section.rows.map((row) => {
        if (row.id !== rowId) return row
        const left = row.columns[leftIndex]
        const right = row.columns[leftIndex + 1]
        if (!left || !right) return row
        const [lw, rw] = resizeAdjacentPair(left.width, right.width, newLeftWidth)
        const columns = row.columns.map((c, i) => {
          if (i === leftIndex) return { ...c, width: lw }
          if (i === leftIndex + 1) return { ...c, width: rw }
          return c
        })
        return { ...row, columns }
      }),
    }
  })
}
