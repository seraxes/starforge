/**
 * One-click event registration from ticket / faction area cards.
 * Uses account email + product:profiles contact; falls back to the form when blocked.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { db, sfUsers } from '@/core/db'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { formHasCaptchaField } from '@/modules/forms/api'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  fillMissingProfileContact,
  getOwnProfileContact,
} from '@/modules/profiles/api.server'
import { getLocale } from 'next-intl/server'

import { ensureEventsFormHooks } from './form-hooks'
import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from './public-access'
import { loadEventRegistrationFields } from './registration-form'
import {
  createEventRegistration,
  findActiveRegistrationForUserOnEvent,
  isEventRegistrationOpen,
} from './registrations'
import { findEventById } from './store'
import { findTicketTierById } from './tiers'
import { EVENTS_REGISTERED_TRIGGER } from './triggers'

export type QuickRegisterResult =
  | { ok: true; status: string; message: string; redirectUrl?: string }
  | { needsAuth: true }
  | { needsForm: true; reason: string }
  | { error: string }

async function loadAccountEmail(userId: string): Promise<string> {
  const [row] = await db
    .select({ email: sfUsers.email, name: sfUsers.name })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  return (row?.email || '').trim().toLowerCase()
}

async function loadAccountName(userId: string): Promise<string> {
  const [row] = await db
    .select({ name: sfUsers.name })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  return (row?.name || '').trim()
}

async function checkoutPathForOrder(orderId: string): Promise<string> {
  let locale: AppLocale = DEFAULT_LOCALE
  try {
    const requested = await getLocale()
    if (isAppLocale(requested)) locale = requested
  } catch {
    /* default */
  }
  return withLocalePrefix(`/checkout/${orderId}`, locale)
}

/**
 * Attempt one-click registration for a ticket tier.
 * Returns needsForm when terms/captcha/required contact gaps block silent signup.
 */
