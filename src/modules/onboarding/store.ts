/**
 * Onboarding status catalog + identity facts CRUD.
 * Seed statuses idempotently by key. Station catalog is empty while Fleet is absent.
 */

import 'server-only'

import { asc, eq, ne, and, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfOnboardingIdentityFacts, sfOnboardingStatuses } from './schema'
import {
  listStationsWhileFleetAbsent,
  isBookable,
  validateDriverCode,
  validateIdentityFields,
  validateStatusFields,
  type IdentityFieldInput,
  type StatusFieldInput,
} from './status-rules'
import type {
  OnboardingIdentityFacts,
  OnboardingStationRecord,
  OnboardingStatusRecord,
} from './types'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function mapStatus(row: typeof sfOnboardingStatuses.$inferSelect): OnboardingStatusRecord {
  return {
    id: row.id,
    key: row.key?.trim() || '',
    name: row.name?.trim() || '',
    bookable: row.bookable === true,
    formDefinitionId: (row.formDefinitionId ?? '').trim(),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const SEEDED_STATUSES: ReadonlyArray<{
  key: string
  name: string
  bookable: boolean
  sortOrder: number
}> = [
  { key: 'recruiting', name: 'Recruiting', bookable: false, sortOrder: 10 },
  { key: 'active', name: 'Active', bookable: true, sortOrder: 20 },
  { key: 'inactive', name: 'Inactive', bookable: false, sortOrder: 30 },
  { key: 'closed', name: 'Closed (visszautasítva)', bookable: false, sortOrder: 40 },
  { key: 'banned', name: 'Banned (kitiltva)', bookable: false, sortOrder: 50 },
]

export async function listStatuses(): Promise<OnboardingStatusRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingStatuses)
    .orderBy(asc(sfOnboardingStatuses.sortOrder), asc(sfOnboardingStatuses.name))
  return rows.map(mapStatus)
}

export async function getStatusById(statusId: string): Promise<OnboardingStatusRecord | null> {
  const id = statusId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingStatuses)
    .where(eq(sfOnboardingStatuses.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapStatus(row) : null
}

export async function getStatusByKey(key: string): Promise<OnboardingStatusRecord | null> {
  const k = key.trim()
  if (!k) return null
  const rows = await db
    .select()
    .from(sfOnboardingStatuses)
    .where(eq(sfOnboardingStatuses.key, k))
    .limit(1)
  const row = rows[0]
  return row ? mapStatus(row) : null
}

/** Ensure seeded recruiting / active / inactive / closed / banned exist. Idempotent by key. */
export async function ensureSeededStatuses(): Promise<OnboardingStatusRecord[]> {
  const existing = await listStatuses()
  const byKey = new Map(existing.map((row) => [row.key, row]))
  for (const seed of SEEDED_STATUSES) {
    if (byKey.has(seed.key)) continue
    const created = await createStatus({
      key: seed.key,
      name: seed.name,
      bookable: seed.bookable,
      formDefinitionId: '',
      sortOrder: seed.sortOrder,
    })
    if (created.ok) byKey.set(created.status.key, created.status)
  }
  return [...byKey.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  )
}

export type StatusMutationResult =
  | { ok: true; status: OnboardingStatusRecord }
  | { ok: false; error: string }

export async function createStatus(input: StatusFieldInput): Promise<StatusMutationResult> {
  const parsed = validateStatusFields(input)
  if (!parsed.ok) return parsed

  const clash = await getStatusByKey(parsed.values.key)
  if (clash) return { ok: false, error: `Status key “${parsed.values.key}” is already in use.` }

  const id = newId('onb_status')
  await db.insert(sfOnboardingStatuses).values({
    id,
    key: parsed.values.key,
    name: parsed.values.name,
    bookable: parsed.values.bookable,
    formDefinitionId: parsed.values.formDefinitionId,
    sortOrder: parsed.values.sortOrder,
  })
  const saved = await getStatusById(id)
  if (!saved) return { ok: false, error: 'Failed to create status.' }
  return { ok: true, status: saved }
}

export async function updateStatus(
  id: string,
  input: StatusFieldInput,
): Promise<StatusMutationResult> {
  const statusId = id.trim()
  if (!statusId) return { ok: false, error: 'Missing status id.' }
  const existing = await getStatusById(statusId)
  if (!existing) return { ok: false, error: 'Status not found.' }

  const parsed = validateStatusFields(input, {
    name: existing.name,
    key: existing.key,
    bookable: existing.bookable,
    formDefinitionId: existing.formDefinitionId,
    sortOrder: existing.sortOrder,
  })
  if (!parsed.ok) return parsed

  if (parsed.values.key !== existing.key) {
    const clash = await getStatusByKey(parsed.values.key)
    if (clash && clash.id !== statusId) {
      return { ok: false, error: `Status key “${parsed.values.key}” is already in use.` }
    }
  }

  await db
    .update(sfOnboardingStatuses)
    .set({
      key: parsed.values.key,
      name: parsed.values.name,
      bookable: parsed.values.bookable,
      formDefinitionId: parsed.values.formDefinitionId,
      sortOrder: parsed.values.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingStatuses.id, statusId))

  const saved = await getStatusById(statusId)
  if (!saved) return { ok: false, error: 'Failed to update status.' }
  return { ok: true, status: saved }
}

export async function deleteStatus(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const statusId = id.trim()
  if (!statusId) return { ok: false, error: 'Missing status id.' }
  const existing = await getStatusById(statusId)
  if (!existing) return { ok: false, error: 'Status not found.' }

  const inUse = await db
    .select({ userId: sfOnboardingIdentityFacts.userId })
    .from(sfOnboardingIdentityFacts)
    .where(eq(sfOnboardingIdentityFacts.statusId, statusId))
    .limit(1)
  if (inUse[0]) {
    return { ok: false, error: 'Status is in use by at least one person. Reassign them first.' }
  }

  await db.delete(sfOnboardingStatuses).where(eq(sfOnboardingStatuses.id, statusId))
  return { ok: true }
}

/** Station list — empty while Fleet is not in the tree. */
export function listStations(): OnboardingStationRecord[] {
  return listStationsWhileFleetAbsent()
}

async function loadIdentityRow(
  userId: string,
): Promise<typeof sfOnboardingIdentityFacts.$inferSelect | null> {
  const id = userId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingIdentityFacts)
    .where(eq(sfOnboardingIdentityFacts.userId, id))
    .limit(1)
  return rows[0] ?? null
}

