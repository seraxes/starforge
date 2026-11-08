/**
 * product:profiles persistence (server-only).
 */

import 'server-only'

import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'

import {
  HANDLE_MAX,
  isValidTimezone,
  normalizeBirthDate,
  normalizeCoordinate,
  normalizeCountry,
  normalizeGender,
  normalizeHandle,
  normalizeHttpUrl,
  normalizePhone,
  normalizeProfileLinks,
  normalizeText,
  slugifyHandleBase,
  validateHandle,
  type ProfileFieldKey,
} from './fields'
import { normalizeImageFrame } from '@/modules/media/image-frame'
import { isFieldEnabled, profileCompleteness, sanitizeVisibility } from './privacy'
import { sfProfiles } from './schema'
import {
  isProfileStatus,
  type ProfileDirectoryRow,
  type ProfileInput,
  type ProfileRecord,
  type ProfilesModuleSettings,
  type ProfileStatus,
  type ProfileVisibilityMap,
} from './types'

type ProfileRow = typeof sfProfiles.$inferSelect

export function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    userId: row.userId,
    handle: row.handle,
    handleChangedAt: row.handleChangedAt ?? null,
    displayName: row.displayName ?? '',
    headline: row.headline ?? '',
    bio: row.bio ?? '',
    avatarMediaId: (row.avatarMediaId ?? '').trim(),
    coverMediaId: (row.coverMediaId ?? '').trim(),
    avatarFrame: normalizeImageFrame(row.avatarFrame),
    coverFrame: normalizeImageFrame(row.coverFrame),
    birthDate: row.birthDate ?? '',
    gender: row.gender ?? '',
    country: row.country ?? '',
    city: row.city ?? '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    website: row.website ?? '',
    phone: row.phone ?? '',
    links: normalizeProfileLinks(row.links),
    locale: row.locale ?? '',
    timezone: row.timezone ?? '',
    visibility: sanitizeVisibility(row.visibility),
    extensions:
      row.extensions && typeof row.extensions === 'object' && !Array.isArray(row.extensions)
        ? (row.extensions as ProfileRecord['extensions'])
        : {},
    status: isProfileStatus(row.status) ? row.status : 'active',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getProfileByUserId(userId: string): Promise<ProfileRecord | null> {
  const id = userId.trim()
  if (!id) return null
  const rows = await db.select().from(sfProfiles).where(eq(sfProfiles.userId, id)).limit(1)
  return rows[0] ? mapProfile(rows[0]) : null
}

export async function getProfileByHandle(handle: string): Promise<ProfileRecord | null> {
  const h = normalizeHandle(handle)
  if (!h) return null
  const rows = await db.select().from(sfProfiles).where(eq(sfProfiles.handle, h)).limit(1)
  return rows[0] ? mapProfile(rows[0]) : null
}

export async function getProfilesByUserIds(
  userIds: string[],
): Promise<Map<string, ProfileRecord>> {
  const ids = [...new Set(userIds.map((i) => i.trim()).filter(Boolean))]
  const out = new Map<string, ProfileRecord>()
  if (ids.length === 0) return out
  const rows = await db.select().from(sfProfiles).where(inArray(sfProfiles.userId, ids))
  for (const row of rows) out.set(row.userId, mapProfile(row))
  return out
}

export async function isHandleTaken(handle: string, exceptUserId?: string): Promise<boolean> {
  const h = normalizeHandle(handle)
  if (!h) return false
  const rows = await db
    .select({ userId: sfProfiles.userId })
    .from(sfProfiles)
    .where(
      exceptUserId
        ? and(eq(sfProfiles.handle, h), ne(sfProfiles.userId, exceptUserId))
        : eq(sfProfiles.handle, h),
    )
    .limit(1)
  return rows.length > 0
}