export async function quickRegisterForTier(
  eventIdRaw: string,
  tierIdRaw: string,
): Promise<QuickRegisterResult> {
  const eventId = eventIdRaw.trim()
  const tierId = tierIdRaw.trim()
  if (!eventId || !tierId) return { error: 'Missing event or ticket type.' }

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return { error: 'Events is not enabled.' }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return { needsForm: true, reason: 'Registration form is required.' }
  }

  const session = await getAppSession()
  const userId = session?.user?.id?.trim() || ''
  if (!userId) return { needsAuth: true }

  const event = await findEventById(eventId)
  if (!event || event.status !== 'published') {
    return { error: 'Event not found.' }
  }

  const window = isEventRegistrationOpen(event)
  if (!window.open) {
    return { error: window.reason || 'Registration is closed.' }
  }

  const viewer = await getAccessViewer()
  if (!viewerPassesEventAcl(event, viewer)) {
    return { error: 'You cannot register for this event.' }
  }
  if (!(await viewerPassesEventPassword(event, viewer))) {
    return { error: 'Unlock this event with the access password first.' }
  }

  const tier = await findTicketTierById(tierId)
  if (!tier || tier.eventId !== eventId) {
    return { error: 'Ticket type was not found for this event.' }
  }
  if (typeof tier.capacity === 'number') {
    const { countRegisteredGuestsForTier } = await import('./tiers')
    const occupied = await countRegisteredGuestsForTier(eventId, tierId)
    if (occupied >= tier.capacity && !event.waitlistEnabled) {
      return { error: 'This ticket type is sold out.' }
    }
  }

  const existing = await findActiveRegistrationForUserOnEvent(userId, eventId)
  if (existing) {
    if (existing.status === 'pending_payment' && existing.paymentOrderId) {
      return {
        ok: true,
        status: 'pending_payment',
        message: 'Complete payment to finish your registration.',
        redirectUrl: await checkoutPathForOrder(existing.paymentOrderId),
      }
    }
    return {
      error:
        existing.status === 'waitlisted'
          ? 'You are already on the waitlist for this event.'
          : existing.status === 'pending_payment'
            ? 'You already have a pending payment for this event.'
            : 'You are already registered for this event.',
    }
  }

  const { document } = await loadEventRegistrationFields(eventId, {
    termsUrl: event.termsUrl,
  })
  if (formHasCaptchaField(document.fields)) {
    return { needsForm: true, reason: 'Captcha is required.' }
  }
  if (document.fields.some((f) => f.name === 'accept_terms' && f.required)) {
    return { needsForm: true, reason: 'Terms acceptance is required.' }
  }

  const contact = await getOwnProfileContact(userId)
  const email = await loadAccountEmail(userId)
  const accountName = await loadAccountName(userId)
  const sessionName = (session?.user?.name || '').trim()
  const name =
    (contact?.displayName || '').trim() || accountName || sessionName
  const phone = (contact?.phone || '').trim()

  for (const field of document.fields) {
    if (!field.required) continue
    if (field.type === 'hidden' || field.type === 'captcha') continue
    const key = field.name
    if (key === 'ticket_tier_id' || key === 'event_id') continue
    if (key === 'guests' || key === 'attendance') continue
    if (key === 'name' && !name) {
      return { needsForm: true, reason: 'Name is missing from your profile.' }
    }
    if (key === 'email' && (!email || !email.includes('@'))) {
      return { needsForm: true, reason: 'A valid account email is required.' }
    }
    if (key === 'phone' && !phone) {
      return { needsForm: true, reason: 'Phone is missing from your profile.' }
    }
    if (
      key !== 'name' &&
      key !== 'email' &&
      key !== 'phone' &&
      key !== 'notes'
    ) {
      // Unknown required field without a one-click default → form.
      const def = (field.defaultValue || '').trim()
      if (!def) {
        return { needsForm: true, reason: `Please complete “${field.label || key}”.` }
      }
    }
  }

  if (!name || !email) {
    return { needsForm: true, reason: 'Profile contact details are incomplete.' }
  }

  ensureEventsFormHooks()

  const result = await createEventRegistration({
    eventId,
    ticketTierId: tierId,
    userId,
    name,
    email,
    guests: 1,
    attendance: 'in_person',
    notes: '',
  })
  if ('error' in result) return { error: result.error }

  await fillMissingProfileContact(userId, { phone, displayName: name })

  const {
    ensureEventsPaymentHook,
    isPaymentsModuleOn,
    tierRequiresPayment,
    beginPaidTicketCheckout,
  } = await import('./payment-bridge')
  ensureEventsPaymentHook()

  if (
    result.registration.status === 'registered' &&
    (await isPaymentsModuleOn())
  ) {
    const priced = await tierRequiresPayment(tierId)
    if (priced.requires) {
      const checkout = await beginPaidTicketCheckout({
        registrationId: result.registration.id,
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          merchantUserId: event.merchantUserId || null,
        },
        ticketTierId: tierId,
        buyerEmail: email,
        buyerName: name,
        userId,
        guests: 1,
      })
      if (!checkout.ok) {
        return { error: checkout.error || 'Could not start checkout.' }
      }
      return {
        ok: true,
        status: 'pending_payment',
        message: 'Continue to payment to finish your registration.',
        redirectUrl: checkout.checkoutPath,
      }
    }
  }

  const status = result.registration.status
  if (status === 'registered' || status === 'waitlisted') {
    try {
      const { emitEmailTrigger, isEmailManagerEnabled } = await import(
        '@/modules/email-manager/api.server'
      )
      if (await isEmailManagerEnabled()) {
        await emitEmailTrigger({
          triggerKey: EVENTS_REGISTERED_TRIGGER,
          payload: {
            eventId: event.id,
            eventTitle: event.title,
            eventSlug: event.slug,
            registrationId: result.registration.id,
            registrationStatus: status,
            ticketTierId: result.registration.ticketTierId,
            ticketTierTitle: tier.title,
            name: result.registration.name,
            email: result.registration.email,
            guests: result.registration.guests,
            attendance: result.registration.attendance,
            respondentEmail: result.registration.email,
          },
        })
      }
    } catch {
      /* email optional */
    }
  }

  return {
    ok: true,
    status,
    message:
      status === 'waitlisted'
        ? `You are waitlisted for ${tier.title}.`
        : `Registered for ${tier.title}.`,
  }
}
