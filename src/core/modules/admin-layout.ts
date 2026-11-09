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
  /** Parent outline id from raw.inheritFrom (trimmed), if any. */
  parentLayoutId: string | null
  /** Parent raw document when inheritFrom is set and loadable. */
  parent: LayoutDocument | null
}

/**
 * Load raw + resolved layout for Layouts / Styles admin.
 * Does not use the public published-content cache (always fresh for editors).
 */
export async function getLayoutDocumentForAdmin(
  layoutId?: string,
): Promise<LayoutAdminBundle> {
  const id =
    typeof layoutId === 'string' && layoutId.trim() ? layoutId.trim() : DEFAULT_LAYOUT_ID
  const { document: raw, layoutId: resolvedId, label } = await loadLayoutDocument(id)
  const inheritFrom =
    typeof raw.inheritFrom === 'string' ? raw.inheritFrom.trim() : ''
  let parent: LayoutDocument | null = null
  let parentLayoutId: string | null = null
  if (inheritFrom && inheritFrom !== resolvedId) {
    parentLayoutId = inheritFrom
    try {
      const loaded = await loadLayoutDocument(inheritFrom)
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
