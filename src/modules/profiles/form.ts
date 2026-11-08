/**
 * product:profiles — form <-> model glue (pure; shared by member + admin editors).
 */

import { parseImageFrameJson } from '@/modules/media/image-frame'

import {
  PROFILE_FIELDS,
  isVisibilityConfigurable,
  normalizeProfileLinks,
  type ProfileFieldKey,
  type VisibilityScope,
} from './fields'
import { effectiveVisibility, isFieldEnabled, sanitizeVisibility } from './privacy'
import type { ProfileFormConfig, ProfileFormSection } from './profile-form-config'
import type { ProfileInput, ProfileRecord, ProfilesModuleSettings } from './types'

/** Read the shared editor form into a `ProfileInput` (unvalidated — store validates). */
export function parseProfileFormData(formData: FormData): ProfileInput {
  const str = (key: string) => String(formData.get(key) ?? '')
  const num = (key: string): number | null => {
    const raw = str(key).trim()
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return {
    displayName: str('displayName'),
    handle: str('handle'),
    headline: str('headline'),
    bio: str('bio'),
    avatarMediaId: str('avatarMediaId'),
    coverMediaId: str('coverMediaId'),
    avatarFrame: parseImageFrameJson(str('avatarFrameJson')),
    coverFrame: parseImageFrameJson(str('coverFrameJson')),
    birthDate: str('birthDate'),
    gender: str('gender'),
    country: str('country'),
    city: str('city'),
    latitude: num('latitude'),
    longitude: num('longitude'),
    website: str('website'),
    phone: str('phone'),
    links: normalizeProfileLinks(str('linksJson')),
    locale: str('locale'),
    timezone: str('timezone'),
    visibility: sanitizeVisibility(str('visibilityJson')),
  }
}

export type ProfileEditorFieldState = {
  enabled: boolean
  required: boolean
  label: string
  placeholder: string
  description: string
  options?: Array<{ value: string; label: string }>
  /** Scope currently in effect (member choice → site default → registry default). */
  visibility: VisibilityScope
  /** Whether a scope picker should render next to the field. */
  configurable: boolean
}

/** Serializable model handed to the client editor. */
export type ProfileEditorModel = {
  userId: string
  email: string
  values: Omit<ProfileInput, 'visibility'>
  fields: Record<ProfileFieldKey, ProfileEditorFieldState>
  /** Forms sections (enabled fields only) — drives editor layout. */
  sections: ProfileFormSection[]
  scopes: VisibilityScope[]
  /** ISO date until which a self-service handle change is blocked, else null. */
  handleLockedUntil: string | null
  locales: Array<{ code: string; label: string }>
  memberUploadsEnabled: boolean
}

export function buildEditorModel(input: {
  record: ProfileRecord
  email: string
  settings: ProfilesModuleSettings
  formConfig: ProfileFormConfig
  locales: Array<{ code: string; label: string }>
  /** `self` sees the cooldown lock; `admin` never does. */
  actor: 'self' | 'admin'
  now?: Date
}): ProfileEditorModel {
  const { record, settings, formConfig } = input
  const now = input.now ?? new Date()

  const fields = {} as Record<ProfileFieldKey, ProfileEditorFieldState>
  for (const def of PROFILE_FIELDS) {
    const cfg = formConfig.fields[def.key]
    const enabled = isFieldEnabled(def.key, settings) && cfg.enabled
    fields[def.key] = {
      enabled,
      required: Boolean(
        def.locked
          ? def.key === 'displayName' || def.key === 'handle'
          : enabled && (cfg.required || settings.requiredFields.includes(def.key)),
      ),
      label: cfg.label || def.label,
      placeholder: cfg.placeholder || '',
      description: cfg.description || '',
      options: cfg.options,
      visibility: effectiveVisibility(def.key, record.visibility, settings),
      configurable: isVisibilityConfigurable(def.key),
    }
  }

  const sections = formConfig.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((key) => fields[key]?.enabled),
      width: section.width,
    }))
    .filter((section) => section.fields.length > 0)

  let handleLockedUntil: string | null = null
  if (
    input.actor === 'self' &&
    settings.handleChangeCooldownDays > 0 &&
    record.handleChangedAt
  ) {
    const until = record.handleChangedAt.getTime() + settings.handleChangeCooldownDays * 86_400_000
    if (until > now.getTime()) handleLockedUntil = new Date(until).toISOString()
  }

  const scopes: VisibilityScope[] = settings.allowFriendsScope
    ? ['public', 'registered', 'friends', 'private']
    : ['public', 'registered', 'private']

  return {
    userId: record.userId,
    email: input.email,
    values: {
      displayName: record.displayName,
      handle: record.handle,
      headline: record.headline,
      bio: record.bio,
      avatarMediaId: record.avatarMediaId,
      coverMediaId: record.coverMediaId,
      avatarFrame: record.avatarFrame,
      coverFrame: record.coverFrame,
      birthDate: record.birthDate,
      gender: record.gender,
      country: record.country,
      city: record.city,
      latitude: record.latitude,
      longitude: record.longitude,
      website: record.website,
      phone: record.phone,
      links: record.links,
      locale: record.locale,
      timezone: record.timezone,
    },
    fields,
    sections,
    scopes,
    handleLockedUntil,
    locales: input.locales,
    memberUploadsEnabled: settings.memberUploadsEnabled,
  }
}
