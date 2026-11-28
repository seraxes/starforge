'use server'

import { accessTagsForStorage, normalizeAccessTags } from '@/core/acl/nav-access'
import { ensureModulesRegistered } from '@/core/modules/boot'

import {
  findRow,
  findSection,
  findSlot,
  newLayoutEntityId,
  sanitizeCssClassList,
  sanitizeDisplayName,
  sanitizeHtmlId,
} from './document'
import {
  appendEmptyLayoutRow,
  ensureSectionEmptyRows,
  removeEmptyLayoutRow,
} from './empty-rows'
import { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, resizeAdjacentPair } from './grid'
import { copySlotFromParent } from './inherit-merge'
import {
  asInheritModeForm,
  assignSyncedRowContainers,
  formSourceOutlineId,
  layoutIdFromForm,
  loadResolvedOutline,
  mutateLayout,
  parentOutlineId,
  storeOutlineSource,
  type LayoutActionState,
} from './layout-mutate'
import { loadLayoutDocument } from './layout-store'
import { defaultConfigForModule } from './particles/config'
import { getRegisteredModule, listRegisteredModules } from './registry'
import { applyRowContainerPatch, type RowContainerPatch } from './row-container'
import { sanitizeCssBoxShorthand, sanitizeCssColor } from './styles'
import type { LayoutRow, LayoutSection, LayoutSlot } from './types'

function findSlotInSection(
  section: LayoutSection | undefined,
  slotId: string,
): LayoutSlot | null {
  if (!section) return null
  for (const row of section.rows) {
    const slot = row.slots.find((s) => s.id === slotId)
    if (slot) return slot
  }
  return null
}

function makeSlot(moduleId: string, width: number, order: number): LayoutSlot {
  const config = defaultConfigForModule(moduleId)
  return {
    id: newLayoutEntityId(`slot-${moduleId}`),
    moduleId,
    width: clampGridWidth(width, LAYOUT_WIDTH_FULL),
    enabled: true,
    order,
    ...(config ? { config } : {}),
  }
}

function rebalanceRowSlots(row: LayoutRow): void {
  const widths = evenColumnWidths(row.slots.length)
  row.slots.forEach((slot, index) => {
    slot.width = widths[index] ?? 1
    slot.order = index
  })
}

/**
 * Particle inherit vs local against parent outline slot (same id).
 */
export async function setSlotInheritModeAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const sourceOnly = String(formData.get('sourceOnly') ?? '') === '1'
  const mode = asInheritModeForm(formData.get('inheritMode'))
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot path.' }
  if (!sourceOnly && !mode) return { error: 'Inherit mode must be inherit or local.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const parentId = await parentOutlineId(document, layoutId)
  const sourceId = formSourceOutlineId(formData) || parentId
  if (!sourceId) return { error: 'This outline has no parent to inherit particles from.' }
  const source = await loadResolvedOutline(sourceId)
  if (!source) return { error: `Layout “${sourceId}” was not found.` }
  const parentSlot = findSlotInSection(
    source.sections.find((section) => section.id === sectionId),
    slotId,
  )
  if (!parentSlot) {
    return { error: `That layout has no particle “${slotId}” in section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found (must be local to edit particles).` }
    if (section.inheritMode === 'inherit') {
      return { error: 'Section is inheriting structure — copy/localize the section first.' }
    }
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: `Slot “${slotId}” not found.` }
    const { slot } = found

    if (sourceOnly) {
      storeOutlineSource(slot, sourceId, parentId)
      return doc
    }

    if (mode === 'inherit') {
      slot.inheritMode = 'inherit'
      delete slot.inheritFromSlotId
      storeOutlineSource(slot, sourceId, parentId)
      return doc
    }

    // local — if currently inheriting, snapshot the source first
    if (slot.inheritMode === 'inherit') {
      const copied = copySlotFromParent(parentSlot, slotId)
      Object.assign(slot, copied)
      storeOutlineSource(slot, sourceId, parentId)
      return doc
    }
    slot.inheritMode = 'local'
    delete slot.inheritFromSlotId
    storeOutlineSource(slot, sourceId, parentId)
    return doc
  })

  if (state.ok) {
    state.message = sourceOnly
      ? `Particle will inherit from “${sourceId}”.`
      : mode === 'inherit'
        ? `Particle inherits from “${sourceId}”.`
        : `Particle is local.`
  }
  return state
}

