'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { getEnabledPublicLocales } from '@/core/i18n/enabled'
import { findMediaById } from '@/core/media/resolve'
import { getRateLimiter } from '@/core/security/rate-limit'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { memberOwnsMedia } from '@/modules/media/api.server'

import {
  PROFILE_FIELDS,
  isVisibilityConfigurable,
  isVisibilityScope,
} from './fields'
import { parseProfileFormData } from './form'
import { loadProfilesModuleSettings, saveProfilesModuleSettings } from './settings.server'
import {
  ensureProfile,
  provisionMissingProfiles,
  setProfileStatus,
  updateProfile,
} from './store'
import {
  isProfileStatus,
  type ProfileInput,
  type ProfilesActionState,
  type ProfilesModuleSettings,
  type ProfileVisibilityMap,
} from './types'

export type { ProfilesActionState }

async function profilesModuleOff(): Promise<ProfilesActionState | null> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) {
    return { error: 'Profiles is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

async function requireProfilesAdmin(): Promise<ProfilesActionState | null> {
  const session = await requireAdminArea('admin.profiles')
  if (!session) {
    return {
      error: 'Sign in with Profiles admin access (app admin or ACL → Profiles) to manage profiles.',
    }
  }
  return profilesModuleOff()
}

function revalidateProfiles(userId?: string) {
  revalidatePath('/admin/users')
  revalidatePath('/admin/profiles/settings')
  if (userId) {
    revalidatePath(`/admin/users/${userId}`)
    revalidatePath(`/admin/profiles/${userId}`)
  }
}

/**
 * A member may only point avatar / cover at images they uploaded themselves
 * (or keep the one already on their profile). Admin picks skip this and only
 * need the media to exist.
 */
async function checkMediaChange(
  actor: 'self' | 'admin',
  userId: string,
  next: ProfileInput,
  current: { avatarMediaId: string; coverMediaId: string },
  memberUploadsEnabled: boolean,
): Promise<string | null> {
  const changes: Array<[string, string]> = []
  if (next.avatarMediaId && next.avatarMediaId !== current.avatarMediaId) {
    changes.push(['avatar', next.avatarMediaId])
  }
  if (next.coverMediaId && next.coverMediaId !== current.coverMediaId) {
    changes.push(['cover image', next.coverMediaId])
  }
  for (const [label, mediaId] of changes) {
    if (actor === 'self') {
      if (!memberUploadsEnabled) return 'Image uploads are turned off.'
      if (!(await memberOwnsMedia(userId, mediaId))) {
        return `Choose an ${label} you uploaded yourself.`
      }
    } else if (!(await findMediaById(mediaId))) {
      return `The selected ${label} no longer exists in the Media library.`
    }
  }
  return null
}

/** Member edits their own profile (`/account/profile`). */
export async function saveOwnProfileAction(
  _prev: ProfilesActionState,
  formData: FormData,
): Promise<ProfilesActionState> {
  const session = await getAppSession()
  const userId = session?.user?.id
  if (!userId) return { error: 'Sign in to edit your profile.' }
  const off = await profilesModuleOff()
  if (off) return off

  const limited = await getRateLimiter().consume(`profile-save:${userId}`, {
    limit: 30,
    windowSec: 600,
  })
  if (!limited.ok) return { error: 'Too many saves — wait a moment and try again.' }

  const current = await ensureProfile(userId)
  if (!current) return { error: 'Account not found.' }

  const [{ settings }, locales] = await Promise.all([
    loadProfilesModuleSettings(),
    getEnabledPublicLocales(),
  ])
  const input = parseProfileFormData(formData)

  const mediaError = await checkMediaChange(
    'self',
    userId,
    input,
    current,
    settings.memberUploadsEnabled,
  )
  if (mediaError) return { error: mediaError }

  const result = await updateProfile(userId, input, {
    actor: 'self',
    settings,
    validLocales: locales,
  })
  if (!result.ok) return { error: result.error }

  revalidateProfiles(userId)
  return { ok: true, message: 'Profile saved.', handle: result.profile.handle }
}

/** Admin edits any member's profile (`/admin/profiles/[userId]`). */
export async function saveProfileAdminAction(
  _prev: ProfilesActionState,
  formData: FormData,
): Promise<ProfilesActionState> {
  const denied = await requireProfilesAdmin()
  if (denied) return denied

  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return { error: 'Missing user id.' }

  const current = await ensureProfile(userId)
  if (!current) return { error: 'Account not found.' }

  const [{ settings }, locales] = await Promise.all([
    loadProfilesModuleSettings(),
    getEnabledPublicLocales(),
  ])
  const input = parseProfileFormData(formData)

  const mediaError = await checkMediaChange(
    'admin',
    userId,
    input,
    current,
    settings.memberUploadsEnabled,
  )
  if (mediaError) return { error: mediaError }

  const result = await updateProfile(userId, input, {
    actor: 'admin',
    settings,
    validLocales: locales,
  })
  if (!result.ok) return { error: result.error }

  revalidateProfiles(userId)
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: 'Profile saved.', handle: result.profile.handle }
}

export async function setProfileStatusAction(
  _prev: ProfilesActionState,
  formData: FormData,
): Promise<ProfilesActionState> {
  const denied = await requireProfilesAdmin()
  if (denied) return denied

  const userId = String(formData.get('userId') ?? '').trim()
  const status = String(formData.get('status') ?? '')
  if (!userId || !isProfileStatus(status)) return { error: 'Invalid request.' }

  const ok = await setProfileStatus(userId, status)
  if (!ok) return { error: 'Account not found.' }
  revalidateProfiles(userId)
  return {
    ok: true,
    message: status === 'hidden' ? 'Profile hidden from the public site.' : 'Profile is visible again.',
  }
}

export async function provisionMissingProfilesAction(
  _prev: ProfilesActionState,
  _formData: FormData,
): Promise<ProfilesActionState> {
  const denied = await requireProfilesAdmin()
  if (denied) return denied
  const created = await provisionMissingProfiles(1000)
  revalidateProfiles()
  return {
    ok: true,
    message: created === 0 ? 'Every account already has a profile.' : `Created ${created} profile(s).`,
  }
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === '1'
}

export async function saveProfilesSettingsAction(
  _prev: ProfilesActionState,
  formData: FormData,
): Promise<ProfilesActionState> {
  const denied = await requireProfilesAdmin()
  if (denied) return denied

  // Enable / required come from Forms (`profile` definition) at read time — not saved here.
  const defaultVisibility: ProfileVisibilityMap = {}
  for (const def of PROFILE_FIELDS) {
    if (def.locked) continue
    if (isVisibilityConfigurable(def.key)) {
      const scope = String(formData.get(`vis:${def.key}`) ?? '')
      if (isVisibilityScope(scope)) defaultVisibility[def.key] = scope
    }
  }

  const input: Partial<ProfilesModuleSettings> = {
    handleChangeCooldownDays: Number(formData.get('handleChangeCooldownDays')),
    profilePagesVisibility:
      formData.get('profilePagesVisibility') === 'registered' ? 'registered' : 'public',
    memberUploadsEnabled: checked(formData, 'memberUploadsEnabled'),
    allowFriendsScope: checked(formData, 'allowFriendsScope'),
    disabledFields: [],
    requiredFields: [],
    defaultVisibility,
  }
  await saveProfilesModuleSettings(input)
  revalidateProfiles()
  return { ok: true, message: 'Profiles settings saved.' }
}