async function generateUniqueHandle(seed: string): Promise<string> {
  const base = slugifyHandleBase(seed)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = `${base.slice(0, HANDLE_MAX - suffix.length)}${suffix}`
    const check = validateHandle(candidate)
    if (check.ok && !(await isHandleTaken(check.handle))) return check.handle
  }
  // Extremely unlikely — fall back to a random tail.
  const tail = Math.random().toString(36).slice(2, 8)
  return `${base.slice(0, HANDLE_MAX - 7)}-${tail}`
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null
  return e?.code === '23505' || e?.cause?.code === '23505'
}

/**
 * Get-or-create the profile for a user (lazy provisioning).
 * Seeds `displayName` from the account name and picks a free handle from the
 * name / email — the member may rename it once without cooldown.
 * Returns null when the user does not exist.
 */
export async function ensureProfile(userId: string): Promise<ProfileRecord | null> {
  const id = userId.trim()
  if (!id) return null
  const existing = await getProfileByUserId(id)
  if (existing) return existing

  const users = await db
    .select({ id: sfUsers.id, name: sfUsers.name, email: sfUsers.email })
    .from(sfUsers)
    .where(eq(sfUsers.id, id))
    .limit(1)
  const user = users[0]
  if (!user) return null

  const seed = user.name?.trim() || user.email.split('@')[0] || 'member'
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const handle = await generateUniqueHandle(seed)
    try {
      await db
        .insert(sfProfiles)
        .values({ userId: id, handle, displayName: normalizeText(user.name, 80) })
        .onConflictDoNothing({ target: sfProfiles.userId })
      break
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Handle race — loop picks the next free candidate.
    }
  }
  return getProfileByUserId(id)
}

/** Create profiles for users that have none (admin bulk action / post-migration). */
export async function provisionMissingProfiles(limit = 500): Promise<number> {
  const rows = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .leftJoin(sfProfiles, eq(sfProfiles.userId, sfUsers.id))
    .where(isNull(sfProfiles.userId))
    .limit(Math.min(Math.max(limit, 1), 2000))
  let created = 0
  for (const row of rows) {
    const profile = await ensureProfile(row.id)
    if (profile) created += 1
  }
  return created
}

export type UpdateProfileContext = {
  /** `self` is subject to the handle cooldown; `admin` bypasses it. */
  actor: 'self' | 'admin'
  settings: ProfilesModuleSettings
  /** Enabled public locale codes (for the `locale` preference). */
  validLocales: string[]
}

export type UpdateProfileResult =
  | { ok: true; profile: ProfileRecord }
  | { ok: false; error: string }

function isFilled(key: ProfileFieldKey, input: ProfileInput): boolean {
  switch (key) {
    case 'headline':
      return Boolean(input.headline)
    case 'bio':
      return Boolean(input.bio)
    case 'cover':
      return Boolean(input.coverMediaId)
    case 'birthDate':
      return Boolean(input.birthDate)
    case 'gender':
      return Boolean(input.gender)
    case 'country':
      return Boolean(input.country)
    case 'city':
      return Boolean(input.city)
    case 'location':
      return input.latitude != null && input.longitude != null
    case 'website':
      return Boolean(input.website)
    case 'phone':
      return Boolean(input.phone)
    case 'links':
      return input.links.length > 0
    case 'locale':
      return Boolean(input.locale)
    case 'timezone':
      return Boolean(input.timezone)
    default:
      return true
  }
}