/**
 * Snapshot parent particle into this slot as local.
 */
export async function copySlotFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot path.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const parentId = await parentOutlineId(document, layoutId)
  const sourceId = formSourceOutlineId(formData) || parentId
  if (!sourceId) return { error: 'This outline has no parent to copy from.' }
  const source = await loadResolvedOutline(sourceId)
  if (!source) return { error: `Layout “${sourceId}” was not found.` }
  const parentSlot = findSlotInSection(
    source.sections.find((section) => section.id === sectionId),
    slotId,
  )
  if (!parentSlot) {
    return { error: `That layout has no particle “${slotId}” in section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (section.inheritMode === 'inherit') {
      return { error: 'Section is inheriting structure — copy/localize the section first.' }
    }
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: `Slot “${slotId}” not found.` }
    const copied = copySlotFromParent(parentSlot, slotId)
    Object.assign(found.slot, copied)
    storeOutlineSource(found.slot, sourceId, parentId)
    return doc
  })

  if (state.ok) state.message = `Particle copied from “${sourceId}” (local).`
  return state
}

/**
 * Persist a particle/module instance display name on a layout slot.
 * Does not change `moduleId` (particle type). Empty name clears the override.
 */
export async function renameLayoutSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const name = sanitizeDisplayName(String(formData.get('name') ?? ''))

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (name) found.slot.name = name
    else delete found.slot.name
    return doc
  })

  if (state.ok) {
    state.message = name
      ? `Particle renamed to “${name}”.`
      : 'Particle display name cleared (uses catalog name).'
  }
  return state
}

/**
 * Create row containers for every side-by-side line that does not have one yet.
 * Existing container settings stay put.
 */
export async function ensureLayoutRowContainersAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const state = await mutateLayout(formData, (doc) => {
    assignSyncedRowContainers(doc)
    return doc
  })
  if (state.ok) state.message = 'Row containers updated.'
  return state
}

/**
 * Basic section settings on the automatic row container (name, container mode,
 * colors, spacing, HTML id, CSS classes). Member sections do not use container mode.
 */
export async function updateLayoutRowContainerMetaAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const rawIds = String(formData.get('sectionIdsJson') ?? '').trim()
  let sectionIds: string[]
  try {
    sectionIds = JSON.parse(rawIds) as string[]
    if (!Array.isArray(sectionIds) || sectionIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid row container sections.' }
  }
  const containerId = String(formData.get('containerId') ?? '').trim()

  const hasLabel = formData.has('label')
  const hasHtmlId = formData.has('htmlId')
  const hasCssClass = formData.has('cssClass')
  const hasContainerMode = formData.has('containerMode')
  const hasBackgroundColor = formData.has('backgroundColor')
  const hasTextColor = formData.has('textColor')
  const hasPadding = formData.has('padding')
  const hasMargin = formData.has('margin')
  if (
    !hasLabel &&
    !hasHtmlId &&
    !hasCssClass &&
    !hasContainerMode &&
    !hasBackgroundColor &&
    !hasTextColor &&
    !hasPadding &&
    !hasMargin
  ) {
    return { error: 'Nothing to update on this row container.' }
  }

  const patch: RowContainerPatch = {}
  if (hasLabel) {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) return { error: 'Container name is required.' }
    patch.label = label
  }
  if (hasHtmlId) {
    const htmlIdRaw = String(formData.get('htmlId') ?? '').trim()
    if (!htmlIdRaw) patch.htmlId = null
    else {
      const htmlId = sanitizeHtmlId(htmlIdRaw)
      if (!htmlId) {
        return {
          error:
            'HTML id is invalid. Use a letter or underscore first, then letters, digits, _, :, ., or -.',
        }
      }
      patch.htmlId = htmlId
    }
  }
  if (hasCssClass) {
    const cssClass = sanitizeCssClassList(String(formData.get('cssClass') ?? ''))
    patch.cssClass = cssClass ?? null
  }
  if (hasContainerMode) {
    const raw = String(formData.get('containerMode') ?? '').trim()
    if (raw !== 'full' && raw !== 'boxed') {
      return { error: 'Container mode must be full or boxed.' }
    }
    patch.containerMode = raw
  }
  if (hasBackgroundColor) {
    const raw = String(formData.get('backgroundColor') ?? '').trim()
    if (!raw) patch.backgroundColor = null
    else {
      const color = sanitizeCssColor(raw)
      if (!color) {
        return { error: 'Background color must be a hex value (e.g. #18191c) or transparent.' }
      }
      patch.backgroundColor = color
    }
  }
  if (hasTextColor) {
    const raw = String(formData.get('textColor') ?? '').trim()
    if (!raw) patch.textColor = null
    else {
      const color = sanitizeCssColor(raw)
      if (!color) {
        return { error: 'Text color must be a hex value (e.g. #ffffff) or transparent.' }
      }
      patch.textColor = color
    }
  }
  if (hasPadding) {
    const raw = String(formData.get('padding') ?? '').trim()
    if (!raw) patch.padding = null
    else {
      const padding = sanitizeCssBoxShorthand(raw, { allowNegative: false })
      if (!padding) {
        return {
          error:
            'Padding must be 1–4 lengths with the same px or rem unit (e.g. 1rem 1.5rem 1rem 1.5rem).',
        }
      }
      patch.padding = padding
    }
  }
  if (hasMargin) {
    const raw = String(formData.get('margin') ?? '').trim()
    if (!raw) patch.margin = null
    else {
      const margin = sanitizeCssBoxShorthand(raw, { allowNegative: true })
      if (!margin) {
        return {
          error: 'Margin must be 1–4 lengths with the same px or rem unit (e.g. 0 0 2rem 0).',
        }
      }
      patch.margin = margin
    }
  }

  const state = await mutateLayout(formData, (doc) => {
    const applied = applyRowContainerPatch(doc.sections, doc.rowContainers, {
      sectionIds,
      ...(containerId ? { containerId } : {}),
      patch,
    })
    if (!applied.ok) return { error: applied.error }
    doc.rowContainers = applied.containers
    return doc
  })
  if (state.ok) state.message = 'Row container saved.'
  return state
}

/**
 * Persist row order within one section after drag-and-drop reorder.
 * `orderJson` = JSON array of row ids top→bottom (vertical particle stack order).
 */
export async function reorderLayoutRowsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const raw = String(formData.get('orderJson') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid row order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Row order is empty.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }

    const byId = new Map(section.rows.map((r) => [r.id, r]))
    if (orderedIds.length !== section.rows.length) {
      return { error: 'Row order length does not match the section.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown row “${id}”.` }
    }

    section.rows = orderedIds.map((id, index) => {
      const row = byId.get(id)!
      row.order = index
      return row
    })
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/**
 * Persist slot order within one row after drag-and-drop reorder.
 * `orderJson` = JSON array of slot ids left→right. Widths are kept as-is.
 */
