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

function revalidateEventsAdmin(eventId?: string) {
  revalidatePath('/admin/events')
  revalidatePath('/admin/events/venues')
  revalidatePath('/admin/events/settings')
  revalidatePath('/admin/events/tiers')
  revalidatePath('/admin/events/registrants')
  revalidatePath('/admin')
  revalidatePath('/events')
  if (eventId) {
    revalidatePath(`/admin/events/${eventId}`)
  }
}

function eventFieldsFromForm(formData: FormData) {
  return {
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
    registrationOpensAt: datetimeLocalToIso(
      String(formData.get('registrationOpensAt') ?? ''),
    ),
    registrationClosesAt: datetimeLocalToIso(
      String(formData.get('registrationClosesAt') ?? ''),
    ),
    accessTags: parseAccessTagsFromForm(formData),
  }
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
    latitude: String(formData.get('latitude') ?? ''),
    longitude: String(formData.get('longitude') ?? ''),
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
    latitude: String(formData.get('latitude') ?? ''),
    longitude: String(formData.get('longitude') ?? ''),
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

/** Geocode venue address via MapProvider (Nominatim for leaflet-osm). */
export async function geocodeVenueAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing venue id.' }

  const { findVenueById } = await import('./store')
  const venue = await findVenueById(id)
  if (!venue) return { error: 'Venue not found.' }

  const query = (venue.address || venue.name || '').trim()
  if (!query) return { error: 'Add an address (or name) before geocoding.' }

  try {
    const { getMapProvider } = await import('@/core/maps')
    const provider = await getMapProvider()
    if (!provider.geocode) {
      return { error: 'Active map provider does not support geocoding.' }
    }
    const point = await provider.geocode(query)
    if (!point) return { error: 'No geocode result for that address.' }

    const updated = await updateVenue({
      id,
      name: venue.name,
      address: venue.address,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      coverMediaId: venue.coverMediaId,
      accessTags: venue.accessTags,
    })
    if ('error' in updated) return { error: updated.error }
    revalidateEventsAdmin()
    return {
      ok: true,
      message: `Geocoded “${venue.name}” → ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}.`,
      id,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Geocode failed.',
    }
  }
}

/* ─── Events ─────────────────────────────────────────────────────────────── */

export async function createEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const result = await createEvent(eventFieldsFromForm(formData))
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.event.id)
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
    ...eventFieldsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.event.id)
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
      preventDuplicate: formData.get('preventDuplicate') === '1',
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

/**
 * Seed Email Manager template + rule for product:events/registered (idempotent fixed ids).
 */
export async function seedEventsEmailStartersAction(
  _prev: EventsAdminActionState,
  _formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  try {
    const { createEmailTemplate, updateEmailTemplate, createEmailRule, updateEmailRule } =
      await import('@/modules/email-manager/store')
    const { EVENTS_REGISTERED_TRIGGER } = await import('./form-hooks')

    const tplId = 'tpl-events-registered-default'
    const ruleId = 'rule-events-registered-default'
    const subject = 'Registration: {{eventTitle}}'
    const bodyText =
      'Hi {{name}},\n\nYour registration for {{eventTitle}} is {{registrationStatus}}.\nTicket: {{ticketTierTitle}}\nGuests: {{guests}}\n\n— Starforge Events'

    const createdTpl = await createEmailTemplate({
      id: tplId,
      label: 'Events — registration confirm',
      moduleCategory: 'events',
      subject,
      bodyText,
    })
    if ('error' in createdTpl) {
      await updateEmailTemplate({
        id: tplId,
        label: 'Events — registration confirm',
        moduleCategory: 'events',
        subject,
        bodyText,
      })
    }

    const createdRule = await createEmailRule({
      id: ruleId,
      label: 'Events — confirm registrant',
      moduleCategory: 'events',
      enabled: true,
      triggerKey: EVENTS_REGISTERED_TRIGGER,
      mode: 'automatic',
      conditions: { all: [] },
      audience: { toFromPayload: ['respondentEmail'] },
      templateId: tplId,
    })
    if ('error' in createdRule) {
      await updateEmailRule({
        id: ruleId,
        label: 'Events — confirm registrant',
        moduleCategory: 'events',
        enabled: true,
        triggerKey: EVENTS_REGISTERED_TRIGGER,
        mode: 'automatic',
        conditions: { all: [] },
        audience: { toFromPayload: ['respondentEmail'] },
        templateId: tplId,
      })
    }

    const { ensureEventRegistrationFormSeeded } = await import('./registration-form')
    await ensureEventRegistrationFormSeeded()

    revalidateEventsAdmin()
    revalidatePath('/admin/email')
    return {
      ok: true,
      message:
        'Seeded Events registration email (template + rule) and ensured the event-registration Form definition.',
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not seed Events email starters.',
    }
  }
}

/* ─── Ticket tiers ───────────────────────────────────────────────────────── */

export async function createTicketTierAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { createTicketTier } = await import('./tiers')
  const result = await createTicketTier({
    eventId: String(formData.get('eventId') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    kind: String(formData.get('kind') ?? 'general'),
    capacity: String(formData.get('capacity') ?? ''),
    priceLabel: String(formData.get('priceLabel') ?? ''),
    sortOrder: String(formData.get('sortOrder') ?? '0'),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  revalidatePath('/events')
  return {
    ok: true,
    message: `Tier “${result.tier.title}” created.`,
    id: result.tier.id,
  }
}

export async function updateTicketTierAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { updateTicketTier } = await import('./tiers')
  const id = String(formData.get('id') ?? '').trim()
  const result = await updateTicketTier({
    id,
    eventId: String(formData.get('eventId') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    kind: String(formData.get('kind') ?? 'general'),
    capacity: String(formData.get('capacity') ?? ''),
    priceLabel: String(formData.get('priceLabel') ?? ''),
    sortOrder: String(formData.get('sortOrder') ?? '0'),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  revalidatePath('/events')
  return {
    ok: true,
    message: `Tier “${result.tier.title}” saved.`,
    id: result.tier.id,
  }
}

export async function deleteTicketTierAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { deleteTicketTier } = await import('./tiers')
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteTicketTier(id)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return { ok: true, message: 'Tier deleted.', id }
}

/* ─── Registrants ────────────────────────────────────────────────────────── */

export async function updateRegistrationStatusAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { updateRegistrationStatus } = await import('./registrations')
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (
    status !== 'registered' &&
    status !== 'waitlisted' &&
    status !== 'cancelled'
  ) {
    return { error: 'Invalid status.' }
  }
  const result = await updateRegistrationStatus(id, status)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Registration for ${result.registration.email} → ${result.registration.status}.`,
    id: result.registration.id,
  }
}
