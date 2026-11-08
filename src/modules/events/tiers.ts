/**
 * Event ticket tiers CRUD + occupancy (product:events densify).
 */

import 'server-only'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'
import { sanitizeCssColor } from '@/core/modules/styles'

import { sfEventRegistrations, sfEventTicketTiers } from './schema'
import { findEventById } from './store'
import {
  DEFAULT_MAX_TICKETS_PER_BOOKING,
  isTicketTierKind,
  type TicketTierKind,
} from './types'

export type { TicketTierKind }
export {
  DEFAULT_MAX_TICKETS_PER_BOOKING,
  TICKET_TIER_KINDS,
  isTicketTierKind,
} from './types'

export type TicketTierRecord = {
  id: string
  eventId: string
  title: string
  shortDescription: string
  description: string
  kind: TicketTierKind
  capacity: number | null
  /** Max guests on one booking; null → DEFAULT_MAX_TICKETS_PER_BOOKING. */
  maxPerBooking: number | null
  /** Base price in major units; null = unset. */
  price: number | null
  /** Added to price for effective amount (may be negative). */
  priceModifier: number
  /** Optional text that overwrites formatted price on public cards. */
  priceLabel: string
  titleColor: string
  borderColor: string
  backgroundColor: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** Normalize admin color input — empty clears; invalid → empty (theme default). */
function parseTierColor(raw: unknown): string {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  return sanitizeCssColor(trimmed) ?? ''
}

function mapTier(row: typeof sfEventTicketTiers.$inferSelect): TicketTierRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title?.trim() || 'Ticket',
    shortDescription: row.shortDescription ?? '',
    description: row.description ?? '',
    kind: isTicketTierKind(row.kind) ? row.kind : 'general',
    capacity:
      typeof row.capacity === 'number' && Number.isFinite(row.capacity) && row.capacity >= 0
        ? Math.floor(row.capacity)
        : null,
    maxPerBooking:
      typeof row.maxPerBooking === 'number' &&
      Number.isFinite(row.maxPerBooking) &&
      row.maxPerBooking >= 1
        ? Math.floor(row.maxPerBooking)
        : null,
    price:
      typeof row.price === 'number' && Number.isFinite(row.price)
        ? Math.floor(row.price)
        : null,
    priceModifier:
      typeof row.priceModifier === 'number' && Number.isFinite(row.priceModifier)
        ? Math.floor(row.priceModifier)
        : 0,
    priceLabel: row.priceLabel ?? '',
    titleColor: parseTierColor(row.titleColor),
    borderColor: parseTierColor(row.borderColor),
    backgroundColor: parseTierColor(row.backgroundColor),
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

/** Empty → null (default booking cap). Otherwise 1…100. */
function parseMaxPerBooking(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(Math.floor(n), 100)
}

/** Empty → null. Otherwise integer (may be 0). */
function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  return Math.floor(n)
}

/** Empty → 0. Integer modifier (may be negative). */
function parsePriceModifier(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return 0
  return Math.floor(n)
}

/** Effective max guests for one booking on this tier. */
export function effectiveMaxTicketsPerBooking(
  maxPerBooking: number | null | undefined,
): number {
  if (
    typeof maxPerBooking === 'number' &&
    Number.isFinite(maxPerBooking) &&
    maxPerBooking >= 1
  ) {
    return Math.min(Math.floor(maxPerBooking), 100)
  }
  return DEFAULT_MAX_TICKETS_PER_BOOKING
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
          inArray(sfEventRegistrations.status, ['registered', 'pending_payment']),
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
  shortDescription?: string
  description?: string
  kind?: string
  capacity?: unknown
  maxPerBooking?: unknown
  price?: unknown
  priceModifier?: unknown
  priceLabel?: string
  titleColor?: string
  borderColor?: string
  backgroundColor?: string
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
  const shortDescription = (input.shortDescription || '').trim().slice(0, 280)
  const description = (input.description || '').trim().slice(0, 2000)
  const kind: TicketTierKind = isTicketTierKind(input.kind) ? input.kind : 'general'
  const capacity = parseCapacity(input.capacity)
  const maxPerBooking = parseMaxPerBooking(input.maxPerBooking)
  const price = parsePrice(input.price)
  const priceModifier = parsePriceModifier(input.priceModifier)
  const priceLabel = (input.priceLabel || '').trim().slice(0, 80)
  const titleColor = parseTierColor(input.titleColor)
  const borderColor = parseTierColor(input.borderColor)
  const backgroundColor = parseTierColor(input.backgroundColor)
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
      shortDescription,
      description,
      kind,
      capacity,
      maxPerBooking,
      price,
      priceModifier,
      priceLabel,
      titleColor,
      borderColor,
      backgroundColor,
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
  const shortDescription =
    input.shortDescription !== undefined
      ? input.shortDescription.trim().slice(0, 280)
      : current.shortDescription
  const description =
    input.description !== undefined
      ? input.description.trim().slice(0, 2000)
      : current.description
  const kind: TicketTierKind = isTicketTierKind(input.kind)
    ? input.kind
    : current.kind
  const capacity =
    input.capacity !== undefined ? parseCapacity(input.capacity) : current.capacity
  const maxPerBooking =
    input.maxPerBooking !== undefined
      ? parseMaxPerBooking(input.maxPerBooking)
      : current.maxPerBooking
  const price =
    input.price !== undefined ? parsePrice(input.price) : current.price
  const priceModifier =
    input.priceModifier !== undefined
      ? parsePriceModifier(input.priceModifier)
      : current.priceModifier
  const priceLabel =
    input.priceLabel !== undefined
      ? input.priceLabel.trim().slice(0, 80)
      : current.priceLabel
  const titleColor =
    input.titleColor !== undefined
      ? parseTierColor(input.titleColor)
      : current.titleColor
  const borderColor =
    input.borderColor !== undefined
      ? parseTierColor(input.borderColor)
      : current.borderColor
  const backgroundColor =
    input.backgroundColor !== undefined
      ? parseTierColor(input.backgroundColor)
      : current.backgroundColor
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
        shortDescription,
        description,
        kind,
        capacity,
        maxPerBooking,
        price,
        priceModifier,
        priceLabel,
        titleColor,
        borderColor,
        backgroundColor,
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

/** Persist drag-and-drop order for an event’s ticket types. */
export async function reorderTicketTiers(
  eventId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const trimmedEvent = eventId.trim()
  if (!trimmedEvent) return { error: 'Missing event id.' }
  const ids = orderedIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) return { error: 'Missing tier order.' }

  try {
    const existing = await listTicketTiersForEvent(trimmedEvent)
    const existingIds = new Set(existing.map((t) => t.id))
    if (ids.length !== existing.length || ids.some((id) => !existingIds.has(id))) {
      return { error: 'Ticket type order is out of date — refresh and try again.' }
    }

    await Promise.all(
      ids.map((id, index) =>
        db
          .update(sfEventTicketTiers)
          .set({ sortOrder: index })
          .where(and(eq(sfEventTicketTiers.id, id), eq(sfEventTicketTiers.eventId, trimmedEvent))),
      ),
    )
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not reorder ticket types.',
    }
  }
}
