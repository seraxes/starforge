'use server'

import { revalidatePath } from 'next/cache'

import { accessTagsForStorage, normalizeAccessTags } from '@/core/acl/nav-access'
import { requireAppAdmin } from '@/core/auth/admin'
import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { ensureModulesRegistered } from '@/modules/catalog'

import {
  cloneDefaultLayoutDocument,
  findRow,
  findSection,
  findSlot,
  newLayoutEntityId,
  sanitizeCssClassList,
  sanitizeDisplayName,
  sanitizeHtmlId,
  slugifyLayoutId,
} from './document'
import { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, resizeAdjacentPair } from './grid'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { defaultConfigForModule, readSocialConfig } from './particles/config'
import { getRegisteredModule, listRegisteredModules } from './registry'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  normalizeLayoutBreakpoints,
  normalizeLayoutSectionStyles,
  parseCssColorInput,
  sanitizeCssColor,
  type LayoutBreakpoints,
  type LayoutContainerMode,
  type LayoutSectionStyles,
} from './styles'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot, LayoutSlotConfig } from './types'

/** Resolve outline id from form (`layoutId`) — defaults to Base Outline. */
function layoutIdFromForm(formData: FormData | null | undefined): string {
  const raw = formData ? String(formData.get('layoutId') ?? '').trim() : ''
  return raw || DEFAULT_LAYOUT_ID
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

export type LayoutActionState = {
  error?: string
  ok?: boolean
  message?: string
  /** Saved particle config echoed for client hydrate after typed-slot saves. */
  config?: LayoutSlotConfig
  /** Saved HTML id / CSS class echoed for client hydrate after attribute saves. */
  slotAttrs?: { htmlId?: string; cssClass?: string }
}

async function requireLayoutAdmin(): Promise<LayoutActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit the layout.' }
  }
  return null
}

function revalidateLayoutPaths(layoutId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/app/admin/layouts')
  revalidatePath('/app/admin/breakpoints')
  revalidatePath('/app/admin/outlines')
  revalidatePath('/app/admin/page-settings')
  if (layoutId && layoutId !== DEFAULT_LAYOUT_ID) {
    revalidatePath(`/app/admin/layouts?outline=${encodeURIComponent(layoutId)}`)
    revalidatePath(`/app/admin/breakpoints?outline=${encodeURIComponent(layoutId)}`)
  }
}

async function mutateLayout(
  formData: FormData,
  mutator: (doc: LayoutDocument) => LayoutDocument | { error: string },
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const working =
    document.sections.length > 0 ? structuredClone(document) : cloneDefaultLayoutDocument()

  const result = mutator(working)
  if ('error' in result) return { error: result.error }

  try {
    await saveLayoutDocument(result, layoutId)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths(layoutId)
  return { ok: true }
}

export async function addLayoutSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return { error: 'Section name is required.' }

  const requestedId = String(formData.get('id') ?? '').trim()
  const id = slugifyLayoutId(requestedId || label)

  const state = await mutateLayout(formData, (doc) => {
    if (doc.sections.some((s) => s.id === id)) {
      return { error: `Section id “${id}” already exists.` }
    }
    const maxOrder = doc.sections.reduce((m, s) => Math.max(m, s.order ?? 0), -1)
    const section: LayoutSection = {
      id,
      label,
      order: maxOrder + 1,
      rows: [
        {
          id: newLayoutEntityId(`${id}-row`),
          order: 0,
          slots: [],
        },
      ],
    }
    doc.sections.push(section)
    return doc
  })

  if (state.ok) state.message = `Section “${label}” added.`
  return state
}

export async function renameLayoutSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }
  if (!label) return { error: 'Section name is required.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    section.label = label
    return doc
  })

  if (state.ok) state.message = `Section renamed to “${label}”.`
  return state
}

function patchSectionStyles(
  current: LayoutSectionStyles | undefined,
  patch: Partial<LayoutSectionStyles> & {
    clearBackgroundColor?: boolean
    clearTextColor?: boolean
  },
): LayoutSectionStyles | undefined {
  const next: LayoutSectionStyles = { ...(current ?? {}) }
  if (patch.clearBackgroundColor) delete next.backgroundColor
  else if (patch.backgroundColor !== undefined) next.backgroundColor = patch.backgroundColor
  if (patch.clearTextColor) delete next.textColor
  else if (patch.textColor !== undefined) next.textColor = patch.textColor
  return normalizeLayoutSectionStyles(next)
}