export async function reorderRowSlotsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const raw = String(formData.get('orderJson') ?? '').trim()
  if (!sectionId || !rowId) return { error: 'Missing row reference.' }

  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid slot order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Slot order is empty.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }

    const byId = new Map(found.row.slots.map((s) => [s.id, s]))
    if (orderedIds.length !== found.row.slots.length) {
      return { error: 'Slot order length does not match the row.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown slot “${id}”.` }
    }

    found.row.slots = orderedIds.map((id, index) => {
      const slot = byId.get(id)!
      slot.order = index
      return slot
    })
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/**
 * Move an existing particle from any section/row into another row (or reorder
 * inside the same row). Keeps slot id, config, name, access tags, enabled.
 * Source and destination rows rebalance % widths after the move.
 */
export async function moveSlotToRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sourceSectionId = String(formData.get('sourceSectionId') ?? '').trim()
  const sourceRowId = String(formData.get('sourceRowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const targetSectionId = String(formData.get('targetSectionId') ?? '').trim()
  const targetRowId = String(formData.get('targetRowId') ?? '').trim()
  const indexRaw = formData.get('index')
  const index =
    indexRaw != null && String(indexRaw) !== '' && Number.isFinite(Number(indexRaw))
      ? Math.max(0, Math.floor(Number(indexRaw)))
      : undefined

  if (!sourceSectionId || !sourceRowId || !slotId) {
    return { error: 'Missing source particle reference.' }
  }
  if (!targetSectionId || !targetRowId) {
    return { error: 'Drop onto a row inside a section.' }
  }

  const sameRow = sourceSectionId === targetSectionId && sourceRowId === targetRowId

  const state = await mutateLayout(formData, (doc) => {
    const source = findSlot(doc, sourceSectionId, sourceRowId, slotId)
    if (!source) return { error: 'Source particle not found.' }

    const dest = findRow(doc, targetSectionId, targetRowId)
    if (!dest) return { error: 'Destination row not found.' }

    if (sameRow) {
      const sorted = [...source.row.slots].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
      )
      const fromIndex = sorted.findIndex((s) => s.id === slotId)
      if (fromIndex < 0) return { error: 'Source particle not found.' }
      const destIndex =
        index == null ? sorted.length : Math.min(Math.max(0, index), sorted.length)
      if (destIndex === fromIndex || destIndex === fromIndex + 1) {
        return doc
      }
      const next = [...sorted]
      const [moved] = next.splice(fromIndex, 1)
      let insertAt = destIndex
      if (fromIndex < destIndex) insertAt = destIndex - 1
      insertAt = Math.max(0, Math.min(insertAt, next.length))
      next.splice(insertAt, 0, moved)
      source.row.slots = next.map((slot, i) => {
        slot.order = i
        return slot
      })
      return doc
    }

    const moved: LayoutSlot = structuredClone(source.slot)
    source.row.slots = source.row.slots.filter((s) => s.id !== slotId)
    source.row.slots.forEach((s, i) => {
      s.order = i
    })
    if (source.row.slots.length > 0) {
      rebalanceRowSlots(source.row)
    }

    const insertAt =
      index == null ? dest.row.slots.length : Math.min(Math.max(0, index), dest.row.slots.length)
    dest.row.slots.splice(insertAt, 0, moved)
    rebalanceRowSlots(dest.row)
    return doc
  })

  // Silent ok — canvas already moved; avoid noisy “into main” flashes.
  if (state.ok) state.message = undefined
  return state
}

/**
 * Stack a particle into its own full-width row, inserted before/after a target row
 * (vertical blue line — same idea as section mosaic above/below).
 * Solo-row → solo-row in the same section reorders rows instead of cloning.
 */
export async function stackSlotAsRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sourceSectionId = String(formData.get('sourceSectionId') ?? '').trim()
  const sourceRowId = String(formData.get('sourceRowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const targetSectionId = String(formData.get('targetSectionId') ?? '').trim()
  const targetRowId = String(formData.get('targetRowId') ?? '').trim()
  const positionRaw = String(formData.get('position') ?? '').trim()
  const position: 'before' | 'after' = positionRaw === 'after' ? 'after' : 'before'

  if (!sourceSectionId || !sourceRowId || !slotId) {
    return { error: 'Missing source particle reference.' }
  }
  if (!targetSectionId || !targetRowId) {
    return { error: 'Drop onto a row inside a section.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const source = findSlot(doc, sourceSectionId, sourceRowId, slotId)
    if (!source) return { error: 'Source particle not found.' }

    const targetSection = findSection(doc, targetSectionId)
    if (!targetSection) return { error: 'Destination section not found.' }

    const sortedTarget = [...targetSection.rows].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    const targetIndex = sortedTarget.findIndex((r) => r.id === targetRowId)
    if (targetIndex < 0) return { error: 'Destination row not found.' }

    const sameSection = sourceSectionId === targetSectionId
    const soloSource = source.row.slots.length === 1

    // Solo particle in the same section → reorder its row (no clone).
    if (sameSection && soloSource) {
      const fromIndex = sortedTarget.findIndex((r) => r.id === sourceRowId)
      if (fromIndex < 0) return { error: 'Source row not found.' }
      const destIndex = position === 'before' ? targetIndex : targetIndex + 1
      if (destIndex === fromIndex || destIndex === fromIndex + 1) {
        return doc
      }
      const next = [...sortedTarget]
      const [movedRow] = next.splice(fromIndex, 1)
      let insertAt = destIndex
      if (fromIndex < destIndex) insertAt = destIndex - 1
      insertAt = Math.max(0, Math.min(insertAt, next.length))
      next.splice(insertAt, 0, movedRow!)
      next.forEach((row, i) => {
        row.order = i
      })
      targetSection.rows = next
      ensureSectionEmptyRows(targetSection)
      return doc
    }

    const moved: LayoutSlot = structuredClone(source.slot)
    moved.width = LAYOUT_WIDTH_FULL
    moved.order = 0

    source.row.slots = source.row.slots.filter((s) => s.id !== slotId)
    source.row.slots.forEach((s, i) => {
      s.order = i
    })
    if (source.row.slots.length > 0) {
      rebalanceRowSlots(source.row)
    } else {
      const srcSection = findSection(doc, sourceSectionId)
      if (srcSection) {
        srcSection.rows = srcSection.rows.filter((r) => r.id !== sourceRowId)
        ensureSectionEmptyRows(srcSection)
      }
    }

    // Re-resolve target index after a same-section source-row removal.
    const rowsNow = [...targetSection.rows].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    const targetNow = rowsNow.findIndex((r) => r.id === targetRowId)
    if (targetNow < 0) return { error: 'Destination row not found.' }
    const insertAt = position === 'before' ? targetNow : targetNow + 1
    const newRow: LayoutRow = {
      id: newLayoutEntityId('row'),
      order: insertAt,
      slots: [moved],
    }
    rowsNow.splice(insertAt, 0, newRow)
    rowsNow.forEach((row, i) => {
      row.order = i
    })
    targetSection.rows = rowsNow
    ensureSectionEmptyRows(targetSection)
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/** UI + row: open one empty drop row at the end of a section (no-op if already trailing empty). */
export async function addLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    appendEmptyLayoutRow(section)
    return doc
  })

  if (state.ok) state.message = 'Empty row opened.'
  return state
}

/** UI − row: remove an empty drop row only (filled rows keep particles / use slot remove). */
export async function removeLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  if (!sectionId || !rowId) return { error: 'Missing section or row id.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (!removeEmptyLayoutRow(section, rowId)) {
      return { error: 'Only empty drop rows can be removed with − row.' }
    }
    return doc
  })

  if (state.ok) state.message = 'Empty row closed.'
  return state
}

