import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfForms } from './schema'

import {
  DEFAULT_CONTACT_FORM_ID,
  emptyFormDefinitionDocument,
  normalizeFormDefinitionDocument,
  parseFormDefinitionJson,
  serializeFormDefinitionDocument,
  slugifyFormId,
} from './definition'
import {
  DEFAULT_PROFILE_FORM_ID,
  isFormPresetId,
  isProtectedFormDefinitionId,
} from './presets'
import { fieldsToJsonSchema } from './schema-json'
import type {
  FormDefinitionDocument,
  FormDefinitionMeta,
  FormPresetId,
} from './types'

export type FormDefinitionLoadResult = {
  id: string
  label: string
  document: FormDefinitionDocument
  source: 'database' | 'empty'
  isFallback: boolean
}

function displayLabel(id: string, label: string | null | undefined, title?: string): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (trimmed) return trimmed
  if (title?.trim()) return title.trim()
  if (id === DEFAULT_CONTACT_FORM_ID) return 'Contact'
  if (id === DEFAULT_PROFILE_FORM_ID) return 'Profile'
  return id
}

export async function listFormDefinitions(): Promise<FormDefinitionMeta[]> {
  try {
    const rows = await db
      .select({
        id: sfForms.id,
        label: sfForms.label,
        preset: sfForms.preset,
        document: sfForms.document,
        createdAt: sfForms.createdAt,
        updatedAt: sfForms.updatedAt,
      })
      .from(sfForms)
      .orderBy(asc(sfForms.label), asc(sfForms.id))

    return rows.map((row) => {
      const doc = parseFormDefinitionJson(row.document)
      const preset: FormPresetId = isFormPresetId(row.preset) ? row.preset : doc.preset
      return {
        id: row.id,
        label: displayLabel(row.id, row.label, doc.title),
        preset,
        fieldCount: doc.fields.length,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    })
  } catch {
    return []
  }
}

export async function loadFormDefinition(formId: string): Promise<FormDefinitionLoadResult> {
  const id = (formId || '').trim()
  if (!id) {
    return {
      id: '',
      label: 'Untitled',
      document: emptyFormDefinitionDocument('blank'),
      source: 'empty',
      isFallback: true,
    }
  }

  try {
    const [row] = await db
      .select({
        id: sfForms.id,
        label: sfForms.label,
        document: sfForms.document,
      })
      .from(sfForms)
      .where(eq(sfForms.id, id))
      .limit(1)

    if (row) {
      const document = parseFormDefinitionJson(row.document)
      return {
        id: row.id,
        label: displayLabel(row.id, row.label, document.title),
        document,
        source: 'database',
        isFallback: false,
      }
    }
  } catch {
    // Table may not exist yet.
  }

  if (id === DEFAULT_CONTACT_FORM_ID) {
    return {
      id,
      label: 'Contact',
      document: emptyFormDefinitionDocument('contact'),
      source: 'empty',
      isFallback: true,
    }
  }

  if (id === DEFAULT_PROFILE_FORM_ID) {
    return {
      id,
      label: 'Profile',
      document: emptyFormDefinitionDocument('profile'),
      source: 'empty',
      isFallback: true,
    }
  }

  return {
    id,
    label: displayLabel(id, null),
    document: emptyFormDefinitionDocument('blank'),
    source: 'empty',
    isFallback: true,
  }
}

export async function saveFormDefinitionDocument(
  formId: string,
  document: FormDefinitionDocument,
  label?: string,
): Promise<FormDefinitionDocument> {
  const id = formId.trim()
  if (!id) throw new Error('Missing form id.')

  const normalized = normalizeFormDefinitionDocument(document)
  if (!normalized.schemaDirty) {
    normalized.schema = fieldsToJsonSchema(normalized.fields, {
      title: normalized.title,
      description: normalized.description,
    })
  }

  const display =
    (typeof label === 'string' && label.trim()) ||
    normalized.title ||
    id

  const payload = {
    id,
    label: display,
    preset: normalized.preset,
    document: serializeFormDefinitionDocument(normalized),
  }

  try {
    const [existing] = await db
      .select({ id: sfForms.id })
      .from(sfForms)
      .where(eq(sfForms.id, id))
      .limit(1)

    if (existing) {
      await db
        .update(sfForms)
        .set({
          label: payload.label,
          preset: payload.preset,
          document: payload.document,
        })
        .where(eq(sfForms.id, id))
    } else {
      await db.insert(sfForms).values(payload)
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save form definition.'
    throw new Error(message)
  }

  return normalized
}

export async function createFormDefinition(input: {
  label: string
  id?: string
  preset?: FormPresetId
  copyFromId?: string
}): Promise<{ id: string; document: FormDefinitionDocument }> {
  const preset: FormPresetId = isFormPresetId(input.preset) ? input.preset : 'contact'
  let document = emptyFormDefinitionDocument(preset)

  if (input.copyFromId?.trim()) {
    const source = await loadFormDefinition(input.copyFromId.trim())
    if (!source.isFallback || source.source === 'database') {
      document = normalizeFormDefinitionDocument({
        ...source.document,
        title: input.label.trim() || source.document.title,
      })
    }
  }

  if (input.label.trim()) {
    document.title = input.label.trim()
    if (!document.schemaDirty) {
      document.schema = fieldsToJsonSchema(document.fields, {
        title: document.title,
        description: document.description,
      })
    }
  }

  const id =
    (input.id?.trim() && slugifyFormId(input.id.trim())) ||
    slugifyFormId(input.label || preset)

  // Avoid collisions
  let finalId = id
  const existing = await listFormDefinitions()
  const taken = new Set(existing.map((m) => m.id))
  if (taken.has(finalId)) {
    let n = 2
    while (taken.has(`${id}-${n}`)) n += 1
    finalId = `${id}-${n}`
  }

  await saveFormDefinitionDocument(finalId, document, document.title)
  return { id: finalId, document }
}

export async function deleteFormDefinition(formId: string): Promise<void> {
  const id = formId.trim()
  if (!id) throw new Error('Missing form id.')
  if (isProtectedFormDefinitionId(id)) {
    throw new Error('This built-in form cannot be deleted.')
  }
  await db.delete(sfForms).where(eq(sfForms.id, id))
}

export async function duplicateFormDefinition(
  formId: string,
  label?: string,
): Promise<{ id: string }> {
  const source = await loadFormDefinition(formId)
  if (source.isFallback && source.source !== 'database' && formId !== DEFAULT_CONTACT_FORM_ID) {
    throw new Error('Form not found.')
  }
  const newLabel = label?.trim() || `${source.label} copy`
  const created = await createFormDefinition({
    label: newLabel,
    preset: source.document.preset,
    copyFromId: source.id,
  })
  return { id: created.id }
}

export type FormDefinitionSeedState = 'exists' | 'inserted' | 'unavailable'

export type FormDefinitionSeedResult = {
  id: string
  /**
   * exists: row already present (callers may repair it).
   * inserted: this call wrote the row.
   * unavailable: table or database error. Same soft-fail as the old seeders,
   * which returned the id and left the next request to try again.
   */
  state: FormDefinitionSeedState
}

/**
 * Insert a form definition when its id is missing.
 * Does not update an existing row. Pack seeders call this through `forms/api`.
 */
export async function ensureFormDefinitionSeed(input: {
  id: string
  document: FormDefinitionDocument
  /** Stored label. Defaults to `document.title`, matching the pack seeders. */
  label?: string
}): Promise<FormDefinitionSeedResult> {
  const id = input.id.trim()
  if (!id) return { id: '', state: 'unavailable' }

  try {
    const [row] = await db
      .select({ id: sfForms.id })
      .from(sfForms)
      .where(eq(sfForms.id, id))
      .limit(1)
    if (row) return { id: row.id, state: 'exists' }

    const label = input.label !== undefined ? input.label : (input.document.title ?? '')
    await db.insert(sfForms).values({
      id,
      label,
      preset: input.document.preset,
      document: serializeFormDefinitionDocument(input.document),
    })
    return { id, state: 'inserted' }
  } catch {
    return { id, state: 'unavailable' }
  }
}

/** Ensure default Contact definition exists (idempotent). */
export async function ensureDefaultContactFormSeeded(): Promise<void> {
  const document = emptyFormDefinitionDocument('contact')
  await ensureFormDefinitionSeed({
    id: DEFAULT_CONTACT_FORM_ID,
    document,
  })
}
