/**
 * Events → Forms preset bridge (product:events PR3).
 * Registers `event-registration` onSubmitted: capacity row + Email Manager emit.
 */

import 'server-only'

import { registerFormPreset } from '@/modules/forms/api'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getAccessViewer } from '@/core/acl/access'

import {
  viewerPassesEventVisibility,
  viewerPassesEventPassword,
} from './public-access'
import { createEventRegistration } from './registrations'
import { publicSignupAck } from './registration-status'
import { findEventById } from './store'
import { EVENTS_REGISTERED_TRIGGER } from './triggers'

export { EVENTS_REGISTERED_TRIGGER }

let registered = false

function payloadString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key]
  if (v == null) return ''
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v).trim()
}

function payloadGuests(payload: Record<string, unknown>): number {
  const raw = payloadString(payload, 'guests')
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), 20)
}

/**
 * Idempotent — safe to call from instrumentation / public pages / submit path.
 */
export function ensureEventsFormHooks(): void {
  if (registered) return
  registered = true

  void import('./registration-form')
    .then(({ ensureEventRegistrationFormSeeded }) => ensureEventRegistrationFormSeeded())
    .catch(() => {
      /* forms pack may be off */
    })

  void import('./email-emit')
    .then(({ ensureEventsReminderJob }) => ensureEventsReminderJob())
    .catch(() => {
      /* optional */
    })

  registerFormPreset({
    id: 'event-registration',
    label: 'Event registration',
    description: 'Event attendee registration (product:events capacity + confirm email).',
    onSubmitted: async (ctx) => {
      try {
        const settings = await getSiteSettings()
        if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) return

        const eventId = payloadString(ctx.payload, 'event_id')
        if (!eventId) return

        const event = await findEventById(eventId)
        if (!event || event.status !== 'published') return

        const viewer = await getAccessViewer()
        if (!(await viewerPassesEventVisibility(event, viewer))) return
        if (!(await viewerPassesEventPassword(event, viewer))) return

        const ticketTierId =
          payloadString(ctx.payload, 'ticket_tier_id') ||
          payloadString(ctx.payload, 'ticketTierId')

        const name = payloadString(ctx.payload, 'name')
        const email = payloadString(ctx.payload, 'email')
        const phone = payloadString(ctx.payload, 'phone')
        const guests = payloadGuests(ctx.payload)

        const {
          ensureEventsPaymentHook,
          isPaymentsModuleOn,
          tierRequiresPayment,
          beginPaidTicketCheckout,
        } = await import('./payment-bridge')
        ensureEventsPaymentHook()

        const result = await createEventRegistration({
          eventId,
          ticketTierId: ticketTierId || null,
          submissionId: ctx.submissionId,
          userId: ctx.userId,
          name,
          email,
          guests,
          attendance: payloadString(ctx.payload, 'attendance') || 'in_person',
          notes: payloadString(ctx.payload, 'notes'),
        })
        if ('error' in result) {
          console.error('[events] registration hook failed', result.error)
          return
        }

        if (ctx.userId) {
          try {
            const { fillMissingProfileContact } = await import(
              '@/modules/profiles/api.server'
            )
            await fillMissingProfileContact(ctx.userId, {
              phone,
              displayName: name,
            })
          } catch {
            /* profile sync is best-effort */
          }
        }

        // Paid tier + payments on: hold seat and hand off to shared checkout.
        // Approval, when required, runs after payment. Waitlisted rows skip payments.
        if (
          (result.registration.status === 'registered' ||
            result.registration.status === 'pending') &&
          ticketTierId &&
          (await isPaymentsModuleOn())
        ) {
          const priced = await tierRequiresPayment(ticketTierId, {
            payload: ctx.payload,
            userId: ctx.userId,
          })
          if (priced.requires) {
            const methodRaw = payloadString(ctx.payload, 'payment_method')
            const couponCode =
              payloadString(ctx.payload, 'coupon_code') ||
              payloadString(ctx.payload, 'coupon')
            const checkout = await beginPaidTicketCheckout({
              registrationId: result.registration.id,
              event: {
                id: event.id,
                title: event.title,
                slug: event.slug,
                merchantUserId: event.merchantUserId || null,
              },
              ticketTierId,
              buyerEmail: email,
              buyerName: name,
              userId: ctx.userId,
              guests,
              payload: ctx.payload,
              couponCode: couponCode || undefined,
              method:
                methodRaw === 'bank_transfer' ||
                methodRaw === 'pay_at_entrance' ||
                methodRaw === 'cash' ||
                methodRaw === 'barion' ||
                methodRaw === 'stripe' ||
                methodRaw === 'paypal'
                  ? methodRaw
                  : undefined,
            })
            if (!checkout.ok) {
              console.error('[events] checkout failed', checkout.error)
              return
            }
            return { redirectUrl: checkout.checkoutPath }
          }
        }

        const { registration } = result
        if (
          registration.status !== 'registered' &&
          registration.status !== 'waitlisted' &&
          registration.status !== 'pending'
        ) {
          return
        }

        let tierTitle = ''
        if (registration.ticketTierId) {
          try {
            const { findTicketTierById } = await import('./tiers')
            const tier = await findTicketTierById(registration.ticketTierId)
            tierTitle = tier?.title || ''
          } catch {
            /* ignore */
          }
        }
        const { emitEventsSignupEmails } = await import('./email-emit')
        await emitEventsSignupEmails({
          event,
          registration,
          ticketTierTitle: tierTitle,
        })
        const ack = publicSignupAck(registration.status)
        if (ack) return { message: ack }
      } catch (error) {
        console.error('[events] onSubmitted failed', error)
      }
    },
  })
}
