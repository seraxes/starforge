/**
 * Event parties — organizers / speakers / sponsors (product:events Wave B).
 */

import 'server-only'

import { asc, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfEventParties } from './schema'
import {
  isEventPartyKind,
  type EventPartyKind,
  type EventPartyRecord,
} from './types'

function mapParty(row: typeof sfEventParties.$inferSelect): EventPartyRecord {
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled',
    kind: isEventPartyKind(row.kind) ? row.kind : 'other',
    url: (row.url || '').trim(),
    blurb: (row.blurb || '').trim(),
    avatarMediaId: (row.avatarMediaId || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listEventParties(filter?: {
  kind?: string
}): Promise<EventPartyRecord[]> {
  try {
    const kind = (filter?.kind || '').trim()
    const rows =
      kind && isEventPartyKind(kind)
        ? await db
            .select()
            .from(sfEventParties)
            .where(eq(sfEventParties.kind, kind))
            .orderBy(asc(sfEventParties.name), asc(sfEventParties.id))
        : await db
            .select()
            .from(sfEventParties)
            .orderBy(asc(sfEventParties.kind), asc(sfEventParties.name), asc(sfEventParties.id))
    return rows.map(mapParty)
  } catch {
    return []
  }
}

export async function findEventPartyById(id: string): Promise<EventPartyRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventParties)
      .where(eq(sfEventParties.id, trimmed))
      .limit(1)
    return row ? mapParty(row) : null
  } catch {
    return null
  }
}

export async function listEventPartiesByIds(ids: string[]): Promise<EventPartyRecord[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []
  const found = await Promise.all(unique.map((id) => findEventPartyById(id)))
  return found.filter((p): p is EventPartyRecord => Boolean(p))
}

export type UpsertPartyInput = {
  id?: string
  name: string
  kind?: string
  url?: string
  blurb?: string
  avatarMediaId?: string
}

export async function createEventParty(
  input: UpsertPartyInput,
): Promise<{ party: EventPartyRecord } | { error: string }> {
  const name = input.name.trim().slice(0, 200) || 'Untitled'
  const kind: EventPartyKind = isEventPartyKind(input.kind) ? input.kind : 'organizer'
  const url = (input.url || '').trim().slice(0, 2000)
  const blurb = (input.blurb || '').trim().slice(0, 2000)
  const avatarMediaId = (input.avatarMediaId || '').trim() || null
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfEventParties).values({
      id,
      name,
      kind,
      url,
      blurb,
      avatarMediaId,
    })
    const created = await findEventPartyById(id)
    if (!created) return { error: 'Party created but could not be reloaded.' }
    return { party: created }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_event_parties|does not exist|relation/i.test(msg)) {
      return {
        error: 'sf_event_parties missing — run npm run db:migrate (or db:core:push).',
      }
    }
    return {
      error: error instanceof Error ? error.message : 'Could not create party.',
    }
  }
}

export async function updateEventParty(
  input: UpsertPartyInput & { id: string },
): Promise<{ party: EventPartyRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing party id.' }
  const current = await findEventPartyById(id)
  if (!current) return { error: 'Party not found.' }

  const name = input.name.trim().slice(0, 200) || current.name
  const kind: EventPartyKind = isEventPartyKind(input.kind) ? input.kind : current.kind
  const url =
    input.url !== undefined ? input.url.trim().slice(0, 2000) : current.url
  const blurb =
    input.blurb !== undefined ? input.blurb.trim().slice(0, 2000) : current.blurb
  const avatarMediaId =
    input.avatarMediaId !== undefined
      ? input.avatarMediaId.trim() || null
      : current.avatarMediaId || null

  try {
    await db
      .update(sfEventParties)
      .set({ name, kind, url, blurb, avatarMediaId })
      .where(eq(sfEventParties.id, id))
    const updated = await findEventPartyById(id)
    if (!updated) return { error: 'Party updated but could not be reloaded.' }
    return { party: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update party.',
    }
  }
}

export async function deleteEventParty(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing party id.' }
  try {
    await db.delete(sfEventParties).where(eq(sfEventParties.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete party.',
    }
  }
}
