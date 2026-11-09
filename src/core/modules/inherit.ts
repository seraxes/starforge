/**
 * Outline inheritance — child layouts inherit sections from a parent (skin Default shell).
 * Admin edits raw documents; public `getLayoutDocument` merges via `resolveLayoutInheritance`.
 */
import 'server-only'

import { DEFAULT_LAYOUT_ID } from '@/core/db'

import { mergeLayoutDocuments } from './inherit-merge'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument } from './types'

export { mergeLayoutDocuments } from './inherit-merge'

const MAX_INHERIT_DEPTH = 8

function sortSections(doc: LayoutDocument): LayoutDocument {
  return {
    version: 3,
    sections: [...doc.sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    ),
    ...(doc.styles ? { styles: doc.styles } : {}),
  }
}

/**
 * Resolve inheritance chain for a layout document (cycle-safe).
 * `layoutId` is the child id (for cycle detection / self-inherit guard).
 */
export async function resolveLayoutInheritance(
  layoutId: string,
  document: LayoutDocument,
  depth = 0,
  visiting: Set<string> = new Set(),
): Promise<LayoutDocument> {
  const id = layoutId.trim() || DEFAULT_LAYOUT_ID
  const inheritFrom =
    typeof document.inheritFrom === 'string' ? document.inheritFrom.trim() : ''

  if (!inheritFrom || inheritFrom === id || depth >= MAX_INHERIT_DEPTH) {
    return sortSections(document)
  }

  if (visiting.has(id)) {
    return sortSections(document)
  }
  visiting.add(id)

  const { document: parentRaw, layoutId: parentId } = await loadLayoutDocument(inheritFrom)
  const parentResolved = await resolveLayoutInheritance(
    parentId,
    parentRaw,
    depth + 1,
    visiting,
  )
  return mergeLayoutDocuments(parentResolved, document)
}
