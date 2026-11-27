/**
 * Onboarding depot catalog CRUD.
 * Used as the station / depot picker while Fleet is absent. No Fleet import.
 */

import 'server-only'

import { asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import {
  validateDepotFields,
  type DepotFieldInput,
} from './event-type-settings-rules'
import { sfOnboardingDepots } from './schema'
import type { OnboardingDepotRecord } from './types'

function newId(): string {
  return `depot_${randomUUID().replace(/-/g, '')}`
}

function mapDepot(row: typeof sfOnboardingDepots.$inferSelect): OnboardingDepotRecord {
  return {
    id: row.id,
    name: (row.name ?? '').trim(),
    address: (row.address ?? '').trim(),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listDepots(): Promise<OnboardingDepotRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingDepots)
    .orderBy(asc(sfOnboardingDepots.sortOrder), asc(sfOnboardingDepots.name))
  return rows.map(mapDepot)
}

export async function getDepotById(depotId: string): Promise<OnboardingDepotRecord | null> {
  const id = depotId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingDepots)
    .where(eq(sfOnboardingDepots.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapDepot(row) : null
}

export type DepotMutationResult =
  | { ok: true; depot: OnboardingDepotRecord }
  | { ok: false; error: string }

export async function createDepot(input: DepotFieldInput): Promise<DepotMutationResult> {
  const existing = await listDepots()
  const nextSort =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  const parsed = validateDepotFields({
    ...input,
    sortOrder: input.sortOrder !== undefined && input.sortOrder !== '' ? input.sortOrder : nextSort,
  })
  if (!parsed.ok) return parsed

  const id = newId()
  await db.insert(sfOnboardingDepots).values({
    id,
    name: parsed.values.name,
    address: parsed.values.address,
    sortOrder: parsed.values.sortOrder,
  })

  const saved = await getDepotById(id)
  if (!saved) return { ok: false, error: 'Failed to create depot.' }
  return { ok: true, depot: saved }
}

export async function updateDepot(
  depotId: string,
  input: DepotFieldInput,
): Promise<DepotMutationResult> {
  const id = depotId.trim()
  if (!id) return { ok: false, error: 'Missing depot id.' }
  const existing = await getDepotById(id)
  if (!existing) return { ok: false, error: 'Depot not found.' }

  const parsed = validateDepotFields(input, existing)
  if (!parsed.ok) return parsed

  await db
    .update(sfOnboardingDepots)
    .set({
      name: parsed.values.name,
      address: parsed.values.address,
      sortOrder: parsed.values.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingDepots.id, id))

  const saved = await getDepotById(id)
  if (!saved) return { ok: false, error: 'Failed to save depot.' }
  return { ok: true, depot: saved }
}

export async function deleteDepot(
  depotId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = depotId.trim()
  if (!id) return { ok: false, error: 'Missing depot id.' }
  const existing = await getDepotById(id)
  if (!existing) return { ok: false, error: 'Depot not found.' }
  await db.delete(sfOnboardingDepots).where(eq(sfOnboardingDepots.id, id))
  return { ok: true }
}