async function resolvePhoneFallback(userId: string): Promise<string> {
  try {
    const { getOwnProfileContact } = await import('@/modules/profiles/api.server')
    const contact = await getOwnProfileContact(userId)
    return contact?.phone?.trim() || ''
  } catch {
    return ''
  }
}

export async function getIdentityFacts(userId: string): Promise<OnboardingIdentityFacts | null> {
  const id = userId.trim()
  if (!id) return null
  const row = await loadIdentityRow(id)
  const phoneFact = (row?.phone ?? '').trim()
  const phone = phoneFact || (await resolvePhoneFallback(id))
  return {
    userId: id,
    statusId: (row?.statusId ?? '').trim(),
    driverCode: (row?.driverCode ?? '').trim(),
    phone,
    phoneFact,
    stationId: (row?.stationId ?? '').trim(),
    homeRunAllow: row?.homeRunAllow === true,
    homeRunFreeKm:
      typeof row?.homeRunFreeKm === 'number' && Number.isFinite(row.homeRunFreeKm)
        ? Math.floor(row.homeRunFreeKm)
        : 0,
    trainer: row?.trainer === true,
    clearquote: (row?.clearquote ?? '').trim(),
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  }
}

export type IdentityMutationResult =
  | { ok: true; facts: OnboardingIdentityFacts }
  | { ok: false; error: string }

export async function writeIdentityFacts(
  userId: string,
  input: IdentityFieldInput,
): Promise<IdentityMutationResult> {
  const id = userId.trim()
  if (!id) return { ok: false, error: 'User id is required.' }

  const existing = await loadIdentityRow(id)
  const parsed = validateIdentityFields(input, {
    statusId: existing?.statusId ?? '',
    driverCode: existing?.driverCode ?? null,
    phone: existing?.phone ?? '',
    stationId: existing?.stationId ?? '',
    homeRunAllow: existing?.homeRunAllow ?? false,
    homeRunFreeKm: existing?.homeRunFreeKm ?? 0,
    trainer: existing?.trainer ?? false,
    clearquote: existing?.clearquote ?? '',
  })
  if (!parsed.ok) return parsed

  if (parsed.values.statusId) {
    const status = await getStatusById(parsed.values.statusId)
    if (!status) return { ok: false, error: 'Status not found.' }
  }

  if (parsed.values.driverCode) {
    const clash = await db
      .select({ userId: sfOnboardingIdentityFacts.userId })
      .from(sfOnboardingIdentityFacts)
      .where(
        and(
          eq(sfOnboardingIdentityFacts.driverCode, parsed.values.driverCode),
          ne(sfOnboardingIdentityFacts.userId, id),
          isNotNull(sfOnboardingIdentityFacts.driverCode),
        ),
      )
      .limit(1)
    if (clash[0]) {
      return { ok: false, error: `Driver code “${parsed.values.driverCode}” is already in use.` }
    }
  }

  const values = {
    statusId: parsed.values.statusId,
    driverCode: parsed.values.driverCode,
    phone: parsed.values.phone,
    stationId: parsed.values.stationId,
    homeRunAllow: parsed.values.homeRunAllow,
    homeRunFreeKm: parsed.values.homeRunFreeKm,
    trainer: parsed.values.trainer,
    clearquote: parsed.values.clearquote,
    updatedAt: new Date(),
  }

  if (existing) {
    await db
      .update(sfOnboardingIdentityFacts)
      .set(values)
      .where(eq(sfOnboardingIdentityFacts.userId, id))
  } else {
    await db.insert(sfOnboardingIdentityFacts).values({
      userId: id,
      ...values,
    })
  }

  const facts = await getIdentityFacts(id)
  if (!facts) return { ok: false, error: 'Failed to save identity facts.' }
  return { ok: true, facts }
}

/**
 * Bookable for a user id given a vehicle-access flag.
 * Status flag on → true. Flag off + vehicle access → true. Neither → false.
 * Missing person / missing status → only vehicle access can grant bookable.
 */
export async function isUserBookable(
  userId: string,
  hasVehicleAccess: boolean,
): Promise<boolean> {
  const facts = await getIdentityFacts(userId)
  if (!facts?.statusId) return isBookable(false, hasVehicleAccess)
  const status = await getStatusById(facts.statusId)
  return isBookable(status?.bookable === true, hasVehicleAccess)
}

/** Re-export for callers that only need the pure check after loading status. */
export { isBookable, validateDriverCode }
