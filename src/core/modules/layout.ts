import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument, LayoutSlot, LayoutPositionId } from './types'

/**
 * Load a layout document by id (DB first, then default-layout.json).
 * Shape: sections → rows → slots (`moduleId` + `width` 1–12).
 * Page Settings `layoutId` selects which row; missing ids fall back to default JSON.
 */
export async function getLayoutDocument(
  layoutId?: string,
): Promise<LayoutDocument> {
  const { document } = await loadLayoutDocument(layoutId)
  return document
}

/**
 * Enabled slots for one section id (Gantry “position”), sorted by row/slot order.
 * @deprecated Prefer iterating the document in `PublicLayoutBody`.
 */
export async function getAssignmentsForPosition(position: LayoutPositionId): Promise<LayoutSlot[]> {
  const doc = await getLayoutDocument()
  const section = doc.sections.find((s) => s.id === position)
  if (!section) return []
  const out: LayoutSlot[] = []
  for (const row of [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )) {
    for (const slot of [...row.slots].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )) {
      if (slot.enabled === false) continue
      out.push(slot)
    }
  }
  return out
}
