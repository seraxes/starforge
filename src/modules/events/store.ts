/**
 * Events + venues persistence (product:events PR1).
 */

import 'server-only'

import { and, asc, count, eq, gte, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/core/db'
import {
  canSeeNavAccessTags,
  normalizeAccessTags,
} from '@/core/acl/nav-access'
import type { AccessViewer } from '@/core/acl/types'
import { sanitizeRichHtml } from '@/core/rich-editor/sanitize'

import { hashEventPassword } from './access-password'
import { sfEvents, sfVenues } from './schema'
import {
  isEventStatus,
  type EventRecord,
  type EventStatus,
  type VenueRecord,
} from './types'

function mapVenue(row: typeof sfVenues.$inferSelect): VenueRecord {
  const gallery = Array.isArray(row.galleryMediaIds)
    ? row.galleryMediaIds.filter(
        (id): id is string => typeof id === 'string' && Boolean(id.trim()),
      )
    : []
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled venue',
    address: row.address ?? '',
    description: row.description ?? '',
    latitude:
      typeof row.latitude === 'number' && Number.isFinite(row.latitude)
        ? row.latitude
        : null,
    longitude:
      typeof row.longitude === 'number' && Number.isFinite(row.longitude)
        ? row.longitude
        : null,
    coverMediaId: (row.coverMediaId || '').trim(),
    galleryMediaIds: gallery.map((id) => id.trim()).filter(Boolean),
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

function normalizeIdList(raw: unknown, max = 80): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const id = String(entry ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= max) break
  }
  return out
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
    registrationOpensAt: row.registrationOpensAt ?? null,
    registrationClosesAt: row.registrationClosesAt ?? null,
    managerUserIds: normalizeIdList(row.managerUserIds),
    helperUserIds: normalizeIdList(row.helperUserIds),
    managerGroupIds: normalizeIdList(row.managerGroupIds),
    helperGroupIds: normalizeIdList(row.helperGroupIds),
    organizerPartyIds: normalizeIdList(row.organizerPartyIds),
    speakerPartyIds: normalizeIdList(row.speakerPartyIds),
    sponsorPartyIds: normalizeIdList(row.sponsorPartyIds),
    relatedEventIds: normalizeIdList(row.relatedEventIds),
    signupNote: (row.signupNote || '').trim().slice(0, 4000),
    termsUrl: (row.termsUrl || '').trim().slice(0, 2000),
    listed: row.listed !== false,
    hasAccessPassword: Boolean((row.accessPasswordHash || '').trim()),
    accessTags: normalizeAccessTags({ accessTags: row.accessTags }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Server-only: raw password hash for unlock verify (never send to client). */
export async function getEventAccessPasswordHash(
  eventId: string,
): Promise<string | null> {
  const trimmed = eventId.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select({ accessPasswordHash: sfEvents.accessPasswordHash })
      .from(sfEvents)
      .where(eq(sfEvents.id, trimmed))
      .limit(1)
    const hash = (row?.accessPasswordHash || '').trim()
    return hash || null
  } catch {
    return null
  }
}

function parseListedFlag(raw: unknown, fallback = true): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw === 'boolean') return raw
  const s = String(raw).trim().toLowerCase()
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  return fallback
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
  description?: string
  latitude?: unknown
  longitude?: unknown
  coverMediaId?: string
  galleryMediaIds?: unknown
  accessTags?: unknown
}

