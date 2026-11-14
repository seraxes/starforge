/**
 * Pure outline inheritance merge (no DB) — used by resolve + unit tests.
 *
 * Section / particle / styles inherit modes relative to parent outline:
 * - Absent child section → keep parent (inherit-by-absence)
 * - Child `inheritMode: 'inherit'` → parent structure; child meta overlays
 * - Child `inheritMode: 'local'` / omitted mode → child owns rows
 * - `stylesInheritMode: 'inherit'` / omitted when structure inherited → parent styles
 * - Slot `inheritMode: 'inherit'` → parent slot by id (or inheritFromSlotId)
 */
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot } from './types'

function sortSections(sections: LayoutSection[]): LayoutSection[] {
  return [...sections].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )
}

function cloneSection(section: LayoutSection): LayoutSection {
  return structuredClone(section)
}

function cloneSlot(slot: LayoutSlot): LayoutSlot {
  return structuredClone(slot)
}

function indexParentSlots(section: LayoutSection | undefined): Map<string, LayoutSlot> {
  const map = new Map<string, LayoutSlot>()
  if (!section) return map
  for (const row of section.rows) {
    for (const slot of row.slots) {
      map.set(slot.id, slot)
    }
  }
  return map
}

function resolveSlotAgainstParent(
  slot: LayoutSlot,
  parentSlots: Map<string, LayoutSlot>,
): LayoutSlot {
  if (slot.inheritMode !== 'inherit') {
    const out = cloneSlot(slot)
    delete out.inheritMode
    delete out.inheritFromSlotId
    return out
  }
  const parentId = slot.inheritFromSlotId?.trim() || slot.id
  const parentSlot = parentSlots.get(parentId)
  if (!parentSlot) {
    const out = cloneSlot(slot)
    delete out.inheritMode
    delete out.inheritFromSlotId
    return out
  }
  const merged = cloneSlot(parentSlot)
  delete merged.inheritMode
  delete merged.inheritFromSlotId
  // Child may keep a different instance id when pointing at inheritFromSlotId.
  merged.id = slot.id
  return merged
}

function resolveRowsAgainstParent(
  rows: LayoutRow[],
  parentSection: LayoutSection | undefined,
): LayoutRow[] {
  const parentSlots = indexParentSlots(parentSection)
  return rows.map((row) => ({
    ...row,
    slots: row.slots.map((slot) => resolveSlotAgainstParent(slot, parentSlots)),
  }))
}

function resolveStyles(
  parent: LayoutSection | undefined,
  child: LayoutSection | undefined,
  structureInherited: boolean,
): LayoutSection['styles'] | undefined {
  if (!child) return parent?.styles
  const mode = child.stylesInheritMode
  if (mode === 'local') return child.styles
  if (mode === 'inherit') return parent?.styles
  // Default: structure-inherited sections take parent styles; local sections keep child styles.
  if (structureInherited) return parent?.styles ?? child.styles
  return child.styles ?? parent?.styles
}

/**
 * Merge one child section onto a parent section (same id).
 * Returns the resolved section for public paint (no inheritMode flags).
 */
