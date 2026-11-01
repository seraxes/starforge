'use server'

import { revalidatePath } from 'next/cache'

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
  slugifyLayoutId,
} from './document'
import { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, resizeAdjacentPair } from './grid'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { defaultConfigForModule, readSocialConfig } from './particles/config'
import { getRegisteredModule, listRegisteredModules } from './registry'
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
  revalidatePath('/app/admin/outlines')
  revalidatePath('/app/admin/page-settings')
  if (layoutId && layoutId !== DEFAULT_LAYOUT_ID) {
    revalidatePath(`/app/admin/layouts?outline=${encodeURIComponent(layoutId)}`)
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

/**
 * Persist section display name and/or CSS classes from the layout canvas.
 * Section `id` is never changed. Empty cssClass clears the field.
 */
export async function updateLayoutSectionMetaAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const hasLabel = formData.has('label')
  const hasCssClass = formData.has('cssClass')
  if (!hasLabel && !hasCssClass) {
    return { error: 'Nothing to update on this section.' }
  }

  const label = hasLabel ? String(formData.get('label') ?? '').trim() : undefined
  if (hasLabel && !label) return { error: 'Section name is required.' }

  const cssClassRaw = hasCssClass ? String(formData.get('cssClass') ?? '') : undefined
  const cssClass = hasCssClass ? sanitizeCssClassList(cssClassRaw) : undefined

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (hasLabel && label) section.label = label
    if (hasCssClass) {
      if (cssClass) section.cssClass = cssClass
      else delete section.cssClass
    }
    return doc
  })

  if (state.ok) {
    const bits: string[] = []
    if (hasLabel && label) bits.push(`name “${label}”`)
    if (hasCssClass) bits.push(cssClass ? `classes “${cssClass}”` : 'classes cleared')
    state.message = `Section ${bits.join(' · ')} saved.`
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

/** Persist Joomla-style view access stub on a layout slot (SF-41 foundation). */
export async function setSlotAccessLevelAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const kind = String(formData.get('accessKind') ?? 'public').trim() || 'public'
  const groupId = String(formData.get('accessGroupId') ?? '').trim()
  let accessLevel: string | undefined
  if (kind === 'registered') accessLevel = 'registered'
  else if (kind === 'group' && groupId) accessLevel = `group:${groupId}`
  else accessLevel = undefined

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (accessLevel) found.slot.accessLevel = accessLevel
    else delete found.slot.accessLevel
    return doc
  })

  if (state.ok) {
    state.message = accessLevel
      ? `Particle access set to ${accessLevel}.`
      : 'Particle access set to public.'
  }
  return state
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

export async function updateLogoSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const maxWidthRaw = Number(formData.get('maxWidth'))
  const maxHeightRaw = Number(formData.get('maxHeight'))
  const config: LayoutSlotConfig = {
    mediaId: String(formData.get('mediaId') ?? '').trim(),
    mediaUrl: String(formData.get('mediaUrl') ?? '').trim(),
    alt: String(formData.get('alt') ?? '').trim() || 'Logo',
    linkUrl: String(formData.get('linkUrl') ?? '').trim(),
    ...(Number.isFinite(maxWidthRaw) && maxWidthRaw > 0
      ? { maxWidth: Math.round(maxWidthRaw) }
      : {}),
    ...(Number.isFinite(maxHeightRaw) && maxHeightRaw > 0
      ? { maxHeight: Math.round(maxHeightRaw) }
      : {}),
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (found.slot.moduleId !== 'logo') return { error: 'Not a Logo / Image particle.' }
    found.slot.config = config
    return doc
  })

  if (state.ok) state.message = 'Logo / Image saved.'
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
  const { getSiteSettings, isParticleModuleEnabled } = await import('@/core/settings')
  const settings = await getSiteSettings()

  return listRegisteredModules()
    .filter((m) =>
      isParticleModuleEnabled(settings, m.id, {
        builtin: m.builtin,
        featureFlag: m.featureFlag,
      }),
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      builtin: Boolean(m.builtin),
      defaultWidth: m.defaultWidth ?? 100,
    }))
}

// Note: dynamic import avoids a circular init edge (settings catalog ↔ modules).