/**
 * Drag-drop primary path: drop a palette particle into a row.
 * Inserts at `index` (optional) and rebalances widths to sum to 12.
 */
export async function dropParticleIntoRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  const indexRaw = formData.get('index')
  const index =
    indexRaw != null && String(indexRaw) !== '' && Number.isFinite(Number(indexRaw))
      ? Math.max(0, Math.floor(Number(indexRaw)))
      : undefined

  if (!sectionId || !rowId) return { error: 'Drop onto a row inside a section.' }
  if (!moduleId) return { error: 'Drag a particle from the left palette.' }

  await ensureModulesRegistered()
  const mod = getRegisteredModule(moduleId)
  if (!mod) return { error: `Particle “${moduleId}” is not registered.` }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found — add a row in the section first.' }

    const insertAt =
      index == null ? found.row.slots.length : Math.min(index, found.row.slots.length)
    const slot = makeSlot(moduleId, LAYOUT_WIDTH_FULL, insertAt)
    found.row.slots.splice(insertAt, 0, slot)
    rebalanceRowSlots(found.row)
    return doc
  })

  if (state.ok) state.message = `Dropped “${mod.name}” into the row.`
  return state
}

/** @deprecated Prefer dropParticleIntoRowAction — kept for transitional imports. */
export async function addParticleToSectionAction(
  prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  return dropParticleIntoRowAction(prev, formData)
}