/**
 * Persist section display name, CSS classes, container mode, and/or Section Styles
 * (background + text). Section `id` is never changed. Empty cssClass / colors clear.
 */
export async function updateLayoutSectionMetaAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const hasLabel = formData.has('label')
  const hasCssClass = formData.has('cssClass')
  const hasContainerMode = formData.has('containerMode')
  const hasBackgroundColor = formData.has('backgroundColor')
  const hasTextColor = formData.has('textColor')
  if (!hasLabel && !hasCssClass && !hasContainerMode && !hasBackgroundColor && !hasTextColor) {
    return { error: 'Nothing to update on this section.' }
  }

  const label = hasLabel ? String(formData.get('label') ?? '').trim() : undefined
  if (hasLabel && !label) return { error: 'Section name is required.' }

  const cssClassRaw = hasCssClass ? String(formData.get('cssClass') ?? '') : undefined
  const cssClass = hasCssClass ? sanitizeCssClassList(cssClassRaw) : undefined

  let containerMode: LayoutContainerMode | undefined
  if (hasContainerMode) {
    const raw = String(formData.get('containerMode') ?? '').trim()
    if (raw !== 'full' && raw !== 'boxed') {
      return { error: 'Container mode must be full or boxed.' }
    }
    containerMode = raw
  }

  let backgroundColor: string | undefined
  let clearBackgroundColor = false
  if (hasBackgroundColor) {
    const raw = String(formData.get('backgroundColor') ?? '').trim()
    if (!raw) {
      clearBackgroundColor = true
    } else {
      backgroundColor = sanitizeCssColor(raw)
      if (!backgroundColor) {
        return { error: 'Background color must be a hex value (e.g. #18191c) or transparent.' }
      }
    }
  }

  let textColor: string | undefined
  let clearTextColor = false
  if (hasTextColor) {
    const raw = String(formData.get('textColor') ?? '').trim()
    if (!raw) {
      clearTextColor = true
    } else {
      textColor = sanitizeCssColor(raw)
      if (!textColor) {
        return { error: 'Text color must be a hex value (e.g. #ffffff) or transparent.' }
      }
    }
  }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (hasLabel && label) section.label = label
    if (hasCssClass) {
      if (cssClass) section.cssClass = cssClass
      else delete section.cssClass
    }
    if (hasContainerMode && containerMode) {
      section.containerMode = containerMode
    }
    if (hasBackgroundColor || hasTextColor) {
      const nextStyles = patchSectionStyles(section.styles, {
        ...(hasBackgroundColor
          ? clearBackgroundColor
            ? { clearBackgroundColor: true }
            : { backgroundColor }
          : {}),
        ...(hasTextColor
          ? clearTextColor
            ? { clearTextColor: true }
            : { textColor }
          : {}),
      })
      if (nextStyles) section.styles = nextStyles
      else delete section.styles
    }
    return doc
  })

  if (state.ok) {
    const bits: string[] = []
    if (hasLabel && label) bits.push(`name “${label}”`)
    if (hasCssClass) bits.push(cssClass ? `classes “${cssClass}”` : 'classes cleared')
    if (hasContainerMode && containerMode) bits.push(`container ${containerMode}`)
    if (hasBackgroundColor) {
      bits.push(
        clearBackgroundColor
          ? 'background cleared'
          : `background ${backgroundColor}`,
      )
    }
    if (hasTextColor) {
      bits.push(clearTextColor ? 'text color cleared' : `text ${textColor}`)
    }
    state.message = `Section ${bits.join(' · ')} saved.`
  }
  return state
}

/**
 * Persist outline-scoped breakpoint map (Layouts → Breakpoints child panel).
 * Values are CSS lengths (rem preferred). Empty fields fall back to Helium defaults.
 */
export async function updateLayoutBreakpointsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const raw: Partial<LayoutBreakpoints> = {
    largeDesktop: String(formData.get('largeDesktop') ?? '').trim() || undefined,
    desktop: String(formData.get('desktop') ?? '').trim() || undefined,
    tablet: String(formData.get('tablet') ?? '').trim() || undefined,
    mobile: String(formData.get('mobile') ?? '').trim() || undefined,
    mobileMenu: String(formData.get('mobileMenu') ?? '').trim() || undefined,
  }

  const breakpoints = normalizeLayoutBreakpoints({
    ...DEFAULT_LAYOUT_BREAKPOINTS,
    ...raw,
  })

  const state = await mutateLayout(formData, (doc) => {
    doc.styles = { ...(doc.styles ?? {}), breakpoints }
    return doc
  })

  if (state.ok) {
    state.message = `Breakpoints saved for outline “${layoutId}”.`
  }
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
 * Persist section order after drag-and-drop reorder on the layout canvas.
 * `orderJson` = JSON array of section ids top→bottom.
 */
