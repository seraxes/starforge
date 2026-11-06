/**
 * Events + venues persistence (product:events PR1).
 */

import 'server-only'

import { and, asc, count, eq, gte, lt } from 'drizzle-orm'

import { db } from '@/core/db'
import { normalizeAccessTags } from '@/core/acl/nav-access'
import { sanitizeRichHtml } from '@/core/rich-editor/sanitize'

import { sfEvents, sfVenues } from './schema'
import {
  isEventStatus,
  type EventRecord,
  type EventStatus,
  type VenueRecord,
} from './types'

function mapVenue(row: typeof sfVenues.$inferSelect): VenueRecord {
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled venue',
    address: row.address ?? '',
    latitude:
      typeof row.latitude === 'number' && Number.isFinite(row.latitude)
        ? row.latitude
        : null,
    longitude:
      typeof row.longitude === 'number' && Number.isFinite(row.longitude)
        ? row.longitude
        : null,
    coverMediaId: (row.coverMediaId || '').trim(),
    accessTags: normalizeAccessTags({ accessTags: row.accessTags }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseOptionalCoord(raw: unknown, min: number, max: number): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function mapEvent(row: typeof sfEvents.$inferSelect): EventRecord {
  const gallery = Array.isArray(row.galleryMediaIds)
    ? row.galleryMediaIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    : []
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled event',
    slug: (row.slug || '').trim(),
    status: isEventStatus(row.status) ? row.status : 'draft',
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    timezone: (row.timezone || 'UTC').trim() || 'UTC',
    venueId: (row.venueId || '').trim(),
    description: row.description ?? '',
    coverMediaId: (row.coverMediaId || '').trim(),
    galleryMediaIds: gallery.map((id) => id.trim()).filter(Boolean),
    capacity:
      typeof row.capacity === 'number' && Number.isFinite(row.capacity) && row.capacity >= 0
        ? Math.floor(row.capacity)
        : null,
    accessTags: normalizeAccessTags({ accessTags: row.accessTags }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function tableMissingMessage(error: unknown, table: string): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes(table) || /does not exist|relation/i.test(msg)) {
    return `${table} missing — run npm run db:migrate (or db:core:push).`
  }
  return null
}

function normalizeAccessTagsForDb(raw: unknown): string[] {
  const tags = normalizeAccessTags({ accessTags: raw })
  if (tags.length === 1 && tags[0] === 'public') return []
  return tags
}

function parseOptionalDate(raw: unknown): Date | null {
  if (raw == null) return null
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw
  }
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseOptionalCapacity(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function normalizeSlug(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return s || null
}

function normalizeGalleryIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((id) => String(id ?? '').trim())
      .filter(Boolean)
      .slice(0, 40)
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return normalizeGalleryIds(parsed)
    } catch {
      /* comma-separated */
    }
    return raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40)
  }
  return []
}

/* ─── Venues ─────────────────────────────────────────────────────────────── */

export async function listVenues(): Promise<VenueRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfVenues)
      .orderBy(asc(sfVenues.name), asc(sfVenues.id))
    return rows.map(mapVenue)
  } catch {
    return []
  }
}

export async function findVenueById(id: string): Promise<VenueRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfVenues)
      .where(eq(sfVenues.id, trimmed))
      .limit(1)
    return row ? mapVenue(row) : null
  } catch {
    return null
  }
}

export type UpsertVenueInput = {
  id?: string
  name: string
  address?: string
  latitude?: unknown
  longitude?: unknown
  coverMediaId?: string
  accessTags?: unknown
}

export async function createVenue(
  input: UpsertVenueInput,
): Promise<{ venue: VenueRecord } | { error: string }> {
  const name = input.name.trim().slice(0, 200) || 'Untitled venue'
  const address = (input.address || '').trim().slice(0, 2000)
  const latitude = parseOptionalCoord(input.latitude, -90, 90)
  const longitude = parseOptionalCoord(input.longitude, -180, 180)
  const coverMediaId = (input.coverMediaId || '').trim() || null
  const accessTags = normalizeAccessTagsForDb(input.accessTags)
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfVenues).values({
      id,
      name,
      address,
      latitude,
      longitude,
      coverMediaId,
      accessTags,
    })
    const created = await findVenueById(id)
    if (!created) return { error: 'Venue created but could not be reloaded.' }
    return { venue: created }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_venues')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create venue.',
    }
  }
}

