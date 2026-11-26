/**
 * Admin layout load: raw (editable) + resolved (display) + optional parent.
 * Mutations always write the raw document; canvas/Styles preview use resolved.
 */
import 'server-only'

import { DEFAULT_LAYOUT_ID } from '@/core/db'

import { resolveLayoutInheritance } from './inherit'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument } from './types'

export type LayoutAdminBundle = {
  layoutId: string
  label: string
  /** Unmerged document — what mutators read/write. */
  raw: LayoutDocument
  /** Inheritance resolved for canvas / Styles display. */
  resolved: LayoutDocument
  /** Parent outline id (stored inheritFrom, or the skin Base fallback). */
  parentLayoutId: string | null
  /** Resolved parent document when a parent id is loadable. */
  parent: LayoutDocument | null
}

/**
 * Load raw + resolved layout for Layouts / Styles admin.
 * Does not use the public published-content cache (always fresh for editors).
 */
export async function getLayoutDocumentForAdmin(
  layoutId?: string,
  /** Skin Base id when this outline has no stored `inheritFrom`. */
  fallbackParentId?: string | null,
): Promise<LayoutAdminBundle> {
  const id =
    typeof layoutId === 'string' && layoutId.trim() ? layoutId.trim() : DEFAULT_LAYOUT_ID
  const { document: raw, layoutId: resolvedId, label } = await loadLayoutDocument(id)
  const { outlineParentId } = await import('@/core/skin/outline-meta')
  const parentKey = outlineParentId(resolvedId, raw.inheritFrom, fallbackParentId)
  let parent: LayoutDocument | null = null
  let parentLayoutId: string | null = null
  if (parentKey) {
    parentLayoutId = parentKey
    try {
      const loaded = await loadLayoutDocument(parentKey)
      parent = await resolveLayoutInheritance(loaded.layoutId, loaded.document)
    } catch {
      parent = null
    }
  }
  const resolved = await resolveLayoutInheritance(resolvedId, raw)
  return {
    layoutId: resolvedId,
    label,
    raw,
    resolved,
    parentLayoutId,
    parent,
  }
}