/** Persist a single slot width (manual / accessibility). */
export async function setSlotWidthAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const width = clampGridWidth(formData.get('width'))
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    found.slot.width = width
    return doc
  })

  if (state.ok) state.message = `Width set to ${width}%.`
  return state
}

/**
 * Drag the divider between two adjacent particles: resize by % (stored as 1–12).
 * form: leftSlotId, rightSlotId, leftWidth
 */
export async function resizeAdjacentSlotsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const leftSlotId = String(formData.get('leftSlotId') ?? '').trim()
  const rightSlotId = String(formData.get('rightSlotId') ?? '').trim()
  const leftWidthRaw = Number(formData.get('leftWidth'))
  if (!sectionId || !rowId || !leftSlotId || !rightSlotId) {
    return { error: 'Missing resize pair.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    const left = found.row.slots.find((s) => s.id === leftSlotId)
    const right = found.row.slots.find((s) => s.id === rightSlotId)
    if (!left || !right) return { error: 'Adjacent slots not found.' }
    const [lw, rw] = resizeAdjacentPair(left.width, right.width, leftWidthRaw)
    left.width = lw
    right.width = rw
    return doc
  })

  if (state.ok) state.message = 'Widths updated.'
  return state
}

/** Set every slot width in a row (after a full redistribute). */
export async function setRowSlotWidthsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const raw = String(formData.get('widthsJson') ?? '')
  if (!sectionId || !rowId) return { error: 'Missing row reference.' }

  let widths: Array<{ slotId: string; width: number }>
  try {
    widths = JSON.parse(raw) as Array<{ slotId: string; width: number }>
    if (!Array.isArray(widths)) throw new Error('not array')
  } catch {
    return { error: 'Invalid widths payload.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    for (const entry of widths) {
      const slot = found.row.slots.find((s) => s.id === entry.slotId)
      if (slot) slot.width = clampGridWidth(entry.width)
    }
    return doc
  })

  if (state.ok) state.message = 'Row widths saved.'
  return state
}