export async function reorderLayoutSectionsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const raw = String(formData.get('orderJson') ?? '').trim()
  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid section order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Section order is empty.' }

  const state = await mutateLayout(formData, (doc) => {
    const byId = new Map(doc.sections.map((s) => [s.id, s]))
    if (orderedIds.length !== doc.sections.length) {
      return { error: 'Section order length does not match the layout.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown section “${id}”.` }
    }
    doc.sections = orderedIds.map((id, index) => {
      const section = byId.get(id)!
      section.order = index
      return section
    })
    return doc
  })

  if (state.ok) state.message = 'Section order saved.'
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

  if (state.ok) state.message = 'Particle order saved.'
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

  if (state.ok) {
    state.message = sameRow
      ? 'Particle order saved.'
      : `Moved particle into ${targetSectionId}.`
  }
  return state
}

export async function addLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    const maxOrder = section.rows.reduce((m, r) => Math.max(m, r.order ?? 0), -1)
    const row: LayoutRow = {
      id: newLayoutEntityId(`${sectionId}-row`),
      order: maxOrder + 1,
      slots: [],
    }
    section.rows.push(row)
    return doc
  })

  if (state.ok) state.message = 'Row added.'
  return state
}

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
    const next = section.rows.filter((r) => r.id !== rowId)
    if (next.length === section.rows.length) return { error: 'Row not found.' }
    section.rows = next
    return doc
  })

  if (state.ok) state.message = 'Row removed.'
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

  ensureModulesRegistered()
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

export async function updateCustomSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const config: LayoutSlotConfig = {
    title: String(formData.get('title') ?? '').trim(),
    html: String(formData.get('html') ?? ''),
    css: String(formData.get('css') ?? ''),
    js: String(formData.get('js') ?? ''),
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'custom') {
      return { error: 'Only Custom particles have HTML/CSS/JS config.' }
    }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Custom particle saved.'
  return state
}

/** Optional HTML id + CSS classes on any particle (public column wrapper). */
export async function updateSlotAttributesAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const htmlIdRaw = String(formData.get('htmlId') ?? '').trim()
  let htmlId: string | undefined
  if (htmlIdRaw) {
    htmlId = sanitizeHtmlId(htmlIdRaw)
    if (!htmlId) {
      return {
        error:
          'HTML id must start with a letter or underscore and use only letters, digits, _, :, ., or -.',
      }
    }
  }

  const cssClassRaw = String(formData.get('cssClass') ?? '')
  const cssClassTyped = cssClassRaw.trim()
  const cssClass = sanitizeCssClassList(cssClassRaw)
  if (cssClassTyped && !cssClass) {
    return {
      error:
        'CSS class tokens must start with a letter or underscore (letters, digits, _, - only).',
    }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (htmlId) found.slot.htmlId = htmlId
    else delete found.slot.htmlId
    if (cssClass) found.slot.cssClass = cssClass
    else delete found.slot.cssClass
    return doc
  })

  if (state.ok) {
    state.message = 'Particle attributes saved.'
    state.slotAttrs = {
      ...(htmlId ? { htmlId } : {}),
      ...(cssClass ? { cssClass } : {}),
    }
  }
  return state
}

