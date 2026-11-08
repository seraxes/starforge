/**
 * product:profiles ↔ Forms config (client-safe pure helpers).
 * Server seed/load lives in `profile-form.ts`.
 */

import type { FormFieldDef, FormFieldOption, FormSectionDef } from '@/core/forms/types'
import { clampGridWidth, LAYOUT_WIDTH_FULL } from '@/core/modules/grid'

import {
  PROFILE_FIELD_GROUPS,
  PROFILE_FIELDS,
  getProfileField,
  isProfileFieldKey,
  type ProfileFieldKey,
} from './fields'
import type { ProfilesModuleSettings } from './types'

/** Forms field `name` → registry key (names are snake_case / slugified). */
const FORM_NAME_TO_KEY: Record<string, ProfileFieldKey> = {
  display_name: 'displayName',
  displayname: 'displayName',
  handle: 'handle',
  headline: 'headline',
  avatar: 'avatar',
  cover: 'cover',
  bio: 'bio',
  birth_date: 'birthDate',
  birthdate: 'birthDate',
  gender: 'gender',
  country: 'country',
  city: 'city',
  location: 'location',
  website: 'website',
  phone: 'phone',
  links: 'links',
  locale: 'locale',
  timezone: 'timezone',
}

export function profileFormNameForKey(key: ProfileFieldKey): string {
  switch (key) {
    case 'displayName':
      return 'display_name'
    case 'birthDate':
      return 'birth_date'
    default:
      return key
  }
}

export function profileFieldKeyFromFormName(name: string): ProfileFieldKey | null {
  const slug = name.trim().toLowerCase()
  if (!slug) return null
  const mapped = FORM_NAME_TO_KEY[slug]
  if (mapped) return mapped
  if (isProfileFieldKey(slug)) return slug
  return null
}

export type ProfileFormFieldConfig = {
  enabled: boolean
  required: boolean
  label: string
  placeholder: string
  description: string
  options?: FormFieldOption[]
}

export type ProfileFormSection = {
  id: string
  label: string
  fields: ProfileFieldKey[]
  /** Mosaic span % from Forms section config (same 5–100 model as Layout particles). */
  width: number
}

export type ProfileFormConfig = {
  fields: Record<ProfileFieldKey, ProfileFormFieldConfig>
  sections: ProfileFormSection[]
}

function defaultFieldConfig(key: ProfileFieldKey): ProfileFormFieldConfig {
  const def = getProfileField(key)!
  return {
    enabled: Boolean(def.locked),
    required: Boolean(def.locked && (key === 'displayName' || key === 'handle' || key === 'avatar')),
    label: def.label,
    placeholder: '',
    description: '',
  }
}

function defaultSectionWidth(groupKey: string): number {
  return groupKey === 'about' ? LAYOUT_WIDTH_FULL : 50
}

function resolveSectionWidth(
  raw: unknown,
  fallback: number,
  fields: ProfileFieldKey[],
): number {
  if (raw != null && Number.isFinite(Number(raw))) {
    return clampGridWidth(raw, fallback)
  }
  // Legacy: bio-only sections were full-bleed before Forms owned width.
  if (fields.length === 1 && fields[0] === 'bio') return LAYOUT_WIDTH_FULL
  return clampGridWidth(fallback, LAYOUT_WIDTH_FULL)
}

function buildGroupedSections(enabledOrder: ProfileFieldKey[]): ProfileFormSection[] {
  const remaining = new Set(enabledOrder)
  const sections: ProfileFormSection[] = []
  for (const group of PROFILE_FIELD_GROUPS) {
    const fields = PROFILE_FIELDS.filter(
      (f) => f.group === group.key && remaining.has(f.key),
    ).map((f) => f.key)
    for (const key of fields) remaining.delete(key)
    if (fields.length === 0) continue
    fields.sort((a, b) => enabledOrder.indexOf(a) - enabledOrder.indexOf(b))
    sections.push({
      id: `sec_${group.key}`,
      label: group.label,
      fields,
      width: defaultSectionWidth(group.key),
    })
  }
  if (remaining.size > 0) {
    sections.push({
      id: 'sec_other',
      label: 'Other',
      fields: enabledOrder.filter((k) => remaining.has(k)),
      width: 50,
    })
  }
  return sections
}

