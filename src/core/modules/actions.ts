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
import { clampGridWidth } from './grid'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { getRegisteredModule, listRegisteredModules } from './registry'
import type { LayoutDocument, LayoutRow, LayoutSection, LayoutSlot, LayoutSlotConfig } from './types'

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

/** Click-to-add: place a particle into a section row (creates a row if needed). */
export async function addParticleToSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const widthRaw = formData.get('width')

  if (!sectionId) return { error: 'Choose a section on the canvas.' }
  if (!moduleId) return { error: 'Select a particle from the palette.' }

  ensureModulesRegistered()
  const mod = getRegisteredModule(moduleId)
  if (!mod) return { error: `Particle “${moduleId}” is not registered.` }

  const width = clampGridWidth(widthRaw ?? mod.defaultWidth ?? 12)

  const state = await mutateLayout((doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }

    let row = rowId ? section.rows.find((r) => r.id === rowId) : undefined
    if (!row) {
      // Prefer last row; create one if the section is empty.
      if (section.rows.length === 0) {
        row = { id: newLayoutEntityId(`${sectionId}-row`), order: 0, slots: [] }
        section.rows.push(row)
      } else {
        row = [...section.rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).at(-1)
      }
    }
    if (!row) return { error: 'Could not resolve a row.' }

    const maxOrder = row.slots.reduce((m, s) => Math.max(m, s.order ?? 0), -1)
    const slot: LayoutSlot = {
      id: newLayoutEntityId(`slot-${moduleId}`),
      moduleId,
      width,
      enabled: true,
      order: maxOrder + 1,
      ...(moduleId === 'custom'
        ? {
            config: {
              title: 'Custom',
              html: '<p>Custom HTML</p>',
              css: '',
              js: '',
            } satisfies LayoutSlotConfig,
          }
        : {}),
    }
    row.slots.push(slot)
    return doc
  })

  if (state.ok) state.message = `Added “${mod.name}” (${width}/12).`
  return state
}

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

  if (state.ok) state.message = `Width set to ${width}/12.`
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
    defaultWidth: m.defaultWidth ?? 12,
  }))
}
