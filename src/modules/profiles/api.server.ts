/**
 * product:profiles — server contract for the rest of the ecosystem.
 *
 * Events, Marketplace, Social, Chat, Search … store a `userId` and resolve
 * identity here at render time. Never copy names / avatars into your own tables
 * and never re-check privacy — `Persona` is already projected for the viewer.
 *
 *   import { getPersonas } from '@/modules/profiles/api.server'
 *   const personas = await getPersonas(registrations.map((r) => r.userId), viewer)
 *
 * Works when the Profiles module is **off** or a user has no profile yet: you get
 * a minimal fallback Persona (account name, no handle) instead of an error.
 */

import 'server-only'

import { eq, inArray } from 'drizzle-orm'

import type { AccessViewer } from '@/core/acl/types'
import { db, sfUsers } from '@/core/db'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ageYears } from './fields'
import { fallbackPersona, projectPersona } from './privacy'
import {
  ensureProfile,
  fillMissingProfileContact,
  getProfileByHandle,
  getProfileByUserId,
  getProfilesByUserIds,
} from './store'
import { loadProfilesModuleSettings } from './settings.server'
import type { Persona, ProfileRecord, ViewerRelation } from './types'

export type {
  Persona,
  ProfileStatus,
  ViewerRelation,
} from './types'
export { VISIBILITY_LABELS, VISIBILITY_SCOPES, type VisibilityScope } from './fields'

const MAX_BATCH = 200

/** Avatar / cover URL for a Persona media id (public redirect route). */
export function personaMediaSrc(mediaId: string | null | undefined): string {
  const id = (mediaId ?? '').trim()
  // Original (not square thumbnail) so FramedImage pan/zoom keeps full standing photos.
  return id ? `/api/media/${encodeURIComponent(id)}?variant=original` : ''
}

/** Relationship between the viewer and a profile owner (`friend` arrives with Social). */
export function relationFor(viewer: AccessViewer, ownerUserId: string): ViewerRelation {
  if (viewer.userId && viewer.userId === ownerUserId) return 'self'
  if (viewer.isAppAdmin) return 'admin'
  if (viewer.isRegistered) return 'registered'
  return 'anonymous'
}

export async function isProfilesModuleEnabled(): Promise<boolean> {
  const settings = await getSiteSettings()
  return isCatalogModuleEnabled(settings, MODULE_IDS.profiles)
}

/**
 * Resolve Personas for a list of users, preserving input order (duplicates collapse).
 * Missing profile rows are provisioned lazily so every member ends up with a handle.
 * Hidden profiles resolve to a minimal Persona (name + avatar only).
 */
export async function getPersonas(
  userIds: string[],
  viewer: AccessViewer,
  options?: { provision?: boolean },
): Promise<Map<string, Persona>> {
  const ids = [...new Set(userIds.map((i) => i.trim()).filter(Boolean))].slice(0, MAX_BATCH)
  const out = new Map<string, Persona>()
  if (ids.length === 0) return out

  const users = await db
    .select({ id: sfUsers.id, name: sfUsers.name })
    .from(sfUsers)
    .where(inArray(sfUsers.id, ids))
  const nameById = new Map(users.map((u) => [u.id, u.name] as const))

  const enabled = await isProfilesModuleEnabled()
  if (!enabled) {
    for (const id of ids) {
      if (!nameById.has(id)) continue
      out.set(
        id,
        fallbackPersona({ userId: id, name: nameById.get(id) ?? '', isSelf: viewer.userId === id }),
      )
    }
    return out
  }

  const [{ settings }, profiles] = await Promise.all([
    loadProfilesModuleSettings(),
    getProfilesByUserIds(ids),
  ])

  if (options?.provision !== false) {
    for (const id of ids) {
      if (profiles.has(id) || !nameById.has(id)) continue
      const created = await ensureProfile(id)
      if (created) profiles.set(id, created)
    }
  }

  for (const id of ids) {
    const name = nameById.get(id)
    if (name == null) continue
    const profile = profiles.get(id)
    if (!profile) {
      out.set(id, fallbackPersona({ userId: id, name, isSelf: viewer.userId === id }))
      continue
    }
    const relation = relationFor(viewer, id)
    if (profile.status === 'hidden' && relation !== 'self' && relation !== 'admin') {
      out.set(id, {
        ...fallbackPersona({ userId: id, name: profile.displayName || name }),
        avatarMediaId: profile.avatarMediaId,
        avatarFrame: profile.avatarFrame,
      })
      continue
    }
    out.set(id, projectPersona(profile, relation, settings, { fallbackName: name }))
  }
  return out
}

export async function getPersona(
  userId: string,
  viewer: AccessViewer,
): Promise<Persona | null> {
  const map = await getPersonas([userId], viewer)
  return map.get(userId.trim()) ?? null
}

/**
 * Resolve a public profile page by handle.
 * Returns the stored record too (for the owner / admin editor shortcuts) —
 * callers must only render the `persona`.
 */
export async function getPersonaByHandle(
  handle: string,
  viewer: AccessViewer,
): Promise<{ persona: Persona; record: ProfileRecord; createdAt: Date } | null> {
  if (!(await isProfilesModuleEnabled())) return null
  const record = await getProfileByHandle(handle)
  if (!record) return null
  const relation = relationFor(viewer, record.userId)
  const privileged = relation === 'self' || relation === 'admin'
  if (record.status === 'hidden' && !privileged) return null

  const { settings } = await loadProfilesModuleSettings()
  if (settings.profilePagesVisibility === 'registered' && relation === 'anonymous') {
    return null
  }
  const users = await db
    .select({ name: sfUsers.name, createdAt: sfUsers.createdAt })
    .from(sfUsers)
    .where(eq(sfUsers.id, record.userId))
    .limit(1)
  const user = users[0]
  if (!user) return null
  return {
    persona: projectPersona(record, relation, settings, { fallbackName: user.name }),
    record,
    createdAt: user.createdAt,
  }
}

/**
 * Whole years of age for **server-side eligibility checks** (18+ events, age-gated
 * listings). Ignores display privacy by design — never return this to a client.
 * Null when the member has not provided a date of birth.
 */
export async function getAgeYearsForEligibility(userId: string): Promise<number | null> {
  const id = userId.trim()
  if (!id) return null
  const profiles = await getProfilesByUserIds([id])
  const birth = profiles.get(id)?.birthDate
  return birth ? ageYears(birth) : null
}

/** Owner contact for autofill / one-click (never for other viewers). */
export async function getOwnProfileContact(userId: string): Promise<{
  displayName: string
  phone: string
} | null> {
  const id = userId.trim()
  if (!id) return null
  if (!(await isProfilesModuleEnabled())) {
    return { displayName: '', phone: '' }
  }
  const profile = (await getProfileByUserId(id)) ?? (await ensureProfile(id))
  if (!profile) return null
  return {
    displayName: profile.displayName.trim(),
    phone: profile.phone.trim(),
  }
}

/** Events / Forms: write phone / displayName only when the profile field is still empty. */
export { fillMissingProfileContact }
