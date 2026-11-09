import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'

import { resolveLayoutInheritance } from './inherit'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument, LayoutSlot, LayoutPositionId } from './types'

/**
 * Load a layout document by id (DB first, then default-layout.json),
 * with outline inheritance resolved for public paint.
 * Admin mutators use uncached `loadLayoutDocument` (raw / unmerged).
 * Cross-request cache via published-content cache.
 */
export async function getLayoutDocument(
  layoutId?: string,
): Promise<LayoutDocument> {
  const id =
    typeof layoutId === 'string' && layoutId.trim() ? layoutId.trim() : DEFAULT_LAYOUT_ID
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'layout', id],
      tags: [contentCacheTags.layouts, contentCacheTags.layout(id)],
      revalidate: false,
    },
    async () => {
      const { document, layoutId: resolvedId } = await loadLayoutDocument(id)
      return resolveLayoutInheritance(resolvedId, document)
    },
  )
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
