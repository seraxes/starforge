/**
 * product:profiles ↔ Forms bridge (server).
 * Pure config helpers live in `profile-form-config.ts`.
 */

import 'server-only'

import {
  DEFAULT_PROFILE_FORM_ID,
  createRowDraft,
  emptyFormDefinitionDocument,
  ensureFormDefinitionSeed,
  ensureFormSectionsEmptyRows,
  loadFormDefinition,
  type FormFieldDef,
  type FormSectionDef,
} from '@/modules/forms/api'
import { PROFILE_FIELD_GROUPS, PROFILE_FIELDS } from './fields'
import {
  PROFILE_CARD_WIDTH,
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
      width: PROFILE_CARD_WIDTH,
    })
  }
  return ensureFormSectionsEmptyRows(sections)
}

/** Idempotent insert of the protected `profile` Forms definition. Later edits stay in the Form builder. */
export async function ensureProfileFormSeeded(): Promise<string> {
  const document = emptyFormDefinitionDocument('profile')
  document.sections = seedDocumentSections(document.fields)
  const seeded = await ensureFormDefinitionSeed({
    id: DEFAULT_PROFILE_FORM_ID,
    document,
  })
  return seeded.id
}

export async function loadProfileFormConfig(): Promise<ProfileFormConfig> {
  await ensureProfileFormSeeded()
  const loaded = await loadFormDefinition(DEFAULT_PROFILE_FORM_ID)
  return profileFormConfigFromFields(loaded.document.fields, loaded.document.sections)
}
