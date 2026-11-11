'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { priceRulesFromForm } from './price-rules'
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
    currency: String(formData.get('currency') ?? ''),
    price: String(formData.get('price') ?? ''),
    priceRules: priceRulesFromForm(formData),
    venueId: String(formData.get('venueId') ?? ''),
    description: String(formData.get('description') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    galleryMediaIds: String(formData.get('galleryMediaIdsJson') ?? '[]'),
    capacity: String(formData.get('capacity') ?? ''),
    waitlistEnabled: formData.get('waitlistEnabled') === '1' ? '1' : '0',
    registrationOpensAt: datetimeLocalToIso(
      String(formData.get('registrationOpensAt') ?? ''),
    ),
    registrationClosesAt: datetimeLocalToIso(
      String(formData.get('registrationClosesAt') ?? ''),
    ),
    merchantUserId: String(formData.get('merchantUserId') ?? '').trim(),
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
    featured: formData.get('featured') === '1' ? '1' : '0',
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
    description: String(formData.get('description') ?? ''),
    latitude: String(formData.get('latitude') ?? ''),
    longitude: String(formData.get('longitude') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    galleryMediaIds: String(formData.get('galleryMediaIdsJson') ?? '[]'),
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
    description: String(formData.get('description') ?? ''),
    latitude: String(formData.get('latitude') ?? ''),
    longitude: String(formData.get('longitude') ?? ''),
    coverMediaId: String(formData.get('coverMediaId') ?? ''),
    galleryMediaIds: String(formData.get('galleryMediaIdsJson') ?? '[]'),
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
      description: venue.description,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      coverMediaId: venue.coverMediaId,
      galleryMediaIds: venue.galleryMediaIds,
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

function parseAfterIntent(formData: FormData): 'apply' | 'save' {
  const raw = String(formData.get('after') ?? 'save').trim().toLowerCase()
  return raw === 'apply' ? 'apply' : 'save'
}

export async function createEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const after = parseAfterIntent(formData)
  const result = await createEvent(eventFieldsFromForm(formData))
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.event.id)
  return {
    ok: true,
    message: `Event “${result.event.title}” created.`,
    id: result.event.id,
    after,
  }
}

