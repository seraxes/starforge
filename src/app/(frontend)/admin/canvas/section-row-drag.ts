/**
 * Pure helpers for the one section / row / slot drag.
 * Layout and the Form builder both use these. Do not add a second copy.
 */

/** Placed slot (particle or form field) — JSON `{ sectionId, rowId, itemId }`. */
export const DND_CANVAS_SLOT = 'application/x-starforge-slot'

/** Row within a section — JSON `{ sectionId, rowId }`. */
export const DND_CANVAS_ROW = 'application/x-starforge-row'

/** Section reorder / mosaic — value is the section id. */
export const DND_CANVAS_SECTION = 'application/x-starforge-section'

/** Layout particle palette. Form field palettes pass their own mime types. */
export const DND_LAYOUT_PARTICLE = 'application/x-starforge-particle'

export type CanvasItemDrag = {
  sectionId: string
  rowId: string
  itemId: string
}

export type CanvasRowDrag = {
  sectionId: string
  rowId: string
}

export function dataTransferHasType(dt: DataTransfer, type: string): boolean {
  return [...dt.types].includes(type)
}

export function dataTransferHasAny(dt: DataTransfer, types: readonly string[]): boolean {
  return types.some((type) => dataTransferHasType(dt, type))
}

export function encodeCanvasItemDrag(payload: CanvasItemDrag): string {
  return JSON.stringify(payload)
}

export function parseCanvasItemDrag(raw: string): CanvasItemDrag | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as Partial<CanvasItemDrag>
    if (
      typeof parsed.sectionId === 'string' &&
      parsed.sectionId &&
      typeof parsed.rowId === 'string' &&
      parsed.rowId &&
      typeof parsed.itemId === 'string' &&
      parsed.itemId
    ) {
      return {
        sectionId: parsed.sectionId,
        rowId: parsed.rowId,
        itemId: parsed.itemId,
      }
    }
  } catch {
    // Not a canvas slot payload.
  }
  return null
}

export function encodeCanvasRowDrag(payload: CanvasRowDrag): string {
  return JSON.stringify(payload)
}

export function parseCanvasRowDrag(raw: string): CanvasRowDrag | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasRowDrag>
    if (
      !parsed ||
      typeof parsed.sectionId !== 'string' ||
      typeof parsed.rowId !== 'string' ||
      !parsed.sectionId.trim() ||
      !parsed.rowId.trim()
    ) {
      return null
    }
    return { sectionId: parsed.sectionId.trim(), rowId: parsed.rowId.trim() }
  } catch {
    return null
  }
}

/**
 * Insert index in the list *before* the dragged id is removed.
 * Null when the drop would leave the item where it already is.
 * `fromIndex < 0` means the item is not in this list (move in from elsewhere).
 */
export function insertIndex(
  fromIndex: number,
  targetIndex: number,
  edge: 'before' | 'after',
): number | null {
  if (targetIndex < 0) return null
  const dest = edge === 'before' ? targetIndex : targetIndex + 1
  if (fromIndex >= 0 && (dest === fromIndex || dest === fromIndex + 1)) return null
  return dest
}

/** Move `id` to `destIndex` (index in the original list, before removal). */
export function moveIdInOrder<T>(
  items: readonly T[],
  id: string,
  destIndex: number,
  getId: (item: T) => string,
): T[] {
  const from = items.findIndex((item) => getId(item) === id)
  if (from < 0) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return [...items]
  let insertAt = destIndex
  if (from < destIndex) insertAt -= 1
  insertAt = Math.max(0, Math.min(insertAt, next.length))
  next.splice(insertAt, 0, item)
  return next
}

/** First matching palette mime that actually carries a value (drop only). */
export function readPaletteValue(
  dt: DataTransfer,
  mimes: readonly string[],
): { mime: string; value: string } | null {
  for (const mime of mimes) {
    if (!dataTransferHasType(dt, mime)) continue
    const value = dt.getData(mime).trim()
    if (value) return { mime, value }
  }
  return null
}
