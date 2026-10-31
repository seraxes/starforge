import { flattenAssignmentsForPosition } from './document'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument, LayoutModuleAssignment, LayoutPositionId } from './types'

/**
 * Load the active layout document (DB first, then default-layout.json).
 *
 * Storage is JSON in `sf_layouts`. A future visual editor (and optional YAML
 * export) uses the same sections → positions → modules shape.
 */
export async function getLayoutDocument(): Promise<LayoutDocument> {
  const { document } = await loadLayoutDocument()
  return document
}

/** Enabled module assignments for one position, sorted by `order`. */
export async function getAssignmentsForPosition(
  position: LayoutPositionId,
): Promise<LayoutModuleAssignment[]> {
  const doc = await getLayoutDocument()
  return flattenAssignmentsForPosition(doc, position)
}