export async function updateVenue(
  input: UpsertVenueInput & { id: string },
): Promise<{ venue: VenueRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing venue id.' }
  const current = await findVenueById(id)
  if (!current) return { error: 'Venue not found.' }

  const name = input.name.trim().slice(0, 200) || current.name
  const address = (input.address ?? current.address).trim().slice(0, 2000)
  const latitude =
    input.latitude !== undefined
      ? parseOptionalCoord(input.latitude, -90, 90)
      : current.latitude
  const longitude =
    input.longitude !== undefined
      ? parseOptionalCoord(input.longitude, -180, 180)
      : current.longitude
  const coverMediaId =
    input.coverMediaId !== undefined
      ? input.coverMediaId.trim() || null
      : current.coverMediaId || null
  const accessTags =
    input.accessTags !== undefined
      ? normalizeAccessTagsForDb(input.accessTags)
      : normalizeAccessTagsForDb(current.accessTags)

  try {
    await db
      .update(sfVenues)
      .set({
        name,
        address,
        latitude,
        longitude,
        coverMediaId,
        accessTags,
      })
      .where(eq(sfVenues.id, id))
    const updated = await findVenueById(id)
    if (!updated) return { error: 'Venue updated but could not be reloaded.' }
    return { venue: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update venue.',
    }
  }
}

export async function deleteVenue(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing venue id.' }
  try {
    await db.delete(sfVenues).where(eq(sfVenues.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete venue.',
    }
  }
}

/* ─── Events ─────────────────────────────────────────────────────────────── */

export async function listEvents(filter?: {
  status?: string
}): Promise<EventRecord[]> {
  try {
    const status = filter?.status?.trim()
    const rows =
      status && status !== 'all' && isEventStatus(status)
        ? await db
            .select()
            .from(sfEvents)
            .where(eq(sfEvents.status, status))
            .orderBy(asc(sfEvents.startsAt), asc(sfEvents.title), asc(sfEvents.id))
        : await db
            .select()
            .from(sfEvents)
            .orderBy(asc(sfEvents.startsAt), asc(sfEvents.title), asc(sfEvents.id))
    return rows.map(mapEvent)
  } catch {
    return []
  }
}

export async function findEventById(id: string): Promise<EventRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEvents)
      .where(eq(sfEvents.id, trimmed))
      .limit(1)
    return row ? mapEvent(row) : null
  } catch {
    return null
  }
}

export type UpsertEventInput = {
  id?: string
  title: string
  slug?: string
  status?: string
  startsAt?: unknown
  endsAt?: unknown
  timezone?: string
  venueId?: string
  description?: string
  coverMediaId?: string
  galleryMediaIds?: unknown
  capacity?: unknown
  accessTags?: unknown
}

export async function createEvent(
  input: UpsertEventInput,
): Promise<{ event: EventRecord } | { error: string }> {
  const title = input.title.trim().slice(0, 200) || 'Untitled event'
  const status: EventStatus = isEventStatus(input.status) ? input.status : 'draft'
  const timezone = (input.timezone || 'UTC').trim().slice(0, 80) || 'UTC'
  const venueId = (input.venueId || '').trim() || null
  const description = sanitizeRichHtml(input.description || '').slice(0, 50_000)
  const coverMediaId = (input.coverMediaId || '').trim() || null
  const galleryMediaIds = normalizeGalleryIds(input.galleryMediaIds)
  const capacity = parseOptionalCapacity(input.capacity)
  const startsAt = parseOptionalDate(input.startsAt)
  const endsAt = parseOptionalDate(input.endsAt)
  const slug = normalizeSlug(input.slug)
  const accessTags = normalizeAccessTagsForDb(input.accessTags)
  const id = (input.id || '').trim() || crypto.randomUUID()

  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: 'End time must be on or after start time.' }
  }
  if (venueId) {
    const venue = await findVenueById(venueId)
    if (!venue) return { error: 'Selected venue was not found.' }
  }

  try {
    await db.insert(sfEvents).values({
      id,
      title,
      slug,
      status,
      startsAt,
      endsAt,
      timezone,
      venueId,
      description,
      coverMediaId,
      galleryMediaIds,
      capacity,
      accessTags,
    })
    const created = await findEventById(id)
    if (!created) return { error: 'Event created but could not be reloaded.' }
    return { event: created }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_events')
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create event.',
    }
  }
}