export async function createVenue(
  input: UpsertVenueInput,
): Promise<{ venue: VenueRecord } | { error: string }> {
  const name = input.name.trim().slice(0, 200) || 'Untitled venue'
  const address = (input.address || '').trim().slice(0, 2000)
  const description = (input.description || '').trim()
  const latitude = parseOptionalCoord(input.latitude, -90, 90)
  const longitude = parseOptionalCoord(input.longitude, -180, 180)
  const coverMediaId = (input.coverMediaId || '').trim() || null
  const galleryMediaIds = normalizeGalleryIds(input.galleryMediaIds)
  const accessTags = normalizeAccessTagsForDb(input.accessTags)
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    await db.insert(sfVenues).values({
      id,
      name,
      address,
      description,
      latitude,
      longitude,
      coverMediaId,
      galleryMediaIds,
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
  const description =
    input.description !== undefined
      ? input.description.trim()
      : current.description
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
  const galleryMediaIds =
    input.galleryMediaIds !== undefined
      ? normalizeGalleryIds(input.galleryMediaIds)
      : current.galleryMediaIds
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
        description,
        latitude,
        longitude,
        coverMediaId,
        galleryMediaIds,
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
  registrationOpensAt?: unknown
  registrationClosesAt?: unknown
  managerUserIds?: unknown
  helperUserIds?: unknown
  managerGroupIds?: unknown
  helperGroupIds?: unknown
  organizerPartyIds?: unknown
  speakerPartyIds?: unknown
  sponsorPartyIds?: unknown
  relatedEventIds?: unknown
  signupNote?: unknown
  termsUrl?: unknown
  listed?: unknown
  /** Plaintext from admin form — hashed before persist; empty = leave unchanged on update. */
  accessPassword?: unknown
  clearAccessPassword?: unknown
  accessTags?: unknown
}

function parseOptionalIdList(raw: unknown): string[] {
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    try {
      return normalizeIdList(JSON.parse(s) as unknown)
    } catch {
      return normalizeIdList(s.split(/[,|\s]+/))
    }
  }
  return normalizeIdList(raw)
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
  const registrationOpensAt = parseOptionalDate(input.registrationOpensAt)
  const registrationClosesAt = parseOptionalDate(input.registrationClosesAt)
  const managerUserIds = parseOptionalIdList(input.managerUserIds)
  const helperUserIds = parseOptionalIdList(input.helperUserIds)
  const managerGroupIds = parseOptionalIdList(input.managerGroupIds)
  const helperGroupIds = parseOptionalIdList(input.helperGroupIds)
  const organizerPartyIds = parseOptionalIdList(input.organizerPartyIds)
  const speakerPartyIds = parseOptionalIdList(input.speakerPartyIds)
  const sponsorPartyIds = parseOptionalIdList(input.sponsorPartyIds)
  const relatedEventIds = parseOptionalIdList(input.relatedEventIds).filter(
    (rid) => rid !== ((input.id || '').trim() || ''),
  )
  const signupNote = String(input.signupNote ?? '').trim().slice(0, 4000)
  const termsUrl = String(input.termsUrl ?? '').trim().slice(0, 2000)
  const listed = parseListedFlag(input.listed, true)
  const plainPassword = String(input.accessPassword ?? '')
  const accessPasswordHash =
    plainPassword.trim().length > 0 ? hashEventPassword(plainPassword.trim()) : null
  const slug = normalizeSlug(input.slug)
  const accessTags = normalizeAccessTagsForDb(input.accessTags)
  const id = (input.id || '').trim() || crypto.randomUUID()

  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: 'End time must be on or after start time.' }
  }
  if (
    registrationOpensAt &&
    registrationClosesAt &&
    registrationClosesAt.getTime() < registrationOpensAt.getTime()
  ) {
    return { error: 'Registration close must be on or after open.' }
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
      registrationOpensAt,
      registrationClosesAt,
      managerUserIds,
      helperUserIds,
      managerGroupIds,
      helperGroupIds,
      organizerPartyIds,
      speakerPartyIds,
      sponsorPartyIds,
      relatedEventIds,
      signupNote,
      termsUrl,
      listed,
      accessPasswordHash,
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
  const registrationOpensAt =
    input.registrationOpensAt !== undefined
      ? parseOptionalDate(input.registrationOpensAt)
      : current.registrationOpensAt
  const registrationClosesAt =
    input.registrationClosesAt !== undefined
      ? parseOptionalDate(input.registrationClosesAt)
      : current.registrationClosesAt
  const managerUserIds =
    input.managerUserIds !== undefined
      ? parseOptionalIdList(input.managerUserIds)
      : current.managerUserIds
  const helperUserIds =
    input.helperUserIds !== undefined
      ? parseOptionalIdList(input.helperUserIds)
      : current.helperUserIds
  const managerGroupIds =
    input.managerGroupIds !== undefined
      ? parseOptionalIdList(input.managerGroupIds)
      : current.managerGroupIds
  const helperGroupIds =
    input.helperGroupIds !== undefined
      ? parseOptionalIdList(input.helperGroupIds)
      : current.helperGroupIds
  const organizerPartyIds =
    input.organizerPartyIds !== undefined
      ? parseOptionalIdList(input.organizerPartyIds)
      : current.organizerPartyIds
  const speakerPartyIds =
    input.speakerPartyIds !== undefined
      ? parseOptionalIdList(input.speakerPartyIds)
      : current.speakerPartyIds
  const sponsorPartyIds =
    input.sponsorPartyIds !== undefined
      ? parseOptionalIdList(input.sponsorPartyIds)
      : current.sponsorPartyIds
  const relatedEventIds = (
    input.relatedEventIds !== undefined
      ? parseOptionalIdList(input.relatedEventIds)
      : current.relatedEventIds
  ).filter((rid) => rid !== id)
  const signupNote =
    input.signupNote !== undefined
      ? String(input.signupNote ?? '').trim().slice(0, 4000)
      : current.signupNote
  const termsUrl =
    input.termsUrl !== undefined
      ? String(input.termsUrl ?? '').trim().slice(0, 2000)
      : current.termsUrl
  const listed =
    input.listed !== undefined ? parseListedFlag(input.listed, current.listed) : current.listed
  const clearPassword =
    input.clearAccessPassword === true ||
    input.clearAccessPassword === '1' ||
    input.clearAccessPassword === 'on' ||
    input.clearAccessPassword === 'true'
  const plainPassword = String(input.accessPassword ?? '').trim()
  let accessPasswordHash: string | null | undefined
  if (clearPassword) {
    accessPasswordHash = null
  } else if (plainPassword.length > 0) {
    accessPasswordHash = hashEventPassword(plainPassword)
  } else {
    accessPasswordHash = undefined
  }
  const slug =
    input.slug !== undefined ? normalizeSlug(input.slug) : current.slug || null
  const accessTags =
    input.accessTags !== undefined
      ? normalizeAccessTagsForDb(input.accessTags)
      : normalizeAccessTagsForDb(current.accessTags)

  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: 'End time must be on or after start time.' }
  }
  if (
    registrationOpensAt &&
    registrationClosesAt &&
    registrationClosesAt.getTime() < registrationOpensAt.getTime()
  ) {
    return { error: 'Registration close must be on or after open.' }
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
        registrationOpensAt,
        registrationClosesAt,
        managerUserIds,
        helperUserIds,
        managerGroupIds,
        helperGroupIds,
        organizerPartyIds,
        speakerPartyIds,
        sponsorPartyIds,
        relatedEventIds,
        signupNote,
        termsUrl,
        listed,
        ...(accessPasswordHash !== undefined ? { accessPasswordHash } : {}),
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

/** True when the viewer is listed as manager/helper (ignores app-admin bypass). */
export function viewerIsAssignedToEvent(
  event: Pick<
    EventRecord,
    | 'managerUserIds'
    | 'helperUserIds'
    | 'managerGroupIds'
    | 'helperGroupIds'
  >,
  viewer: AccessViewer,
): boolean {
  const uid = (viewer.userId || '').trim()
  if (uid) {
    if (event.managerUserIds.includes(uid) || event.helperUserIds.includes(uid)) {
      return true
    }
  }
  const groups = viewer.groupIds || []
  if (groups.length === 0) return false
  return (
    event.managerGroupIds.some((g) => groups.includes(g)) ||
    event.helperGroupIds.some((g) => groups.includes(g))
  )
}

/** True when the viewer may edit this event (app admin or assigned manager/helper). */
export function viewerCanManageEvent(
  event: Pick<
    EventRecord,
    | 'managerUserIds'
    | 'helperUserIds'
    | 'managerGroupIds'
    | 'helperGroupIds'
  >,
  viewer: AccessViewer,
): boolean {
  if (viewer.isAppAdmin) return true
  return viewerIsAssignedToEvent(event, viewer)
}

/** Duplicate an event as a new draft (optional tier copy). */
export async function duplicateEvent(
  sourceId: string,
  options?: { copyTiers?: boolean },
): Promise<{ event: EventRecord } | { error: string }> {
  const source = await findEventById(sourceId)
  if (!source) return { error: 'Event not found.' }

  const baseSlug = source.slug
    ? `${source.slug}-copy`.slice(0, 120)
    : normalizeSlug(`${source.title}-copy`)

  const created = await createEvent({
    title: `${source.title} (copy)`.slice(0, 200),
    slug: baseSlug || undefined,
    status: 'draft',
    startsAt: source.startsAt?.toISOString() ?? '',
    endsAt: source.endsAt?.toISOString() ?? '',
    timezone: source.timezone,
    venueId: source.venueId,
    description: source.description,
    coverMediaId: source.coverMediaId,
    galleryMediaIds: source.galleryMediaIds,
    capacity: source.capacity ?? '',
    registrationOpensAt: source.registrationOpensAt?.toISOString() ?? '',
    registrationClosesAt: source.registrationClosesAt?.toISOString() ?? '',
    managerUserIds: source.managerUserIds,
    helperUserIds: source.helperUserIds,
    managerGroupIds: source.managerGroupIds,
    helperGroupIds: source.helperGroupIds,
    organizerPartyIds: source.organizerPartyIds,
    speakerPartyIds: source.speakerPartyIds,
    sponsorPartyIds: source.sponsorPartyIds,
    relatedEventIds: source.relatedEventIds,
    signupNote: source.signupNote,
    termsUrl: source.termsUrl,
    listed: source.listed,
    accessTags: source.accessTags,
  })
  if ('error' in created) return created

  // Copy password gate without re-prompting (hash clone).
  if (source.hasAccessPassword) {
    const hash = await getEventAccessPasswordHash(source.id)
    if (hash) {
      try {
        await db
          .update(sfEvents)
          .set({ accessPasswordHash: hash })
          .where(eq(sfEvents.id, created.event.id))
      } catch {
        /* best-effort */
      }
    }
  }

  if (options?.copyTiers !== false) {
    try {
      const { listTicketTiersForEvent, createTicketTier } = await import('./tiers')
      const tiers = await listTicketTiersForEvent(source.id)
      for (const tier of tiers) {
        await createTicketTier({
          eventId: created.event.id,
          title: tier.title,
          description: tier.description,
          kind: tier.kind,
          capacity: tier.capacity ?? '',
          priceLabel: tier.priceLabel,
          sortOrder: tier.sortOrder,
        })
      }
    } catch {
      // Tier copy is best-effort.
    }
  }

  return created
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

/** Published events for public list / particles (ACL applied by caller). */
export async function listPublishedEvents(options?: {
  includePast?: boolean
  /** When true (default), omit unlisted events from discovery. */
  listedOnly?: boolean
  limit?: number
  now?: Date
}): Promise<EventRecord[]> {
  const now = options?.now ?? new Date()
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200)
  const listedOnly = options?.listedOnly !== false
  try {
    const published = eq(sfEvents.status, 'published')
    const upcoming = or(isNull(sfEvents.startsAt), gte(sfEvents.startsAt, now))
    const listed = eq(sfEvents.listed, true)
    const base = listedOnly ? and(published, listed) : published
    const rows = await db
      .select()
      .from(sfEvents)
      .where(options?.includePast ? base : and(base, upcoming))
      .orderBy(asc(sfEvents.startsAt), asc(sfEvents.title), asc(sfEvents.id))
      .limit(limit)
    return rows.map(mapEvent)
  } catch {
    return []
  }
}

/** Resolve a public event by slug or id (published only). */
export async function findPublishedEventByPublicKey(
  key: string,
): Promise<EventRecord | null> {
  const trimmed = key.trim()
  if (!trimmed) return null
  try {
    const [bySlug] = await db
      .select()
      .from(sfEvents)
      .where(and(eq(sfEvents.status, 'published'), eq(sfEvents.slug, trimmed)))
      .limit(1)
    if (bySlug) return mapEvent(bySlug)
    const [byId] = await db
      .select()
      .from(sfEvents)
      .where(and(eq(sfEvents.status, 'published'), eq(sfEvents.id, trimmed)))
      .limit(1)
    return byId ? mapEvent(byId) : null
  } catch {
    return null
  }
}

/** Drop events the viewer cannot see (multi-tag OR). */
export function filterEventsForViewer(
  events: EventRecord[],
  viewer: AccessViewer,
): EventRecord[] {
  return events.filter((event) => canSeeNavAccessTags(event.accessTags, viewer))
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
