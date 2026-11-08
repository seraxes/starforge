/**
 * product:profiles — privacy resolution + Persona projection (pure, testable).
 *
 * The single place that decides what a viewer may see. Every surface (public
 * page, Events registrant list, Marketplace seller card…) goes through
 * `projectPersona`, so privacy is never re-implemented per module.
 */

import { DEFAULT_IMAGE_FRAME } from '@/modules/media/image-frame'

import {
  PROFILE_FIELDS,
  ageYears,
  getProfileField,
  isVisibilityConfigurable,
  isVisibilityScope,
  roundCoordinate,
  type ProfileFieldKey,
  type VisibilityScope,
} from './fields'
import type {
  Persona,
  ProfileRecord,
  ProfilesModuleSettings,
  ProfileVisibilityMap,
  ViewerRelation,
} from './types'

/** Does a viewer in `relation` pass a field's `scope`? */
export function scopeAllows(scope: VisibilityScope, relation: ViewerRelation): boolean {
  if (relation === 'self' || relation === 'admin') return true
  switch (scope) {
    case 'public':
      return true
    case 'registered':
      return relation === 'registered' || relation === 'friend'
    case 'friends':
      return relation === 'friend'
    default:
      return false
  }
}

export function isFieldEnabled(
  key: ProfileFieldKey,
  settings: Pick<ProfilesModuleSettings, 'disabledFields'>,
): boolean {
  const def = getProfileField(key)
  if (!def) return false
  if (def.locked) return true
  return !settings.disabledFields.includes(key)
}

/**
 * Effective visibility for a field:
 * member choice → site default → registry default; locked = public, self-only = private.
 */
export function effectiveVisibility(
  key: ProfileFieldKey,
  memberChoice: ProfileVisibilityMap,
  settings: Pick<ProfilesModuleSettings, 'defaultVisibility'>,
): VisibilityScope {
  const def = getProfileField(key)
  if (!def) return 'private'
  if (def.locked) return 'public'
  if (def.selfOnly) return 'private'
  const chosen = memberChoice[key]
  if (isVisibilityScope(chosen)) return chosen
  const site = settings.defaultVisibility[key]
  if (isVisibilityScope(site)) return site
  return def.defaultVisibility
}

/** Keep only known, configurable fields with a valid scope. */
export function sanitizeVisibility(raw: unknown): ProfileVisibilityMap {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const out: ProfileVisibilityMap = {}
  for (const def of PROFILE_FIELDS) {
    if (!isVisibilityConfigurable(def.key)) continue
    const value = (obj as Record<string, unknown>)[def.key]
    if (isVisibilityScope(value)) out[def.key] = value
  }
  return out
}

/**
 * Project a stored profile into what `relation` may see.
 * `fallbackName` is used when the profile has no display name yet.
 */
export function projectPersona(
  record: ProfileRecord,
  relation: ViewerRelation,
  settings: ProfilesModuleSettings,
  options?: { fallbackName?: string; now?: Date },
): Persona {
  const can = (key: ProfileFieldKey): boolean =>
    isFieldEnabled(key, settings) &&
    scopeAllows(effectiveVisibility(key, record.visibility, settings), relation)

  const hasLocation = record.latitude != null && record.longitude != null
  const handle = record.handle.trim()

  return {
    userId: record.userId,
    handle,
    displayName:
      record.displayName.trim() || options?.fallbackName?.trim() || handle || 'Member',
    headline: can('headline') && record.headline ? record.headline : null,
    avatarMediaId: record.avatarMediaId,
    avatarFrame: record.avatarFrame,
    href: handle ? `/u/${handle}` : null,
    bio: can('bio') && record.bio ? record.bio : null,
    coverMediaId: can('cover') && record.coverMediaId ? record.coverMediaId : null,
    coverFrame:
      can('cover') && record.coverMediaId ? record.coverFrame : null,
    ageYears:
      can('birthDate') && record.birthDate
        ? ageYears(record.birthDate, options?.now)
        : null,
    gender: can('gender') && record.gender ? record.gender : null,
    country: can('country') && record.country ? record.country : null,
    city: can('city') && record.city ? record.city : null,
    location:
      can('location') && hasLocation
        ? relation === 'self' || relation === 'admin'
          ? { lat: record.latitude as number, lng: record.longitude as number }
          : {
              lat: roundCoordinate(record.latitude as number),
              lng: roundCoordinate(record.longitude as number),
            }
        : null,
    website: can('website') && record.website ? record.website : null,
    phone: can('phone') && record.phone ? record.phone : null,
    links: can('links') ? record.links : [],
    isSelf: relation === 'self',
  }
}

/** A Persona for a user with no profile row (module off / not provisioned yet). */
export function fallbackPersona(input: {
  userId: string
  name: string
  isSelf?: boolean
}): Persona {
  return {
    userId: input.userId,
    handle: '',
    displayName: input.name.trim() || 'Member',
    headline: null,
    avatarMediaId: '',
    avatarFrame: { ...DEFAULT_IMAGE_FRAME },
    href: null,
    bio: null,
    coverMediaId: null,
    coverFrame: null,
    ageYears: null,
    gender: null,
    country: null,
    city: null,
    location: null,
    website: null,
    phone: null,
    links: [],
    isSelf: Boolean(input.isSelf),
  }
}

/** 0–100: share of optional + identity fields the member has filled in. */
export function profileCompleteness(
  record: Pick<
    ProfileRecord,
    | 'headline'
    | 'bio'
    | 'avatarMediaId'
    | 'coverMediaId'
    | 'birthDate'
    | 'country'
    | 'city'
    | 'website'
    | 'links'
  >,
): number {
  const checks = [
    Boolean(record.avatarMediaId),
    Boolean(record.headline),
    Boolean(record.bio),
    Boolean(record.coverMediaId),
    Boolean(record.birthDate),
    Boolean(record.country),
    Boolean(record.city),
    Boolean(record.website) || record.links.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
