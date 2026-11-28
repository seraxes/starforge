/**
 * Document slots + valid-until dates on the person.
 * Answers stay in Forms; this pack stores the date (and Media id for the file).
 */

import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfOnboardingDocumentSlots } from './schema'
import type { OnboardingDocumentSlotRecord } from './types'
import {
  isOnboardingDocumentKind,
  presenceOnlyValidUntil,
  validateDocumentSlotFields,
  validatePersonValidUntilFields,
  type DocumentSlotFieldInput,
  type OnboardingDocumentKind,
  type PersonValidUntilInput,
} from './valid-until-rules'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function mapSlot(
  row: typeof sfOnboardingDocumentSlots.$inferSelect,
): OnboardingDocumentSlotRecord {
  const kind: OnboardingDocumentKind = isOnboardingDocumentKind(row.kind)
    ? row.kind
    : 'driving_licence'
  return {
    id: row.id,
    userId: (row.userId ?? '').trim(),
    kind,
    mediaId: (row.mediaId ?? '').trim(),
    validUntil: (row.validUntil ?? '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listDocumentSlotsForUser(
  userId: string,
): Promise<OnboardingDocumentSlotRecord[]> {
  const id = userId.trim()
  if (!id) return []
  const rows = await db
    .select()
    .from(sfOnboardingDocumentSlots)
    .where(eq(sfOnboardingDocumentSlots.userId, id))
    .orderBy(asc(sfOnboardingDocumentSlots.kind))
  return rows.map(mapSlot)
}

export async function getDocumentSlot(
  userId: string,
  kind: OnboardingDocumentKind,
): Promise<OnboardingDocumentSlotRecord | null> {
  const id = userId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingDocumentSlots)
    .where(
      and(
        eq(sfOnboardingDocumentSlots.userId, id),
        eq(sfOnboardingDocumentSlots.kind, kind),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? mapSlot(row) : null
}

/**
 * Upsert one document slot.
 * Empty valid-until is allowed (missing / presence-only).
 */
export async function upsertDocumentSlot(
  input: DocumentSlotFieldInput,
): Promise<
  | { ok: true; slot: OnboardingDocumentSlotRecord }
  | { ok: false; error: string }
> {
  const parsed = validateDocumentSlotFields(input)
  if (!parsed.ok) return parsed

  const existing = await getDocumentSlot(parsed.values.userId, parsed.values.kind)
  if (existing) {
    await db
      .update(sfOnboardingDocumentSlots)
      .set({
        mediaId: parsed.values.mediaId,
        validUntil: parsed.values.validUntil,
      })
      .where(eq(sfOnboardingDocumentSlots.id, existing.id))
    const refreshed = await getDocumentSlot(parsed.values.userId, parsed.values.kind)
    if (!refreshed) return { ok: false, error: 'Could not reload document slot.' }
    return { ok: true, slot: refreshed }
  }

  const id = newId('ondoc')
  await db.insert(sfOnboardingDocumentSlots).values({
    id,
    userId: parsed.values.userId,
    kind: parsed.values.kind,
    mediaId: parsed.values.mediaId,
    validUntil: parsed.values.validUntil,
  })
  const created = await getDocumentSlot(parsed.values.userId, parsed.values.kind)
  if (!created) return { ok: false, error: 'Could not create document slot.' }
  return { ok: true, slot: created }
}

/**
 * Import a presence-only live row: create the slot with an empty valid-until.
 * Empty is missing, not expired.
 */
export async function importPresenceOnlyDocumentSlot(input: {
  userId: string
  kind: OnboardingDocumentKind
  mediaId?: string
}): Promise<
  | { ok: true; slot: OnboardingDocumentSlotRecord }
  | { ok: false; error: string }
> {
  return upsertDocumentSlot({
    userId: input.userId,
    kind: input.kind,
    mediaId: input.mediaId ?? '',
    validUntil: presenceOnlyValidUntil(),
  })
}

/** Save the three person-card valid-until dates (and optional Media ids). */
export async function savePersonValidUntilDates(
  input: PersonValidUntilInput,
): Promise<
  | { ok: true; slots: OnboardingDocumentSlotRecord[] }
  | { ok: false; error: string }
> {
  const parsed = validatePersonValidUntilFields(input)
  if (!parsed.ok) return parsed

  const slots: OnboardingDocumentSlotRecord[] = []
  for (const row of parsed.values.slots) {
    const existing = await getDocumentSlot(parsed.values.userId, row.kind)
    const result = await upsertDocumentSlot({
      userId: parsed.values.userId,
      kind: row.kind,
      mediaId: row.mediaId || existing?.mediaId || '',
      validUntil: row.validUntil,
    })
    if (!result.ok) return result
    slots.push(result.slot)
  }
  return { ok: true, slots }
}