export async function removeSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    const next = found.row.slots.filter((s) => s.id !== slotId)
    if (next.length === found.row.slots.length) return { error: 'Slot not found.' }
    found.row.slots = next
    rebalanceRowSlots(found.row)
    return doc
  })

  if (state.ok) state.message = 'Particle removed.'
  return state
}

export async function toggleSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    found.slot.enabled = found.slot.enabled === false
    return doc
  })

  if (state.ok) state.message = 'Particle toggled.'
  return state
}

/** Persist multi-tag view access on a layout slot (Nav-consistent; SF-45). */
export async function setSlotAccessTagsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  let rawTags: unknown = formData.get('accessTags')
  const asString = rawTags == null ? '' : String(rawTags).trim()
  if (asString.startsWith('[')) {
    try {
      rawTags = JSON.parse(asString) as unknown
    } catch {
      rawTags = asString
    }
  }
  const accessTags = accessTagsForStorage({ accessTags: rawTags })
  const label = (accessTags ?? normalizeAccessTags({})).join(', ')

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (accessTags) found.slot.accessTags = accessTags
    else delete found.slot.accessTags
    delete found.slot.accessLevel
    return doc
  })

  if (state.ok) {
    state.message = `Particle access set to ${label}.`
  }
  return state
}

/** @deprecated Prefer `setSlotAccessTagsAction` (multi-tag). */
export async function setSlotAccessLevelAction(
  prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const kind = String(formData.get('accessKind') ?? 'public').trim() || 'public'
  const groupId = String(formData.get('accessGroupId') ?? '').trim()
  const tags: string[] =
    kind === 'registered'
      ? ['registered']
      : kind === 'group' && groupId
        ? [`group:${groupId}`]
        : ['public']
  formData.set('accessTags', JSON.stringify(tags))
  return setSlotAccessTagsAction(prev, formData)
}

export async function listModulesForLayoutAdmin() {
  await ensureModulesRegistered()
  const {
    MODULE_IDS,
    getSiteSettings,
    isCatalogModuleEnabled,
    isParticleModuleEnabled,
  } = await import('@/core/settings')
  const settings = await getSiteSettings()
  const formsProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  const searchProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.search)
  const consentProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.consent)

  return listRegisteredModules()
    .filter((m) => {
      if (m.id === 'form' && !formsProductOn) return false
      if (m.id === 'search' && !searchProductOn) return false
      if (m.id === 'cookie-settings' && !consentProductOn) return false
      return isParticleModuleEnabled(settings, m.id, {
        builtin: m.builtin,
        featureFlag: m.featureFlag,
      })
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      builtin: Boolean(m.builtin),
      defaultWidth: m.defaultWidth ?? 100,
    }))
}

// Note: dynamic import avoids a circular init edge (settings catalog ↔ modules).