export async function updateProfile(
  userId: string,
  raw: ProfileInput,
  ctx: UpdateProfileContext,
): Promise<UpdateProfileResult> {
  const current = await ensureProfile(userId)
  if (!current) return { ok: false, error: 'Account not found.' }
  const { settings } = ctx

  const displayName = normalizeText(raw.displayName, 80)
  if (!displayName) return { ok: false, error: 'Display name is required.' }

  const handleCheck = validateHandle(raw.handle)
  if (!handleCheck.ok) return { ok: false, error: handleCheck.error }
  const handle = handleCheck.handle
  const handleChanged = handle !== current.handle

  if (handleChanged) {
    if (
      ctx.actor === 'self' &&
      settings.handleChangeCooldownDays > 0 &&
      current.handleChangedAt
    ) {
      const nextAllowed =
        current.handleChangedAt.getTime() + settings.handleChangeCooldownDays * 86_400_000
      if (Date.now() < nextAllowed) {
        return {
          ok: false,
          error: `You can change your username again on ${new Date(nextAllowed).toISOString().slice(0, 10)}.`,
        }
      }
    }
    if (await isHandleTaken(handle, userId)) {
      return { ok: false, error: 'That username is already taken.' }
    }
  }

  // Disabled optional fields keep their stored value (never editable, never shown).
  const keep = <T,>(key: ProfileFieldKey, next: T, prev: T): T =>
    isFieldEnabled(key, settings) ? next : prev

  const birthDateRaw = String(raw.birthDate ?? '').trim()
  const birthDate = normalizeBirthDate(birthDateRaw)
  if (birthDateRaw && !birthDate && isFieldEnabled('birthDate', settings)) {
    return { ok: false, error: 'Enter a valid date of birth.' }
  }

  const websiteRaw = String(raw.website ?? '').trim()
  const website = normalizeHttpUrl(websiteRaw)
  if (websiteRaw && !website && isFieldEnabled('website', settings)) {
    return { ok: false, error: 'Website must be a valid http(s) address.' }
  }

  let latitude = normalizeCoordinate(raw.latitude, -90, 90)
  let longitude = normalizeCoordinate(raw.longitude, -180, 180)
  if (latitude == null || longitude == null) {
    latitude = null
    longitude = null
  }

  const locale = ctx.validLocales.includes(String(raw.locale ?? '').trim())
    ? String(raw.locale).trim()
    : ''
  const tzRaw = String(raw.timezone ?? '').trim()
  const timezone = isValidTimezone(tzRaw) ? tzRaw : ''

  const visibility: ProfileVisibilityMap = sanitizeVisibility(raw.visibility)
  if (!settings.allowFriendsScope) {
    for (const key of Object.keys(visibility) as ProfileFieldKey[]) {
      if (visibility[key] === 'friends') delete visibility[key]
    }
  }

  const next: ProfileInput = {
    displayName,
    handle,
    headline: keep('headline', normalizeText(raw.headline, 120), current.headline),
    bio: keep('bio', normalizeText(raw.bio, 2000), current.bio),
    avatarMediaId: String(raw.avatarMediaId ?? '').trim().slice(0, 64),
    coverMediaId: keep(
      'cover',
      String(raw.coverMediaId ?? '').trim().slice(0, 64),
      current.coverMediaId,
    ),
    avatarFrame: normalizeImageFrame(raw.avatarFrame),
    coverFrame: keep('cover', normalizeImageFrame(raw.coverFrame), current.coverFrame),
    birthDate: keep('birthDate', birthDate, current.birthDate),
    gender: keep('gender', normalizeGender(raw.gender), current.gender),
    country: keep('country', normalizeCountry(raw.country), current.country),
    city: keep('city', normalizeText(raw.city, 80), current.city),
    latitude: keep('location', latitude, current.latitude),
    longitude: keep('location', longitude, current.longitude),
    website: keep('website', website, current.website),
    phone: keep('phone', normalizePhone(raw.phone), current.phone),
    links: keep('links', normalizeProfileLinks(raw.links), current.links),
    locale: keep('locale', locale, current.locale),
    timezone: keep('timezone', timezone, current.timezone),
    visibility,
  }

  for (const key of settings.requiredFields) {
    if (isFieldEnabled(key, settings) && !isFilled(key, next)) {
      const label = key === 'links' ? 'a social link' : key
      return { ok: false, error: `Please fill in ${label}.` }
    }
  }

  try {
    await db
      .update(sfProfiles)
      .set({
        handle: next.handle,
        ...(handleChanged ? { handleChangedAt: new Date() } : {}),
        displayName: next.displayName,
        headline: next.headline,
        bio: next.bio,
        avatarMediaId: next.avatarMediaId,
        coverMediaId: next.coverMediaId,
        avatarFrame: next.avatarFrame,
        coverFrame: next.coverFrame,
        birthDate: next.birthDate || null,
        gender: next.gender,
        country: next.country,
        city: next.city,
        latitude: next.latitude,
        longitude: next.longitude,
        website: next.website,
        phone: next.phone,
        links: next.links,
        locale: next.locale,
        timezone: next.timezone,
        visibility: next.visibility as Record<string, string>,
      })
      .where(eq(sfProfiles.userId, userId))
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'That username is already taken.' }
    }
    throw error
  }

  const saved = await getProfileByUserId(userId)
  return saved
    ? { ok: true, profile: saved }
    : { ok: false, error: 'Could not save the profile.' }
}

