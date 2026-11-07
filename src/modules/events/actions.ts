'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { saveEventsModuleSettings } from './settings'
import {
  createEvent,
  createVenue,
  deleteEvent,
  deleteVenue,
  duplicateEvent,
  updateEvent,
  updateVenue,
} from './store'
import type { EventsAdminActionState } from './types'

export type { EventsAdminActionState }

async function requireEventsModuleOn(): Promise<EventsAdminActionState | null> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return {
      error: 'Events is disabled. Enable it under Settings → Modules.',
    }
  }
  return null
}

/**
 * Events writes — app admin or Users → ACL `admin.events` grant.
 * Manager/helper assignments drive “Managed by me” filtering; ACL opens /admin.
 */
async function requireEventsAdmin(): Promise<EventsAdminActionState | null> {
  const session = await requireAdminArea('admin.events')
  if (!session) {
    return {
      error:
        'Sign in with Events admin access (app admin or ACL → Events) to manage Events.',
    }
  }
  return requireEventsModuleOn()
}

async function requireEventEditor(
  eventId: string,
): Promise<EventsAdminActionState | null> {
  if (!eventId.trim()) return { error: 'Missing event id.' }
  return requireEventsAdmin()
}

function revalidateEventsAdmin(eventId?: string) {
  revalidatePath('/admin/events')
  revalidatePath('/admin/events/venues')
  revalidatePath('/admin/events/settings')
  revalidatePath('/admin/events/tiers')
  revalidatePath('/admin/events/registrants')
  revalidatePath('/admin/events/parties')
  revalidatePath('/admin')
  revalidatePath('/events')
  if (eventId) {
    revalidatePath(`/admin/events/${eventId}`)
  }
}

function parseIdListJson(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '[]')
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
    managerUserIds: parseIdListJson(formData, 'managerUserIdsJson'),
    helperUserIds: parseIdListJson(formData, 'helperUserIdsJson'),
    managerGroupIds: parseIdListJson(formData, 'managerGroupIdsJson'),
    helperGroupIds: parseIdListJson(formData, 'helperGroupIdsJson'),
    organizerPartyIds: parseIdListJson(formData, 'organizerPartyIdsJson'),
    speakerPartyIds: parseIdListJson(formData, 'speakerPartyIdsJson'),
    sponsorPartyIds: parseIdListJson(formData, 'sponsorPartyIdsJson'),
    relatedEventIds: parseIdListJson(formData, 'relatedEventIdsJson'),
    signupNote: String(formData.get('signupNote') ?? ''),
    termsUrl: String(formData.get('termsUrl') ?? ''),
    listed: formData.get('listed') === '0' ? '0' : '1',
    accessPassword: String(formData.get('accessPassword') ?? ''),
    clearAccessPassword: formData.get('clearAccessPassword') === '1' ? '1' : '',
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
  const id = String(formData.get('id') ?? '').trim()
  const denied = await requireEventEditor(id)
  if (denied) return denied

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

export async function duplicateEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const id = String(formData.get('id') ?? '').trim()
  const denied = await requireEventEditor(id)
  if (denied) return denied
  const copyTiers = formData.get('copyTiers') !== '0'
  const result = await duplicateEvent(id, { copyTiers })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.event.id)
  return {
    ok: true,
    message: `Duplicated as “${result.event.title}”.`,
    id: result.event.id,
  }
}

export type EventUnlockActionState = {
  error?: string
  ok?: boolean
}

/**
 * Public: unlock a password-gated published event (sets httpOnly cookie).
 */
export async function unlockEventPasswordAction(
  _prev: EventUnlockActionState,
  formData: FormData,
): Promise<EventUnlockActionState> {
  const moduleOff = await requireEventsModuleOn()
  if (moduleOff) return { error: moduleOff.error }

  const eventId = String(formData.get('eventId') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!eventId) return { error: 'Missing event.' }
  if (!password.trim()) return { error: 'Enter the event password.' }

  const { findEventById, getEventAccessPasswordHash } = await import('./store')
  const { verifyEventPassword, setEventPasswordUnlockCookie } = await import(
    './access-password'
  )

  const event = await findEventById(eventId)
  if (!event || event.status !== 'published') {
    return { error: 'Event not found.' }
  }
  const hash = await getEventAccessPasswordHash(eventId)
  if (!hash) {
    return { error: 'This event is not password protected.' }
  }
  if (!verifyEventPassword(password, hash)) {
    return { error: 'Incorrect password.' }
  }

  const set = await setEventPasswordUnlockCookie(eventId)
  if (!set.ok) return { error: set.error }

  const pathKey = event.slug || event.id
  revalidatePath('/events')
  revalidatePath(`/events/${encodeURIComponent(pathKey)}`)
  return { ok: true }
}

/* ─── Parties ────────────────────────────────────────────────────────────── */

export async function createEventPartyAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { createEventParty } = await import('./parties')
  const result = await createEventParty({
    name: String(formData.get('name') ?? ''),
    kind: String(formData.get('kind') ?? 'organizer'),
    url: String(formData.get('url') ?? ''),
    blurb: String(formData.get('blurb') ?? ''),
    avatarMediaId: String(formData.get('coverMediaId') ?? formData.get('avatarMediaId') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Party “${result.party.name}” created.`,
    id: result.party.id,
  }
}

export async function updateEventPartyAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { updateEventParty } = await import('./parties')
  const id = String(formData.get('id') ?? '').trim()
  const result = await updateEventParty({
    id,
    name: String(formData.get('name') ?? ''),
    kind: String(formData.get('kind') ?? 'organizer'),
    url: String(formData.get('url') ?? ''),
    blurb: String(formData.get('blurb') ?? ''),
    avatarMediaId: String(formData.get('coverMediaId') ?? formData.get('avatarMediaId') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return {
    ok: true,
    message: `Party “${result.party.name}” saved.`,
    id: result.party.id,
  }
}

export async function deleteEventPartyAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { deleteEventParty } = await import('./parties')
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteEventParty(id)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return { ok: true, message: 'Party deleted.', id }
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