export async function updateEvent(
  input: UpsertEventInput & { id: string },
): Promise<{ event: EventRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing event id.' }
  const current = await findEventById(id)
  if (!current) return { error: 'Event not found.' }

  const title = input.title.trim().slice(0, 200) || current.title
  const status: EventStatus = isEventStatus(input.status) ? input.status : current.status
  const timezone =
    (input.timezone ?? current.timezone).trim().slice(0, 80) || current.timezone
  const venueId =
    input.venueId !== undefined
      ? input.venueId.trim() || null
      : current.venueId || null
  const description =
    input.description !== undefined
      ? sanitizeRichHtml(input.description).slice(0, 50_000)
      : current.description
  const coverMediaId =
    input.coverMediaId !== undefined
      ? input.coverMediaId.trim() || null
      : current.coverMediaId || null
  const galleryMediaIds =
    input.galleryMediaIds !== undefined
      ? normalizeGalleryIds(input.galleryMediaIds)
      : current.galleryMediaIds
  const capacity =
    input.capacity !== undefined
      ? parseOptionalCapacity(input.capacity)
      : current.capacity
  const startsAt =
    input.startsAt !== undefined ? parseOptionalDate(input.startsAt) : current.startsAt
  const endsAt =
    input.endsAt !== undefined ? parseOptionalDate(input.endsAt) : current.endsAt
  const slug =
    input.slug !== undefined ? normalizeSlug(input.slug) : current.slug || null
  const accessTags =
    input.accessTags !== undefined
      ? normalizeAccessTagsForDb(input.accessTags)
      : normalizeAccessTagsForDb(current.accessTags)

  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: 'End time must be on or after start time.' }
  }
  if (venueId) {
    const venue = await findVenueById(venueId)
    if (!venue) return { error: 'Selected venue was not found.' }
  }

  try {
    await db
      .update(sfEvents)
      .set({
        title,
        slug,
        status,
        startsAt,
        endsAt,
        timezone,
        venueId,
        description,
        coverMediaId,
        galleryMediaIds,
        capacity,
        accessTags,
      })
      .where(eq(sfEvents.id, id))
    const updated = await findEventById(id)
    if (!updated) return { error: 'Event updated but could not be reloaded.' }
    return { event: updated }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update event.',
    }
  }
}

export async function deleteEvent(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing event id.' }
  try {
    await db.delete(sfEvents).where(eq(sfEvents.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete event.',
    }
  }
}

/** Published upcoming counts for the Dashboard card. */
export async function countUpcomingEvents(now = new Date()): Promise<{
  upcoming: number
  thisWeek: number
}> {
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [upcomingRow] = await db
    .select({ n: count() })
    .from(sfEvents)
    .where(
      and(
        eq(sfEvents.status, 'published'),
        gte(sfEvents.startsAt, now),
      ),
    )
  const [weekRow] = await db
    .select({ n: count() })
    .from(sfEvents)
    .where(
      and(
        eq(sfEvents.status, 'published'),
        gte(sfEvents.startsAt, now),
        lt(sfEvents.startsAt, weekEnd),
      ),
    )
  return {
    upcoming: Number(upcomingRow?.n) || 0,
    thisWeek: Number(weekRow?.n) || 0,
  }
}