export async function setProfileStatus(
  userId: string,
  status: ProfileStatus,
): Promise<boolean> {
  const id = userId.trim()
  if (!id || !isProfileStatus(status)) return false
  const profile = await ensureProfile(id)
  if (!profile) return false
  await db.update(sfProfiles).set({ status }).where(eq(sfProfiles.userId, id))
  return true
}

export async function listProfileDirectory(options?: {
  q?: string
  status?: 'all' | 'none' | ProfileStatus
  limit?: number
}): Promise<ProfileDirectoryRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500)
  const q = (options?.q ?? '').trim().slice(0, 100)
  const status = options?.status ?? 'all'

  const conditions = []
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    conditions.push(
      or(
        ilike(sfUsers.email, like),
        ilike(sfUsers.name, like),
        ilike(sfProfiles.handle, like),
        ilike(sfProfiles.displayName, like),
      ),
    )
  }
  if (status === 'none') conditions.push(isNull(sfProfiles.userId))
  else if (status !== 'all') conditions.push(eq(sfProfiles.status, status))

  const rows = await db
    .select({
      userId: sfUsers.id,
      email: sfUsers.email,
      userName: sfUsers.name,
      role: sfUsers.role,
      banned: sfUsers.banned,
      profile: sfProfiles,
    })
    .from(sfUsers)
    .leftJoin(sfProfiles, eq(sfProfiles.userId, sfUsers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sfUsers.createdAt))
    .limit(limit)

  return rows.map((row) => {
    const profile = row.profile ? mapProfile(row.profile) : null
    return {
      userId: row.userId,
      email: row.email,
      userName: row.userName,
      role: row.role,
      banned: row.banned,
      hasProfile: Boolean(profile),
      handle: profile?.handle ?? '',
      displayName: profile?.displayName || row.userName,
      status: profile?.status ?? 'active',
      avatarMediaId: profile?.avatarMediaId ?? '',
      completeness: profile ? profileCompleteness(profile) : 0,
      updatedAt: profile?.updatedAt ?? null,
    }
  })
}

export async function countProfiles(): Promise<{ users: number; profiles: number }> {
  const [users, profiles] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(sfUsers),
    db.select({ n: sql<number>`count(*)::int` }).from(sfProfiles),
  ])
  return { users: users[0]?.n ?? 0, profiles: profiles[0]?.n ?? 0 }
}

/**
 * Fill empty contact fields only (Events one-click / form sync).
 * Never overwrites a value the member already set.
 */
export async function fillMissingProfileContact(
  userId: string,
  input: { phone?: string; displayName?: string },
): Promise<void> {
  const id = userId.trim()
  if (!id) return
  const current = await ensureProfile(id)
  if (!current) return

  const phone = normalizePhone(input.phone)
  const displayName = normalizeText(input.displayName, 80)
  const patch: Partial<typeof sfProfiles.$inferInsert> = {}
  if (phone && !current.phone.trim()) patch.phone = phone
  if (displayName && !current.displayName.trim()) patch.displayName = displayName
  if (Object.keys(patch).length === 0) return

  await db.update(sfProfiles).set(patch).where(eq(sfProfiles.userId, id))
}
