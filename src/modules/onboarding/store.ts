/**
 * Onboarding status catalog + identity facts CRUD.
 * Seed statuses idempotently by key. Station catalog is empty while Fleet is absent.
 */

import 'server-only'

import { asc, eq, ne, and, isNotNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfOnboardingIdentityFacts, sfOnboardingStatuses } from './schema'
import { validateReminderTemplateBinding } from './email-binding-rules'
import { depotsAsStationCatalog } from './event-type-settings-rules'
import {
  isBookable,
  isOnboardingStatusPhase,
  statusListLabel,
  validateDriverCode,
  validateIdentityFields,
  validateStatusFields,
  validateStatusReorderIds,
  type IdentityFieldInput,
  type OnboardingStatusPhase,
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

function mapPhase(raw: string | null | undefined): OnboardingStatusPhase {
  const value = (raw ?? '').trim()
  return isOnboardingStatusPhase(value) ? value : 'recruiting'
}

function mapStatus(row: typeof sfOnboardingStatuses.$inferSelect): OnboardingStatusRecord {
  const name = row.name?.trim() || ''
  const displayLabel = (row.displayLabel ?? '').trim() || name
  const phase = mapPhase(row.phase)
  return {
    id: row.id,
    key: row.key?.trim() || '',
    name,
    phase,
    displayLabel,
    actionChip: (row.actionChip ?? '').trim(),
    nextStepMessage: (row.nextStepMessage ?? '').trim(),
    pageId: (row.pageId ?? '').trim(),
    bookable: row.bookable === true || phase === 'active',
    formDefinitionId: (row.formDefinitionId ?? '').trim(),
    reminderTemplateId: (row.reminderTemplateId ?? '').trim(),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function emailTemplateExists(templateId: string): Promise<boolean> {
  const id = templateId.trim()
  if (!id) return false
  try {
    const { findEmailTemplateById } = await import('@/modules/email-manager/api.server')
    return Boolean(await findEmailTemplateById(id))
  } catch {
    return false
  }
}

/**
 * Resolve reminder binding for create/update.
 * Leaving recruiting clears the binding. Setting a reminder on a non-recruiting phase is refused.
 */
async function resolveReminderTemplateId(
  phase: OnboardingStatusPhase,
  input: StatusFieldInput & { reminderTemplateId?: unknown },
  existingReminderTemplateId: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const leavingRecruiting = phase !== 'recruiting'
  const raw =
    input.reminderTemplateId !== undefined
      ? input.reminderTemplateId
      : existingReminderTemplateId
  const candidate = leavingRecruiting && input.reminderTemplateId === undefined ? '' : raw

  if (leavingRecruiting) {
    const trimmed = String(candidate ?? '').trim()
    if (trimmed && input.reminderTemplateId !== undefined) {
      return validateReminderTemplateBinding(phase, trimmed, () => true)
    }
    return { ok: true, value: '' }
  }

  const trimmed = String(candidate ?? '').trim()
  if (!trimmed) return { ok: true, value: '' }
  const exists = await emailTemplateExists(trimmed)
  return validateReminderTemplateBinding(phase, trimmed, () => exists)
}

const SEEDED_STATUSES: ReadonlyArray<{
  key: string
  name: string
  phase: OnboardingStatusPhase
  bookable: boolean
  sortOrder: number
}> = [
  { key: 'recruiting', name: 'Recruiting', phase: 'recruiting', bookable: false, sortOrder: 10 },
  { key: 'active', name: 'Active', phase: 'active', bookable: true, sortOrder: 20 },
  { key: 'inactive', name: 'Inactive', phase: 'inactive', bookable: false, sortOrder: 30 },
  {
    key: 'closed',
    name: 'Closed (visszautasítva)',
    phase: 'declined',
    bookable: false,
    sortOrder: 40,
  },
  { key: 'banned', name: 'Banned (kitiltva)', phase: 'banned', bookable: false, sortOrder: 50 },
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
      phase: seed.phase,
      displayLabel: seed.name,
      actionChip: '',
      nextStepMessage: '',
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

export async function createStatus(
  input: StatusFieldInput & { reminderTemplateId?: unknown },
): Promise<StatusMutationResult> {
  const parsed = validateStatusFields(input)
  if (!parsed.ok) return parsed

  const clash = await getStatusByKey(parsed.values.key)
  if (clash) return { ok: false, error: `Status key “${parsed.values.key}” is already in use.` }

  const reminder = await resolveReminderTemplateId(parsed.values.phase, input, '')
  if (!reminder.ok) return reminder

  const id = newId('onb_status')
  await db.insert(sfOnboardingStatuses).values({
    id,
    key: parsed.values.key,
    name: parsed.values.name,
    phase: parsed.values.phase,
    displayLabel: parsed.values.displayLabel,
    actionChip: parsed.values.actionChip,
    nextStepMessage: parsed.values.nextStepMessage,
    pageId: parsed.values.pageId,
    bookable: parsed.values.bookable,
    formDefinitionId: parsed.values.formDefinitionId,
    reminderTemplateId: reminder.value,
    sortOrder: parsed.values.sortOrder,
  })
  const saved = await getStatusById(id)
  if (!saved) return { ok: false, error: 'Failed to create status.' }
  return { ok: true, status: saved }
}

export async function updateStatus(
  id: string,
  input: StatusFieldInput & { reminderTemplateId?: unknown },
): Promise<StatusMutationResult> {
  const statusId = id.trim()
  if (!statusId) return { ok: false, error: 'Missing status id.' }
  const existing = await getStatusById(statusId)
  if (!existing) return { ok: false, error: 'Status not found.' }

  const parsed = validateStatusFields(input, {
    name: existing.name,
    key: existing.key,
    phase: existing.phase,
    displayLabel: existing.displayLabel,
    actionChip: existing.actionChip,
    nextStepMessage: existing.nextStepMessage,
    pageId: existing.pageId,
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

  const reminder = await resolveReminderTemplateId(
    parsed.values.phase,
    input,
    existing.reminderTemplateId,
  )
  if (!reminder.ok) return reminder

  await db
    .update(sfOnboardingStatuses)
    .set({
      key: parsed.values.key,
      name: parsed.values.name,
      phase: parsed.values.phase,
      displayLabel: parsed.values.displayLabel,
      actionChip: parsed.values.actionChip,
      nextStepMessage: parsed.values.nextStepMessage,
      pageId: parsed.values.pageId,
      bookable: parsed.values.bookable,
      formDefinitionId: parsed.values.formDefinitionId,
      reminderTemplateId: reminder.value,
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

/** Persist drag-and-drop order as dense sort_order indexes (0..n). */
export async function reorderStatuses(
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await listStatuses()
  const checked = validateStatusReorderIds(
    orderedIds,
    existing.map((row) => row.id),
  )
  if (!checked.ok) return checked

  try {
    const now = new Date()
    await Promise.all(
      checked.ids.map((id, index) =>
        db
          .update(sfOnboardingStatuses)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(sfOnboardingStatuses.id, id)),
      ),
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reorder statuses.',
    }
  }
}

/**
 * Station / depot catalog for pickers.
 * While Fleet is absent, this is the Onboarding depot list (short name as label).
 * Empty when no depots are configured. Does not import Fleet.
 */
export async function listStations(): Promise<OnboardingStationRecord[]> {
  const { listDepots } = await import('./depot-store')
  const depots = await listDepots()
  return depotsAsStationCatalog(depots)
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

  const previousStatusId = (existing?.statusId ?? '').trim()
  const statusChanged =
    parsed.values.statusId !== previousStatusId && Boolean(parsed.values.statusId)

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

  // Completed status for an event type → open events of that type become passed.
  // Never sets failed / no_show. Does not change the person’s status from the outcome.
  if (statusChanged) {
    try {
      const { applyCompletedStatusPassedOutcomes } = await import('./procedure-store')
      await applyCompletedStatusPassedOutcomes(id, parsed.values.statusId)
    } catch (error) {
      console.error('[onboarding] completed-status passed outcome failed', error)
    }
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
export { isBookable, statusListLabel, validateDriverCode }
