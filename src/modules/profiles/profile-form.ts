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
import {
  loadFormDefinition,
  saveFormDefinitionDocument,
} from '@/core/forms/definitions-store'
import { DEFAULT_PROFILE_FORM_ID } from '@/core/forms/presets'
import { createRowDraft, ensureFormSectionsEmptyRows } from '@/core/forms/rows'
import type { FormFieldDef, FormSectionDef } from '@/core/forms/types'
import { LAYOUT_WIDTH_FULL } from '@/core/modules/grid'

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
      // Same default as Forms/Layout (`?? 100`) — half-width is opt-in via section settings.
      width: LAYOUT_WIDTH_FULL,
    })
  }
  return ensureFormSectionsEmptyRows(sections)
}

/**
 * Forms UI shows `section.width ?? 100`. Older profile docs omitted width, so the
 * front used to fall back to 50% while admin looked like 100%. Persist the default.
 * Also upgrades the first-ship seed that left Identity (and siblings) at 50% alone.
 */
function withExplicitSectionWidths(sections: FormSectionDef[]): {
  sections: FormSectionDef[]
  changed: boolean
} {
  let changed = false
  let next = sections.map((section) => {
    if (section.width != null && Number.isFinite(Number(section.width))) return section
    changed = true
    return { ...section, width: LAYOUT_WIDTH_FULL }
  })

  const seedSections = next.filter(
    (s) => typeof s.id === 'string' && s.id.startsWith('sec_'),
  )
  const nonAboutSeed = seedSections.filter((s) => s.id !== 'sec_about')
  const about = seedSections.find((s) => s.id === 'sec_about')
  const pristineHalfWidthSeed =
    nonAboutSeed.length > 0 &&
    nonAboutSeed.every((s) => s.width === 50) &&
    (about == null || about.width === LAYOUT_WIDTH_FULL)
  if (pristineHalfWidthSeed) {
    changed = true
    next = next.map((s) => (s.width === 50 ? { ...s, width: LAYOUT_WIDTH_FULL } : s))
  }

  return { sections: next, changed }
}

/** Idempotent insert of the protected `profile` Forms definition. */
export async function ensureProfileFormSeeded(): Promise<string> {
  try {
    const [row] = await db
      .select({ id: sfForms.id })
      .from(sfForms)
      .where(eq(sfForms.id, DEFAULT_PROFILE_FORM_ID))
      .limit(1)
    if (!row) {
      const document = emptyFormDefinitionDocument('profile')
      document.sections = seedDocumentSections(document.fields)
      await db.insert(sfForms).values({
        id: DEFAULT_PROFILE_FORM_ID,
        label: document.title,
        preset: 'profile',
        document: serializeFormDefinitionDocument(document),
      })
      return DEFAULT_PROFILE_FORM_ID
    }

    // Repair older docs that omitted section.width (Forms UI showed 100, front used 50).
    try {
      const loaded = await loadFormDefinition(DEFAULT_PROFILE_FORM_ID)
      const { sections, changed } = withExplicitSectionWidths(loaded.document.sections)
      if (changed) {
        await saveFormDefinitionDocument(
          DEFAULT_PROFILE_FORM_ID,
          { ...loaded.document, sections },
          loaded.document.title,
        )
      }
    } catch {
      // Insert path already succeeded; leave width repair for the next load.
    }
    return row.id
  } catch {
    return DEFAULT_PROFILE_FORM_ID
  }
}

export async function loadProfileFormConfig(): Promise<ProfileFormConfig> {
  await ensureProfileFormSeeded()
  const loaded = await loadFormDefinition(DEFAULT_PROFILE_FORM_ID)
  return profileFormConfigFromFields(loaded.document.fields, loaded.document.sections)
}