/**
 * Pure: map a Forms definition's fields/sections onto the Profiles registry.
 * Locked keys are always enabled even if missing from the definition.
 */
export function profileFormConfigFromFields(
  fields: FormFieldDef[],
  sections?: FormSectionDef[],
): ProfileFormConfig {
  const configs = {} as Record<ProfileFieldKey, ProfileFormFieldConfig>
  for (const def of PROFILE_FIELDS) {
    configs[def.key] = defaultFieldConfig(def.key)
  }

  const order: ProfileFieldKey[] = []
  const seen = new Set<ProfileFieldKey>()

  for (const field of fields) {
    const key = profileFieldKeyFromFormName(field.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    order.push(key)
    const registry = getProfileField(key)!
    configs[key] = {
      enabled: true,
      required: Boolean(
        registry.locked
          ? key === 'displayName' || key === 'handle' || key === 'avatar'
          : field.required,
      ),
      label: field.label?.trim() || registry.label,
      placeholder: field.placeholder?.trim() || '',
      description: field.description?.trim() || '',
      options: field.options?.length ? field.options.map((o) => ({ ...o })) : undefined,
    }
  }

  const missingLocked: ProfileFieldKey[] = []
  for (const def of PROFILE_FIELDS) {
    if (!def.locked || seen.has(def.key)) continue
    seen.add(def.key)
    missingLocked.push(def.key)
    configs[def.key] = {
      ...defaultFieldConfig(def.key),
      enabled: true,
      required: def.key === 'displayName' || def.key === 'handle' || def.key === 'avatar',
    }
  }
  order.unshift(...missingLocked)

  const enabledOrder = order.filter((k) => configs[k].enabled)

  let mappedSections: ProfileFormSection[] = []
  if (sections && sections.length > 0) {
    const assigned = new Set<ProfileFieldKey>()
    for (const section of sections) {
      const keys: ProfileFieldKey[] = []
      for (const row of section.rows) {
        for (const col of row.columns) {
          const key = profileFieldKeyFromFormName(col.fieldName)
          if (!key || !configs[key].enabled || assigned.has(key)) continue
          assigned.add(key)
          keys.push(key)
        }
      }
      if (keys.length === 0) continue
      mappedSections.push({
        id: section.id,
        label: section.label?.trim() || 'Fields',
        fields: keys,
        width: resolveSectionWidth(section.width, 50, keys),
      })
    }
    const orphan = enabledOrder.filter((k) => !assigned.has(k))
    if (orphan.length > 0) {
      mappedSections.push({
        id: 'sec_orphan',
        label: 'Fields',
        fields: orphan,
        width: resolveSectionWidth(undefined, 50, orphan),
      })
    }
  }
  if (mappedSections.length === 0) {
    mappedSections = buildGroupedSections(enabledOrder)
  }

  return { fields: configs, sections: mappedSections }
}

/** Overlay Forms enable/required onto module settings (visibility stays site-owned). */
export function applyProfileFormConfigToSettings(
  settings: ProfilesModuleSettings,
  config: ProfileFormConfig,
): ProfilesModuleSettings {
  const disabledFields: ProfileFieldKey[] = []
  const requiredFields: ProfileFieldKey[] = []
  for (const def of PROFILE_FIELDS) {
    const field = config.fields[def.key]
    if (!def.locked && !field.enabled) disabledFields.push(def.key)
    if (!def.locked && field.enabled && field.required) requiredFields.push(def.key)
  }
  return {
    ...settings,
    disabledFields,
    requiredFields,
  }
}
