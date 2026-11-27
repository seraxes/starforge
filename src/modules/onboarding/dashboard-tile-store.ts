/**
 * Onboarding driver-home dashboard tile CRUD.
 */

import 'server-only'

import { asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import {
  validateDashboardTileFields,
  type DashboardTileFieldInput,
} from './dashboard-tile-rules'
import { sfOnboardingDashboardTiles } from './schema'
import type { OnboardingDashboardTileRecord } from './types'

function newId(): string {
  return `tile_${randomUUID().replace(/-/g, '')}`
}

function mapTile(
  row: typeof sfOnboardingDashboardTiles.$inferSelect,
): OnboardingDashboardTileRecord {
  const statusIds = Array.isArray(row.statusIds)
    ? row.statusIds.map((id) => String(id ?? '').trim()).filter(Boolean)
    : []
  return {
    id: row.id,
    title: (row.title ?? '').trim(),
    icon: (row.icon ?? '').trim(),
    url: (row.url ?? '').trim(),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    published: Boolean(row.published),
    statusIds,
    staffOnly: Boolean(row.staffOnly),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listDashboardTiles(): Promise<OnboardingDashboardTileRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingDashboardTiles)
    .orderBy(asc(sfOnboardingDashboardTiles.sortOrder), asc(sfOnboardingDashboardTiles.title))
  return rows.map(mapTile)
}

export async function getDashboardTileById(
  tileId: string,
): Promise<OnboardingDashboardTileRecord | null> {
  const id = tileId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfOnboardingDashboardTiles)
    .where(eq(sfOnboardingDashboardTiles.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapTile(row) : null
}

export type DashboardTileMutationResult =
  | { ok: true; tile: OnboardingDashboardTileRecord }
  | { ok: false; error: string }

export async function createDashboardTile(
  input: DashboardTileFieldInput,
): Promise<DashboardTileMutationResult> {
  const existing = await listDashboardTiles()
  const nextSort =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  const parsed = validateDashboardTileFields({
    ...input,
    sortOrder:
      input.sortOrder !== undefined && input.sortOrder !== '' ? input.sortOrder : nextSort,
  })
  if (!parsed.ok) return parsed

  const id = newId()
  await db.insert(sfOnboardingDashboardTiles).values({
    id,
    title: parsed.values.title,
    icon: parsed.values.icon,
    url: parsed.values.url,
    sortOrder: parsed.values.sortOrder,
    published: parsed.values.published,
    statusIds: parsed.values.statusIds,
    staffOnly: parsed.values.staffOnly,
  })

  const saved = await getDashboardTileById(id)
  if (!saved) return { ok: false, error: 'Failed to create tile.' }
  return { ok: true, tile: saved }
}

export async function updateDashboardTile(
  tileId: string,
  input: DashboardTileFieldInput,
): Promise<DashboardTileMutationResult> {
  const id = tileId.trim()
  if (!id) return { ok: false, error: 'Missing tile id.' }
  const existing = await getDashboardTileById(id)
  if (!existing) return { ok: false, error: 'Tile not found.' }

  const parsed = validateDashboardTileFields(input, existing)
  if (!parsed.ok) return parsed

  await db
    .update(sfOnboardingDashboardTiles)
    .set({
      title: parsed.values.title,
      icon: parsed.values.icon,
      url: parsed.values.url,
      sortOrder: parsed.values.sortOrder,
      published: parsed.values.published,
      statusIds: parsed.values.statusIds,
      staffOnly: parsed.values.staffOnly,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingDashboardTiles.id, id))

  const saved = await getDashboardTileById(id)
  if (!saved) return { ok: false, error: 'Failed to save tile.' }
  return { ok: true, tile: saved }
}

export async function deleteDashboardTile(
  tileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = tileId.trim()
  if (!id) return { ok: false, error: 'Missing tile id.' }
  const existing = await getDashboardTileById(id)
  if (!existing) return { ok: false, error: 'Tile not found.' }
  await db.delete(sfOnboardingDashboardTiles).where(eq(sfOnboardingDashboardTiles.id, id))
  return { ok: true }
}
