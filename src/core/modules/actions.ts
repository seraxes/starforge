'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { ensureModulesRegistered } from '@/modules/catalog'

import {
  cloneDefaultLayoutDocument,
  findRow,
  findSection,
  findSlot,
  newLayoutEntityId,
  slugifyLayoutId,
} from './document'
import { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, resizeAdjacentPair } from './grid'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { getRegisteredModule, listRegisteredModules } from './registry'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot, LayoutSlotConfig } from './types'

function customDefaultConfig(): LayoutSlotConfig {
  return {
    title: 'Custom',
    html: '<p>Custom HTML</p>',
    css: '',
    js: '',
  }
}

function makeSlot(moduleId: string, width: number, order: number): LayoutSlot {
  return {
    id: newLayoutEntityId(`slot-${moduleId}`),
    moduleId,
    width: clampGridWidth(width, LAYOUT_WIDTH_FULL),
    enabled: true,
    order,
    ...(moduleId === 'custom' ? { config: customDefaultConfig() } : {}),
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

function revalidateLayoutPaths() {
  revalidatePath('/', 'layout')
  revalidatePath('/app/admin/layouts')
}

async function mutateLayout(
  mutator: (doc: LayoutDocument) => LayoutDocument | { error: string },
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const { document } = await loadLayoutDocument()
  const working =
    document.sections.length > 0 ? structuredClone(document) : cloneDefaultLayoutDocument()

  const result = mutator(working)
  if ('error' in result) return { error: result.error }

  try {
    await saveLayoutDocument(result)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths()
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    section.label = label
    return doc
  })

  if (state.ok) state.message = `Section renamed to “${label}”.`
  return state
}

export async function addLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
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

  const state = await mutateLayout((doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    found.slot.enabled = found.slot.enabled === false
    return doc
  })

  if (state.ok) state.message = 'Particle toggled.'
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

  const state = await mutateLayout((doc) => {
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

export async function resetLayoutToDefaultAction(
  _prev: LayoutActionState,
  _formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  try {
    await saveLayoutDocument(cloneDefaultLayoutDocument())
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not reset the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths()
  return {
    ok: true,
    message: 'Layout reset to default (notice-bar, site-header, page-content, custom footer).',
  }
}

export async function listModulesForLayoutAdmin() {
  ensureModulesRegistered()
  return listRegisteredModules().map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description ?? '',
    builtin: Boolean(m.builtin),
    defaultWidth: m.defaultWidth ?? 100,
  }))
}