export async function updateLogoSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const mode = String(formData.get('mode') ?? 'image') === 'text' ? 'text' : 'image'
  const colorRaw = String(formData.get('color') ?? '').trim()
  const colorParsed = parseCssColorInput(colorRaw)
  if (colorParsed.status === 'invalid') {
    return {
      error: 'Color must be a CSS color (hex, rgb/rgba, hsl/hsla, or named). Leave blank to inherit.',
    }
  }
  const color = colorParsed.status === 'ok' ? colorParsed.value : ''

  const maxWidthRaw = Number(formData.get('maxWidth'))
  const maxHeightRaw = Number(formData.get('maxHeight'))
  const fontSizeRaw = Number(formData.get('fontSize'))
  const fontWeightRaw = String(formData.get('fontWeight') ?? '').trim()
  const fontWeightNum = Number(fontWeightRaw)
  const config: LayoutSlotConfig = {
    mode,
    mediaId: String(formData.get('mediaId') ?? '').trim(),
    mediaUrl: String(formData.get('mediaUrl') ?? '').trim(),
    alt: String(formData.get('alt') ?? '').trim() || 'Logo',
    linkUrl: String(formData.get('linkUrl') ?? '').trim(),
    text: String(formData.get('text') ?? '').trim(),
    fontFamily: String(formData.get('fontFamily') ?? '').trim(),
    color,
    ...(Number.isFinite(maxWidthRaw) && maxWidthRaw > 0
      ? { maxWidth: Math.round(maxWidthRaw) }
      : {}),
    ...(Number.isFinite(maxHeightRaw) && maxHeightRaw > 0
      ? { maxHeight: Math.round(maxHeightRaw) }
      : {}),
    ...(Number.isFinite(fontSizeRaw) && fontSizeRaw > 0
      ? { fontSize: Math.round(fontSizeRaw) }
      : {}),
    fontWeight: Number.isFinite(fontWeightNum) && fontWeightNum > 0
      ? Math.round(fontWeightNum)
      : fontWeightRaw || 700,
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'logo') return { error: 'Not a Logo / Image particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) {
    state.message = 'Logo / Image saved.'
    state.config = config
  }
  return state
}

export async function updateMenuSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const menuIdRaw = String(formData.get('menuId') ?? '').trim()
  const config: LayoutSlotConfig = {
    menuId: menuIdRaw === 'primary' ? '' : menuIdRaw,
    ariaLabel: String(formData.get('ariaLabel') ?? '').trim() || 'Primary',
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'menu') return { error: 'Not a Menu particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Menu settings saved.'
  return state
}

export async function updateCopyrightSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const yearMode = String(formData.get('yearMode') ?? 'auto') === 'manual' ? 'manual' : 'auto'
  const yearRaw = Number(formData.get('year'))
  const config: LayoutSlotConfig = {
    text: String(formData.get('text') ?? '').trim(),
    yearMode,
    year: Number.isFinite(yearRaw) ? Math.round(yearRaw) : new Date().getFullYear(),
    linkUrl: String(formData.get('linkUrl') ?? '').trim(),
    linkLabel: String(formData.get('linkLabel') ?? '').trim(),
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'copyright') return { error: 'Not a Copyright particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Copyright saved.'
  return state
}

export async function updateSocialSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('itemsJson') ?? '[]'))
  } catch {
    return { error: 'Invalid social items JSON.' }
  }
  if (!Array.isArray(parsed)) return { error: 'Social items must be an array.' }

  const config: LayoutSlotConfig = { items: readSocialConfig({ items: parsed }).items }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'social') return { error: 'Not a Social particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Social links saved.'
  return state
}

export async function updateFormSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  let parsedFields: unknown
  try {
    parsedFields = JSON.parse(String(formData.get('fieldsJson') ?? '[]'))
  } catch {
    return { error: 'Invalid fields JSON.' }
  }

  const { formConfigToSlotConfig, normalizeFormFields } = await import('@/core/forms/config')
  const config: LayoutSlotConfig = formConfigToSlotConfig({
    heading: String(formData.get('heading') ?? '').trim(),
    fields: normalizeFormFields(parsedFields),
    successMessage: String(formData.get('successMessage') ?? '').trim(),
    submitLabel: String(formData.get('submitLabel') ?? '').trim() || 'Send',
    useSiteCaptchaDefault: String(formData.get('useSiteCaptchaDefault') ?? '') === 'on',
  })

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'form') return { error: 'Not a Form particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Form settings saved.'
  return state
}

export async function resetLayoutToDefaultAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)

  try {
    await saveLayoutDocument(cloneDefaultLayoutDocument(), layoutId)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not reset the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths(layoutId)
  return {
    ok: true,
    message: 'Layout reset to default (notice-bar, site-header, page-content, custom footer).',
  }
}

export async function listModulesForLayoutAdmin() {
  ensureModulesRegistered()
  const {
    MODULE_IDS,
    getSiteSettings,
    isCatalogModuleEnabled,
    isParticleModuleEnabled,
  } = await import('@/core/settings')
  const settings = await getSiteSettings()
  const formsProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)

  return listRegisteredModules()
    .filter((m) => {
      if (m.id === 'form' && !formsProductOn) return false
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
