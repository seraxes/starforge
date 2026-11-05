'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { saveEventsModuleSettings } from './settings'
import {
  createEvent,
  createVenue,
  deleteEvent,
  deleteVenue,
  updateEvent,
  updateVenue,
} from './store'
import type { EventsAdminActionState } from './types'

export type { EventsAdminActionState }

async function requireEventsAdmin(): Promise<EventsAdminActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage Events.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return {
      error: 'Events is disabled. Enable it under Settings → Modules.',
    }
  }
  return null
}

function revalidateEventsAdmin() {
  revalidatePath('/admin/events')
  revalidatePath('/admin/events/venues')
  revalidatePath('/admin/events/settings')
  revalidatePath('/admin')
}

function parseAccessTagsFromForm(formData: FormData): unknown {
  const raw = String(formData.get('accessTagsJson') ?? '').trim()
  if (!raw) return ['public']
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
  }
}

function datetimeLocalToIso(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  // `<input type="datetime-local">` → treat as local wall time → ISO
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/* ─── Venues ─────────────────────────────────────────────────────────────── */

export async function createVenueAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const result = await createVenue({
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    accessTags: parseAccessTagsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Venue “${result.venue.name}” created.`,
    id: result.venue.id,
  }
}

export async function updateVenueAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const result = await updateVenue({
    id,
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    accessTags: parseAccessTagsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Venue “${result.venue.name}” saved.`,
    id: result.venue.id,
  }
}

export async function deleteVenueAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteVenue(id)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return { ok: true, message: 'Venue deleted.', id }
}

/* ─── Events ─────────────────────────────────────────────────────────────── */

export async function createEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const result = await createEvent({
    title: String(formData.get('title') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    status: String(formData.get('status') ?? 'draft'),
    startsAt: datetimeLocalToIso(String(formData.get('startsAt') ?? '')),
    endsAt: datetimeLocalToIso(String(formData.get('endsAt') ?? '')),
    timezone: String(formData.get('timezone') ?? 'UTC'),
    venueId: String(formData.get('venueId') ?? ''),
    description: String(formData.get('description') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    galleryMediaIds: String(formData.get('galleryMediaIdsJson') ?? '[]'),
    capacity: String(formData.get('capacity') ?? ''),
    accessTags: parseAccessTagsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Event “${result.event.title}” created.`,
    id: result.event.id,
  }
}

export async function updateEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const result = await updateEvent({
    id,
    title: String(formData.get('title') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    status: String(formData.get('status') ?? 'draft'),
    startsAt: datetimeLocalToIso(String(formData.get('startsAt') ?? '')),
    endsAt: datetimeLocalToIso(String(formData.get('endsAt') ?? '')),
    timezone: String(formData.get('timezone') ?? 'UTC'),
    venueId: String(formData.get('venueId') ?? ''),
    description: String(formData.get('description') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    galleryMediaIds: String(formData.get('galleryMediaIdsJson') ?? '[]'),
    capacity: String(formData.get('capacity') ?? ''),
    accessTags: parseAccessTagsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Event “${result.event.title}” saved.`,
    id: result.event.id,
  }
}

export async function deleteEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteEvent(id)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return { ok: true, message: 'Event deleted.', id }
}

/* ─── Settings ───────────────────────────────────────────────────────────── */

export async function saveEventsSettingsAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  try {
    const settings = await saveEventsModuleSettings({
      defaultTimezone: String(formData.get('defaultTimezone') ?? 'UTC'),
    })
    revalidateEventsAdmin()
    return {
      ok: true,
      message: `Events settings saved (default timezone ${settings.defaultTimezone}).`,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save Events settings.',
    }
  }
}
