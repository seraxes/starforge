/**
 * Outline inheritance — child layouts inherit sections from a parent (skin Default shell).
 * Admin edits raw documents; public `getLayoutDocument` merges via `resolveLayoutInheritance`.
 */
import 'server-only'

import { DEFAULT_LAYOUT_ID } from '@/core/db'

import {
  mergeLayoutDocuments,
  sectionPaintedFromSource,
  slotPaintedFromSource,
} from './inherit-merge'
import { loadLayoutDocument } from './layout-store'
import type { LayoutDocument, LayoutSection, LayoutSlot } from './types'

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

function findSlotById(section: LayoutSection | undefined, slotId: string): LayoutSlot | undefined {
  if (!section) return undefined
  const id = slotId.trim()
  if (!id) return undefined
  for (const row of section.rows) {
    const slot = row.slots.find((item) => item.id === id)
    if (slot) return slot
  }
  return undefined
}

/**
 * Sections and particles can name a layout other than this outline’s parent.
 * Those overrides paint after the parent merge.
 */
async function applyOutlineSourceOverrides(
  layoutId: string,
  raw: LayoutDocument,
  merged: LayoutDocument,
  depth: number,
  visiting: Set<string>,
): Promise<LayoutDocument> {
  const docParent = typeof raw.inheritFrom === 'string' ? raw.inheritFrom.trim() : ''
  const cache = new Map<string, LayoutDocument>()

  async function sourceDocument(sourceId: string): Promise<LayoutDocument | null> {
    const id = sourceId.trim()
    if (!id || id === layoutId || visiting.has(id) || depth >= MAX_INHERIT_DEPTH) return null
    const cached = cache.get(id)
    if (cached) return cached
    const loaded = await loadLayoutDocument(id)
    if (loaded.layoutId !== id && id !== DEFAULT_LAYOUT_ID) return null
    const resolved = await resolveLayoutInheritance(
      loaded.layoutId,
      loaded.document,
      depth + 1,
      visiting,
    )
    cache.set(id, resolved)
    return resolved
  }

  const rawById = new Map(raw.sections.map((section) => [section.id, section]))
  const sections = structuredClone(merged.sections)

  for (const rawSection of raw.sections) {
    if (rawSection.inheritMode !== 'inherit') continue
    const sourceId = rawSection.inheritFromOutlineId?.trim() || ''
    if (!sourceId || sourceId === docParent) continue
    const source = await sourceDocument(sourceId)
    const sourceSection = source?.sections.find((section) => section.id === rawSection.id)
    if (!sourceSection) continue
    const painted = sectionPaintedFromSource(rawSection, sourceSection)
    const index = sections.findIndex((section) => section.id === rawSection.id)
    if (index >= 0) sections[index] = painted
    else sections.push(painted)
  }

  for (const section of sections) {
    const rawSection = rawById.get(section.id)
    if (!rawSection || rawSection.inheritMode === 'inherit') continue
    for (const row of section.rows) {
      const rawRow = rawSection.rows.find((item) => item.id === row.id)
      if (!rawRow) continue
      const slots: LayoutSlot[] = []
      for (const slot of row.slots) {
        const rawSlot = rawRow.slots.find((item) => item.id === slot.id)
        const sourceId = rawSlot?.inheritFromOutlineId?.trim() || ''
        if (!rawSlot || rawSlot.inheritMode !== 'inherit' || !sourceId || sourceId === docParent) {
          slots.push(slot)
          continue
        }
        const source = await sourceDocument(sourceId)
        const sourceSlot = findSlotById(
          source?.sections.find((item) => item.id === section.id),
          rawSlot.inheritFromSlotId?.trim() || slot.id,
        )
        slots.push(sourceSlot ? slotPaintedFromSource(slot, sourceSlot) : slot)
      }
      row.slots = slots
    }
  }

  const sorted = [...sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )
  return { ...merged, sections: sorted }
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
  if (depth >= MAX_INHERIT_DEPTH || visiting.has(id)) {
    return sortSections(document)
  }
  visiting.add(id)

  const inheritFrom =
    typeof document.inheritFrom === 'string' ? document.inheritFrom.trim() : ''

  let merged: LayoutDocument
  if (!inheritFrom || inheritFrom === id) {
    merged = sortSections(document)
  } else {
    const { document: parentRaw, layoutId: parentId } = await loadLayoutDocument(inheritFrom)
    const parentResolved = await resolveLayoutInheritance(
      parentId,
      parentRaw,
      depth + 1,
      visiting,
    )
    merged = mergeLayoutDocuments(parentResolved, document)
  }
  return applyOutlineSourceOverrides(id, document, merged, depth, visiting)
}
