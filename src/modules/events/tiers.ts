/**
 * Event ticket tiers CRUD + occupancy (product:events densify).
 */

import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfEventRegistrations, sfEventTicketTiers } from './schema'
import { findEventById } from './store'
import { isTicketTierKind, type TicketTierKind } from './types'

export type { TicketTierKind }
export { TICKET_TIER_KINDS, isTicketTierKind } from './types'

export type TicketTierRecord = {
  id: string
  eventId: string
  title: string
  description: string
  kind: TicketTierKind
  capacity: number | null
  priceLabel: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

function mapTier(row: typeof sfEventTicketTiers.$inferSelect): TicketTierRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title?.trim() || 'Ticket',
    description: row.description ?? '',
    kind: isTicketTierKind(row.kind) ? row.kind : 'general',
    capacity:
      typeof row.capacity === 'number' && Number.isFinite(row.capacity) && row.capacity >= 0
        ? Math.floor(row.capacity)
        : null,
    priceLabel: row.priceLabel ?? '',
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseCapacity(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

export async function listTicketTiersForEvent(
  eventId: string,
): Promise<TicketTierRecord[]> {
  const trimmed = eventId.trim()
  if (!trimmed) return []
  try {
    const rows = await db
      .select()
      .from(sfEventTicketTiers)
      .where(eq(sfEventTicketTiers.eventId, trimmed))
      .orderBy(asc(sfEventTicketTiers.sortOrder), asc(sfEventTicketTiers.title))
    return rows.map(mapTier)
  } catch {
    return []
  }
}

export async function findTicketTierById(
  id: string,
): Promise<TicketTierRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventTicketTiers)
      .where(eq(sfEventTicketTiers.id, trimmed))
      .limit(1)
    return row ? mapTier(row) : null
  } catch {
    return null
  }
}

export async function countRegisteredGuestsForTier(
  eventId: string,
  tierId: string,
): Promise<number> {
  try {
    const [row] = await db
      .select({
        n: sql<number>`coalesce(sum(${sfEventRegistrations.guests}), 0)`,
      })
      .from(sfEventRegistrations)
      .where(
        and(
          eq(sfEventRegistrations.eventId, eventId.trim()),
          eq(sfEventRegistrations.ticketTierId, tierId.trim()),
          eq(sfEventRegistrations.status, 'registered'),
        ),
      )
    return Number(row?.n) || 0
  } catch {
    return 0
  }
}

export type UpsertTicketTierInput = {
  id?: string
  eventId: string
  title: string
  description?: string
  kind?: string
  capacity?: unknown
  priceLabel?: string
  sortOrder?: unknown
}

export async function createTicketTier(
  input: UpsertTicketTierInput,
): Promise<{ tier: TicketTierRecord } | { error: string }> {
  const eventId = input.eventId.trim()
  if (!eventId) return { error: 'Missing event id.' }
  const event = await findEventById(eventId)
  if (!event) return { error: 'Event not found.' }

  const title = input.title.trim().slice(0, 200) || 'Ticket'
  const description = (input.description || '').trim().slice(0, 2000)
  const kind: TicketTierKind = isTicketTierKind(input.kind) ? input.kind : 'general'
  const capacity = parseCapacity(input.capacity)
  const priceLabel = (input.priceLabel || '').trim().slice(0, 80)
  const sortRaw = input.sortOrder
  const sortOrder =
    typeof sortRaw === 'number' && Number.isFinite(sortRaw)
      ? Math.floor(sortRaw)
      : Number.isFinite(Number(sortRaw))
        ? Math.floor(Number(sortRaw))
        : 0
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfEventTicketTiers).values({
      id,
      eventId,
      title,
      description,
      kind,
      capacity,
      priceLabel,
      sortOrder,
    })
    const created = await findTicketTierById(id)
    if (!created) return { error: 'Tier created but could not be reloaded.' }
    return { tier: created }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_event_ticket_tiers|does not exist|relation/i.test(msg)) {
      return {
        error: 'sf_event_ticket_tiers missing — run npm run db:migrate.',
      }
    }
    return {
      error: error instanceof Error ? error.message : 'Could not create tier.',
    }
  }
}

export async function updateTicketTier(
  input: UpsertTicketTierInput & { id: string },
): Promise<{ tier: TicketTierRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing tier id.' }
  const current = await findTicketTierById(id)
  if (!current) return { error: 'Tier not found.' }

  const title = input.title.trim().slice(0, 200) || current.title
  const description =
    input.description !== undefined
      ? input.description.trim().slice(0, 2000)
      : current.description
  const kind: TicketTierKind = isTicketTierKind(input.kind)
    ? input.kind
    : current.kind
  const capacity =
    input.capacity !== undefined ? parseCapacity(input.capacity) : current.capacity
  const priceLabel =
    input.priceLabel !== undefined
      ? input.priceLabel.trim().slice(0, 80)
      : current.priceLabel
  const sortOrder =
    input.sortOrder !== undefined
      ? Number.isFinite(Number(input.sortOrder))
        ? Math.floor(Number(input.sortOrder))
        : current.sortOrder
      : current.sortOrder

  try {
    await db
      .update(sfEventTicketTiers)
      .set({
        title,
        description,
        kind,
        capacity,
        priceLabel,
        sortOrder,
      })
      .where(eq(sfEventTicketTiers.id, id))
    const updated = await findTicketTierById(id)
    if (!updated) return { error: 'Tier updated but could not be reloaded.' }
    return { tier: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update tier.',
    }
  }
}

export async function deleteTicketTier(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing tier id.' }
  try {
    await db.delete(sfEventTicketTiers).where(eq(sfEventTicketTiers.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete tier.',
    }
  }
}