export function mergeSectionAgainstParent(
  parent: LayoutSection | undefined,
  child: LayoutSection,
): LayoutSection {
  const mode = child.inheritMode === 'inherit' ? 'inherit' : 'local'
  const structureInherited = mode === 'inherit'

  if (structureInherited) {
    if (!parent) {
      // No parent match — treat as local empty shell with child meta.
      const out: LayoutSection = {
        id: child.id,
        label: child.label || child.id,
        order: child.order,
        rows: [],
        ...(child.cssClass ? { cssClass: child.cssClass } : {}),
        ...(child.containerMode ? { containerMode: child.containerMode } : {}),
        ...(child.width != null ? { width: child.width } : {}),
      }
      const styles = resolveStyles(undefined, child, false)
      if (styles) out.styles = styles
      return out
    }
    const out = cloneSection(parent)
    delete out.inheritMode
    delete out.stylesInheritMode
    if (child.label?.trim()) out.label = child.label.trim()
    if (child.order != null && Number.isFinite(child.order)) out.order = child.order
    if (child.cssClass !== undefined) {
      if (child.cssClass) out.cssClass = child.cssClass
      else delete out.cssClass
    }
    if (child.containerMode !== undefined) {
      if (child.containerMode) out.containerMode = child.containerMode
      else delete out.containerMode
    }
    if (child.width !== undefined) {
      if (child.width != null) out.width = child.width
      else delete out.width
    }
    const styles = resolveStyles(parent, child, true)
    if (styles) out.styles = styles
    else delete out.styles
    // Structure from parent; particle inherit only applies inside local row trees.
    return out
  }

  // Local (or legacy present-without-mode): child owns rows; resolve slot inherits.
  const out: LayoutSection = {
    id: child.id,
    label: child.label || parent?.label || child.id,
    order: child.order ?? parent?.order,
    rows: resolveRowsAgainstParent(child.rows ?? [], parent),
  }
  if (child.cssClass) out.cssClass = child.cssClass
  else if (parent?.cssClass) out.cssClass = parent.cssClass
  if (child.containerMode) out.containerMode = child.containerMode
  else if (parent?.containerMode) out.containerMode = parent.containerMode
  if (child.width != null) out.width = child.width
  else if (parent?.width != null) out.width = parent.width
  const styles = resolveStyles(parent, child, false)
  if (styles) out.styles = styles
  return out
}

/**
 * Merge parent + child: start from parent sections, drop `omitSectionIds`,
 * then apply child section inherit/local modes by id.
 */
export function mergeLayoutDocuments(
  parent: LayoutDocument,
  child: LayoutDocument,
): LayoutDocument {
  const omit = new Set(
    (child.omitSectionIds ?? [])
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean),
  )
  const parentById = new Map<string, LayoutSection>()
  for (const section of parent.sections) {
    if (omit.has(section.id)) continue
    parentById.set(section.id, section)
  }

  const childById = new Map<string, LayoutSection>()
  for (const section of child.sections) {
    childById.set(section.id, section)
  }

  const byId = new Map<string, LayoutSection>()

  // Inherited-by-absence: parent sections not overridden / omitted.
  for (const [id, parentSection] of parentById) {
    if (childById.has(id)) continue
    byId.set(id, cloneSection(parentSection))
  }

  // Child sections: inherit stub or local override.
  for (const [id, childSection] of childById) {
    if (omit.has(id)) continue
    const parentSection = parentById.get(id)
    byId.set(id, mergeSectionAgainstParent(parentSection, childSection))
  }

  const sections = sortSections([...byId.values()])
  const breakpoints = child.styles?.breakpoints ?? parent.styles?.breakpoints
  const body = child.styles?.body ?? parent.styles?.body
  const out: LayoutDocument = { version: 3, sections }
  if (breakpoints || body) {
    out.styles = {
      ...(breakpoints ? { breakpoints } : {}),
      ...(body ? { body } : {}),
    }
  }
  return out
}

/** Deep-clone a parent section for “Copy” → child local ownership. */
export function copySectionFromParent(parent: LayoutSection): LayoutSection {
  const out = cloneSection(parent)
  out.inheritMode = 'local'
  out.stylesInheritMode = 'local'
  for (const row of out.rows) {
    for (const slot of row.slots) {
      slot.inheritMode = 'local'
      delete slot.inheritFromSlotId
    }
  }
  return out
}

/** Deep-clone a parent slot for particle “Copy”. */
export function copySlotFromParent(parent: LayoutSlot, slotId?: string): LayoutSlot {
  const out = cloneSlot(parent)
  if (slotId) out.id = slotId
  out.inheritMode = 'local'
  delete out.inheritFromSlotId
  return out
}
