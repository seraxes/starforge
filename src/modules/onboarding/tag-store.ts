/**
 * Onboarding staff tag catalog CRUD.
 * A tag marks a person; it does not move status. Follow-ups store these ids.
 */

import 'server-only'

import { asc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import {
  SEEDED_ONBOARDING_TAGS,
  validateTagFields,
  type TagFieldInput,
} from './tag-catalog-rules'
import { sfOnboardingTags } from './schema'
import type { OnboardingTagRecord } from './types'

function newId(): string {
  return `tag_${randomUUID().replace(/-/g, '')}`
}

function mapTag(row: typeof sfOnboardingTags.$inferSelect): OnboardingTagRecord {
  return {
    id: row.id,
    label: (row.label ?? '').trim(),
    color: (row.color ?? '').trim(),
    todo: Boolean(row.todo),
    fade: Boolean(row.fade),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listTags(): Promise<OnboardingTagRecord[]> {
  const rows = await db
    .select()
    .from(sfOnboardingTags)
    .orderBy(asc(sfOnboardingTags.sortOrder), asc(sfOnboardingTags.label))
  return rows.map(mapTag)
}

export async function getTagById(tagId: string): Promise<OnboardingTagRecord | null> {
  const id = tagId.trim()
  if (!id) return null
  const rows = await db.select().from(sfOnboardingTags).where(eq(sfOnboardingTags.id, id)).limit(1)
  const row = rows[0]
  return row ? mapTag(row) : null
}

export async function listTagsByIds(tagIds: string[]): Promise<OnboardingTagRecord[]> {
  const ids = [...new Set(tagIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []
  const rows = await db.select().from(sfOnboardingTags).where(inArray(sfOnboardingTags.id, ids))
  const byId = new Map(rows.map((row) => [row.id, mapTag(row)]))
  return ids.map((id) => byId.get(id)).filter((row): row is OnboardingTagRecord => Boolean(row))
}

/** Ensure example Waiting / On hold / Action required / No response exist. Idempotent by id. */
export async function ensureSeededTags(): Promise<OnboardingTagRecord[]> {
  const existing = await listTags()
  const byId = new Map(existing.map((row) => [row.id, row]))
  for (const seed of SEEDED_ONBOARDING_TAGS) {
    if (byId.has(seed.id)) continue
    await db.insert(sfOnboardingTags).values({
      id: seed.id,
      label: seed.label,
      color: seed.color,
      todo: seed.todo,
      fade: seed.fade,
      sortOrder: seed.sortOrder,
    })
    const saved = await getTagById(seed.id)
    if (saved) byId.set(saved.id, saved)
  }
  return [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  )
}

export type TagMutationResult =
  | { ok: true; tag: OnboardingTagRecord }
  | { ok: false; error: string }

export async function createTag(input: TagFieldInput): Promise<TagMutationResult> {
  const existing = await listTags()
  const nextSort =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  const parsed = validateTagFields({
    ...input,
    sortOrder: input.sortOrder !== undefined && input.sortOrder !== '' ? input.sortOrder : nextSort,
  })
  if (!parsed.ok) return parsed

  const id = newId()
  await db.insert(sfOnboardingTags).values({
    id,
    label: parsed.values.label,
    color: parsed.values.color,
    todo: parsed.values.todo,
    fade: parsed.values.fade,
    sortOrder: parsed.values.sortOrder,
  })

  const saved = await getTagById(id)
  if (!saved) return { ok: false, error: 'Failed to create tag.' }
  return { ok: true, tag: saved }
}

export async function updateTag(
  tagId: string,
  input: TagFieldInput,
): Promise<TagMutationResult> {
  const id = tagId.trim()
  if (!id) return { ok: false, error: 'Missing tag id.' }
  const existing = await getTagById(id)
  if (!existing) return { ok: false, error: 'Tag not found.' }

  const parsed = validateTagFields(input, existing)
  if (!parsed.ok) return parsed

  await db
    .update(sfOnboardingTags)
    .set({
      label: parsed.values.label,
      color: parsed.values.color,
      todo: parsed.values.todo,
      fade: parsed.values.fade,
      sortOrder: parsed.values.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(sfOnboardingTags.id, id))

  const saved = await getTagById(id)
  if (!saved) return { ok: false, error: 'Failed to save tag.' }
  return { ok: true, tag: saved }
}

export async function deleteTag(
  tagId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = tagId.trim()
  if (!id) return { ok: false, error: 'Missing tag id.' }
  const existing = await getTagById(id)
  if (!existing) return { ok: false, error: 'Tag not found.' }
  await db.delete(sfOnboardingTags).where(eq(sfOnboardingTags.id, id))
  return { ok: true }
}
