'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { ensureModulesRegistered } from '@/modules/catalog'

import {
  cloneDefaultLayoutDocument,
  findPosition,
  findSection,
  slugifyLayoutId,
} from './document'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { getRegisteredModule, listRegisteredModules } from './registry'
import type { LayoutDocument, LayoutModuleAssignment, LayoutPosition, LayoutSection } from './types'

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
  // If we were on the JSON fallback, start from a clone so the first save
  // materializes the default into the DB rather than an empty document.
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
  const asContent = String(formData.get('content') ?? '') === 'true'

  const state = await mutateLayout((doc) => {
    if (doc.sections.some((s) => s.id === id)) {
      return { error: `Section id “${id}” already exists.` }
    }
    const maxOrder = doc.sections.reduce((m, s) => Math.max(m, s.order ?? 0), -1)
    const section: LayoutSection = {
      id,
      label,
      order: maxOrder + 1,
      ...(asContent ? { content: true } : {}),
      positions: [],
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

export async function addLayoutPositionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }
  if (!label) return { error: 'Position name is required.' }

  const requestedId = String(formData.get('id') ?? '').trim()
  const id = slugifyLayoutId(requestedId || label)
  const placementRaw = String(formData.get('placement') ?? '').trim()
  const placement =
    placementRaw === 'before' || placementRaw === 'after' ? placementRaw : undefined

  const state = await mutateLayout((doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (section.positions.some((p) => p.id === id)) {
      return { error: `Position id “${id}” already exists in this section.` }
    }
    // Position ids must be unique across the whole document (ModuleSlot key).
    for (const other of doc.sections) {
      if (other.positions.some((p) => p.id === id)) {
        return { error: `Position id “${id}” is already used in section “${other.label}”.` }
      }
    }
    const maxOrder = section.positions.reduce((m, p) => Math.max(m, p.order ?? 0), -1)
    const position: LayoutPosition = {
      id,
      label,
      order: maxOrder + 1,
      ...(section.content && placement ? { placement } : {}),
      modules: [],
    }
    section.positions.push(position)
    return doc
  })

  if (state.ok) state.message = `Position “${label}” added.`
  return state
}

export async function renameLayoutPositionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const positionId = String(formData.get('positionId') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!sectionId || !positionId) return { error: 'Missing section or position id.' }
  if (!label) return { error: 'Position name is required.' }

  const state = await mutateLayout((doc) => {
    const found = findPosition(doc, sectionId, positionId)
    if (!found) return { error: `Position “${positionId}” not found.` }
    found.position.label = label
    return doc
  })

  if (state.ok) state.message = `Position renamed to “${label}”.`
  return state
}

export async function assignModuleToPositionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const positionId = String(formData.get('positionId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  if (!sectionId || !positionId) return { error: 'Missing section or position id.' }
  if (!moduleId) return { error: 'Choose a module to assign.' }

  ensureModulesRegistered()
  if (!getRegisteredModule(moduleId)) {
    return { error: `Module “${moduleId}” is not registered.` }
  }

  const state = await mutateLayout((doc) => {
    const found = findPosition(doc, sectionId, positionId)
    if (!found) return { error: `Position “${positionId}” not found.` }
    if (found.position.modules.some((m) => m.moduleId === moduleId)) {
      return { error: `Module “${moduleId}” is already assigned here.` }
    }
    const maxOrder = found.position.modules.reduce((m, a) => Math.max(m, a.order ?? 0), -1)
    const assignment: LayoutModuleAssignment = {
      moduleId,
      enabled: true,
      order: maxOrder + 1,
    }
    found.position.modules.push(assignment)
    return doc
  })

  if (state.ok) {
    const mod = getRegisteredModule(moduleId)
    state.message = `Assigned “${mod?.name ?? moduleId}” to ${positionId}.`
  }
  return state
}

export async function removeModuleFromPositionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const positionId = String(formData.get('positionId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  if (!sectionId || !positionId || !moduleId) {
    return { error: 'Missing section, position, or module id.' }
  }

  const state = await mutateLayout((doc) => {
    const found = findPosition(doc, sectionId, positionId)
    if (!found) return { error: `Position “${positionId}” not found.` }
    const next = found.position.modules.filter((m) => m.moduleId !== moduleId)
    if (next.length === found.position.modules.length) {
      return { error: `Module “${moduleId}” is not assigned here.` }
    }
    found.position.modules = next
    return doc
  })

  if (state.ok) state.message = `Removed “${moduleId}” from ${positionId}.`
  return state
}

export async function toggleModuleAssignmentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const positionId = String(formData.get('positionId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  if (!sectionId || !positionId || !moduleId) {
    return { error: 'Missing section, position, or module id.' }
  }

  const state = await mutateLayout((doc) => {
    const found = findPosition(doc, sectionId, positionId)
    if (!found) return { error: `Position “${positionId}” not found.` }
    const assignment = found.position.modules.find((m) => m.moduleId === moduleId)
    if (!assignment) return { error: `Module “${moduleId}” is not assigned here.` }
    assignment.enabled = assignment.enabled === false
    return doc
  })

  if (state.ok) state.message = `Toggled “${moduleId}”.`
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
  return { ok: true, message: 'Layout reset to the default (notice bar → header).' }
}

/** Registered modules for the admin UI select lists. */
export async function listModulesForLayoutAdmin() {
  ensureModulesRegistered()
  return listRegisteredModules().map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description ?? '',
  }))
}