export async function updateEventAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const id = String(formData.get('id') ?? '').trim()
  const denied = await requireEventEditor(id)
  if (denied) return denied

  const after = parseAfterIntent(formData)
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
    after,
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
      tierCapacityDisplay: String(
        formData.get('tierCapacityDisplay') ?? 'both',
      ) as import('./types').TierCapacityDisplayMode,
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
 * Seed Email Manager templates + rules for Events triggers (idempotent fixed ids).
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
    const { EVENTS_REGISTERED_TRIGGER, EVENTS_WAITLIST_PROMOTED_TRIGGER } = await import(
      './triggers'
    )

    async function upsertStarter(input: {
      tplId: string
      ruleId: string
      tplLabel: string
      ruleLabel: string
      triggerKey: string
      subject: string
      bodyText: string
    }) {
      const createdTpl = await createEmailTemplate({
        id: input.tplId,
        label: input.tplLabel,
        moduleCategory: 'events',
        subject: input.subject,
        bodyText: input.bodyText,
      })
      if ('error' in createdTpl) {
        await updateEmailTemplate({
          id: input.tplId,
          label: input.tplLabel,
          moduleCategory: 'events',
          subject: input.subject,
          bodyText: input.bodyText,
        })
      }

      const createdRule = await createEmailRule({
        id: input.ruleId,
        label: input.ruleLabel,
        moduleCategory: 'events',
        enabled: true,
        triggerKey: input.triggerKey,
        mode: 'automatic',
        conditions: { all: [] },
        audience: { toFromPayload: ['respondentEmail'] },
        templateId: input.tplId,
      })
      if ('error' in createdRule) {
        await updateEmailRule({
          id: input.ruleId,
          label: input.ruleLabel,
          moduleCategory: 'events',
          enabled: true,
          triggerKey: input.triggerKey,
          mode: 'automatic',
          conditions: { all: [] },
          audience: { toFromPayload: ['respondentEmail'] },
          templateId: input.tplId,
        })
      }
    }

    await upsertStarter({
      tplId: 'tpl-events-registered-default',
      ruleId: 'rule-events-registered-default',
      tplLabel: 'Events — registration confirm',
      ruleLabel: 'Events — confirm registrant',
      triggerKey: EVENTS_REGISTERED_TRIGGER,
      subject: 'Registration: {{eventTitle}}',
      bodyText:
        'Hi {{name}},\n\nYour registration for {{eventTitle}} is {{registrationStatus}}.\nTicket: {{ticketTierTitle}}\nGuests: {{guests}}\n\n— Starforge Events',
    })

    await upsertStarter({
      tplId: 'tpl-events-waitlist-promoted-default',
      ruleId: 'rule-events-waitlist-promoted-default',
      tplLabel: 'Events — waitlist promoted',
      ruleLabel: 'Events — waitlist promoted',
      triggerKey: EVENTS_WAITLIST_PROMOTED_TRIGGER,
      subject: 'A seat opened: {{eventTitle}}',
      bodyText:
        'Hi {{name}},\n\nA seat opened for {{eventTitle}} and you are now registered.\nTicket: {{ticketTierTitle}}\nGuests: {{guests}}\n\n— Starforge Events',
    })

    const { ensureEventRegistrationFormSeeded } = await import('./registration-form')
    await ensureEventRegistrationFormSeeded()

    revalidateEventsAdmin()
    revalidatePath('/admin/email')
    return {
      ok: true,
      message:
        'Seeded Events registration + waitlist-promoted emails (templates + rules) and ensured the event-registration Form definition.',
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
    shortDescription: String(formData.get('shortDescription') ?? ''),
    description: String(formData.get('description') ?? ''),
    kind: String(formData.get('kind') ?? 'general'),
    capacity: String(formData.get('capacity') ?? ''),
    maxPerBooking: String(formData.get('maxPerBooking') ?? ''),
    price: String(formData.get('price') ?? ''),
    priceModifier: String(formData.get('priceModifier') ?? ''),
    priceLabel: String(formData.get('priceLabel') ?? ''),
    titleColor: String(formData.get('titleColor') ?? ''),
    borderColor: String(formData.get('borderColor') ?? ''),
    backgroundColor: String(formData.get('backgroundColor') ?? ''),
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
    shortDescription: String(formData.get('shortDescription') ?? ''),
    description: String(formData.get('description') ?? ''),
    kind: String(formData.get('kind') ?? 'general'),
    capacity: String(formData.get('capacity') ?? ''),
    maxPerBooking: String(formData.get('maxPerBooking') ?? ''),
    price: String(formData.get('price') ?? ''),
    priceModifier: String(formData.get('priceModifier') ?? ''),
    priceLabel: String(formData.get('priceLabel') ?? ''),
    titleColor: String(formData.get('titleColor') ?? ''),
    borderColor: String(formData.get('borderColor') ?? ''),
    backgroundColor: String(formData.get('backgroundColor') ?? ''),
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

export async function reorderTicketTiersAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const eventId = String(formData.get('eventId') ?? '').trim()
  const orderedIds = String(formData.get('orderedIds') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  const { reorderTicketTiers } = await import('./tiers')
  const result = await reorderTicketTiers(eventId, orderedIds)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  revalidatePath('/events')
  return { ok: true, message: 'Ticket type order saved.' }
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

export async function createRegistrationAdminAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { createEventRegistration } = await import('./registrations')
  const statusRaw = String(formData.get('status') ?? 'registered').trim()
  const status =
    statusRaw === 'waitlisted' || statusRaw === 'cancelled' || statusRaw === 'registered'
      ? statusRaw
      : 'registered'
  const guests = Number(String(formData.get('guests') ?? '1'))
  const result = await createEventRegistration({
    eventId: String(formData.get('eventId') ?? ''),
    ticketTierId: String(formData.get('ticketTierId') ?? ''),
    userId: String(formData.get('userId') ?? ''),
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    guests: Number.isFinite(guests) ? guests : 1,
    attendance: String(formData.get('attendance') ?? 'in_person'),
    notes: String(formData.get('notes') ?? ''),
    admin: true,
    status,
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.registration.eventId)
  return {
    ok: true,
    message: `Registrant “${result.registration.name}” added.`,
    id: result.registration.id,
  }
}

export async function updateRegistrationAdminAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { updateEventRegistration } = await import('./registrations')
  const statusRaw = String(formData.get('status') ?? 'registered').trim()
  const status =
    statusRaw === 'waitlisted' || statusRaw === 'cancelled' || statusRaw === 'registered'
      ? statusRaw
      : 'registered'
  const guests = Number(String(formData.get('guests') ?? '1'))
  const result = await updateEventRegistration({
    id: String(formData.get('id') ?? ''),
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    guests: Number.isFinite(guests) ? guests : 1,
    attendance: String(formData.get('attendance') ?? 'in_person'),
    notes: String(formData.get('notes') ?? ''),
    ticketTierId: String(formData.get('ticketTierId') ?? ''),
    userId: String(formData.get('userId') ?? ''),
    status,
  })
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin(result.registration.eventId)
  return {
    ok: true,
    message: `Registrant “${result.registration.name}” saved.`,
    id: result.registration.id,
  }
}

export async function deleteRegistrationAdminAction(
  _prev: EventsAdminActionState,
  formData: FormData,
): Promise<EventsAdminActionState> {
  const denied = await requireEventsAdmin()
  if (denied) return denied

  const { deleteEventRegistration } = await import('./registrations')
  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteEventRegistration(id)
  if ('error' in result) return { error: result.error }
  revalidateEventsAdmin()
  return { ok: true, message: 'Registrant deleted.', id }
}

/* ─── Public one-click register (area cards) ─────────────────────────────── */

export type QuickRegisterActionResult = {
  ok?: boolean
  needsAuth?: boolean
  needsForm?: boolean
  reason?: string
  message?: string
  error?: string
  status?: string
  /** Same-origin checkout path when a paid tier needs payment. */
  redirectUrl?: string
}

export async function quickRegisterAction(
  eventId: string,
  tierId: string,
): Promise<QuickRegisterActionResult> {
  const { quickRegisterForTier } = await import('./quick-register')
  const result = await quickRegisterForTier(eventId, tierId)
  if ('needsAuth' in result) return { needsAuth: true }
  if ('needsForm' in result) return { needsForm: true, reason: result.reason }
  if ('error' in result) return { error: result.error }
  revalidatePath('/events')
  revalidatePath(`/events`)
  if (result.ok) {
    revalidateEventsAdmin(eventId)
  }
  return {
    ok: true,
    status: result.status,
    message: result.message,
    ...(result.redirectUrl ? { redirectUrl: result.redirectUrl } : {}),
  }
}
