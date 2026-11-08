/**
 * product:profiles module settings — document in `sf_module_settings`.
 * `normalizeProfilesModuleSettings` is pure (unit-tested); load/save are server-only.
 */

import {
  PROFILE_FIELDS,
  getProfileField,
  isProfileFieldKey,
  isVisibilityConfigurable,
  isVisibilityScope,
  type ProfileFieldKey,
} from './fields'
import {
  DEFAULT_PROFILES_MODULE_SETTINGS,
  type ProfilesModuleSettings,
  type ProfileVisibilityMap,
} from './types'

function bool(raw: unknown, fallback: boolean): boolean {
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false
  return fallback
}

function fieldList(raw: unknown, accept: (key: ProfileFieldKey) => boolean): ProfileFieldKey[] {
  if (!Array.isArray(raw)) return []
  const out: ProfileFieldKey[] = []
  for (const entry of raw) {
    if (!isProfileFieldKey(entry) || !accept(entry) || out.includes(entry)) continue
    out.push(entry)
  }
  return out
}

export function normalizeProfilesModuleSettings(raw: unknown): ProfilesModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const defaults = DEFAULT_PROFILES_MODULE_SETTINGS

  const cooldownRaw = Number(obj.handleChangeCooldownDays)
  const handleChangeCooldownDays = Number.isFinite(cooldownRaw)
    ? Math.min(Math.max(Math.floor(cooldownRaw), 0), 365)
    : defaults.handleChangeCooldownDays

  // Locked + self-only fields can't be disabled; only optional fields can be required.
  const disabledFields = fieldList(obj.disabledFields, (k) => {
    const def = getProfileField(k)
    return Boolean(def && !def.locked)
  })
  const requiredFields = fieldList(obj.requiredFields, (k) => {
    const def = getProfileField(k)
    return Boolean(def && !def.locked && !disabledFields.includes(k))
  })

  const defaultVisibility: ProfileVisibilityMap = {}
  const visRaw =
    obj.defaultVisibility &&
    typeof obj.defaultVisibility === 'object' &&
    !Array.isArray(obj.defaultVisibility)
      ? (obj.defaultVisibility as Record<string, unknown>)
      : {}
  for (const def of PROFILE_FIELDS) {
    if (!isVisibilityConfigurable(def.key)) continue
    const value = visRaw[def.key]
    if (isVisibilityScope(value) && value !== def.defaultVisibility) {
      defaultVisibility[def.key] = value
    }
  }

  return {
    handleChangeCooldownDays,
    profilePagesVisibility:
      obj.profilePagesVisibility === 'registered' ? 'registered' : 'public',
    memberUploadsEnabled: bool(obj.memberUploadsEnabled, defaults.memberUploadsEnabled),
    allowFriendsScope: bool(obj.allowFriendsScope, defaults.allowFriendsScope),
    disabledFields,
    requiredFields,
    defaultVisibility,
  }
}
