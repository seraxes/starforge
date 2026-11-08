/**
 * product:profiles ↔ Forms bridge (server).
 * Pure config helpers live in `profile-form-config.ts`.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { sfForms } from '@/core/db/schema'
import {
  emptyFormDefinitionDocument,
  serializeFormDefinitionDocument,
} from '@/core/forms/definition'
import { loadFormDefinition } from '@/core/forms/definitions-store'
import { DEFAULT_PROFILE_FORM_ID } from '@/core/forms/presets'
import { createRowDraft, ensureFormSectionsEmptyRows } from '@/core/forms/rows'
import type { FormFieldDef, FormSectionDef } from '@/core/forms/types'

import { PROFILE_FIELD_GROUPS, PROFILE_FIELDS } from './fields'
import {
  profileFormConfigFromFields,
  profileFormNameForKey,
  type ProfileFormConfig,
} from './profile-form-config'

export { DEFAULT_PROFILE_FORM_ID }
export {
  applyProfileFormConfigToSettings,
  profileFieldKeyFromFormName,
  profileFormConfigFromFields,
  profileFormNameForKey,
  type ProfileFormConfig,
  type ProfileFormFieldConfig,
  type ProfileFormSection,
} from './profile-form-config'

function seedDocumentSections(fields: FormFieldDef[]): FormSectionDef[] {
  const byName = new Map(fields.map((f) => [f.name, f] as const))
  const sections: FormSectionDef[] = []
  for (const group of PROFILE_FIELD_GROUPS) {
    const rows = PROFILE_FIELDS.filter((f) => f.group === group.key)
      .map((f) => profileFormNameForKey(f.key))
      .filter((name) => byName.has(name))
      .map((name) => createRowDraft(name))
    if (rows.length === 0) continue
    sections.push({
      id: `sec_${group.key}`,
      label: group.label,
      rows,
      width: group.key === 'about' ? 100 : 50,
    })
  }
  return ensureFormSectionsEmptyRows(sections)
}

/** Idempotent insert of the protected `profile` Forms definition. */
export async function ensureProfileFormSeeded(): Promise<string> {
  try {
    const [row] = await db
      .select({ id: sfForms.id })
      .from(sfForms)
      .where(eq(sfForms.id, DEFAULT_PROFILE_FORM_ID))
      .limit(1)
    if (row) return row.id

    const document = emptyFormDefinitionDocument('profile')
    document.sections = seedDocumentSections(document.fields)
    await db.insert(sfForms).values({
      id: DEFAULT_PROFILE_FORM_ID,
      label: document.title,
      preset: 'profile',
      document: serializeFormDefinitionDocument(document),
    })
    return DEFAULT_PROFILE_FORM_ID
  } catch {
    return DEFAULT_PROFILE_FORM_ID
  }
}

export async function loadProfileFormConfig(): Promise<ProfileFormConfig> {
  await ensureProfileFormSeeded()
  const loaded = await loadFormDefinition(DEFAULT_PROFILE_FORM_ID)
  return profileFormConfigFromFields(loaded.document.fields, loaded.document.sections)
}
