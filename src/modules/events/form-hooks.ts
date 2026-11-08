/**
 * Events → Forms preset bridge (product:events PR3).
 * Registers `event-registration` onSubmitted: capacity row + Email Manager emit.
 */

import 'server-only'

import { registerFormPreset } from '@/modules/forms/api'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { getAccessViewer } from '@/core/acl/access'

import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from './public-access'
import { createEventRegistration } from './registrations'
import { findEventById } from './store'

export const EVENTS_REGISTERED_TRIGGER = 'product:events/registered' as const

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
        if (!viewerPassesEventAcl(event, viewer)) return
        if (!(await viewerPassesEventPassword(event, viewer))) return

        const ticketTierId =
          payloadString(ctx.payload, 'ticket_tier_id') ||
          payloadString(ctx.payload, 'ticketTierId')

        const name = payloadString(ctx.payload, 'name')
        const email = payloadString(ctx.payload, 'email')
        const phone = payloadString(ctx.payload, 'phone')

        const result = await createEventRegistration({
          eventId,
          ticketTierId: ticketTierId || null,
          submissionId: ctx.submissionId,
          userId: ctx.userId,
          name,
          email,
          guests: payloadGuests(ctx.payload),
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

        const { registration } = result
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
        try {
          const { emitEmailTrigger, isEmailManagerEnabled } = await import(
            '@/modules/email-manager/api.server'
          )
          if (!(await isEmailManagerEnabled())) return
          await emitEmailTrigger({
            triggerKey: EVENTS_REGISTERED_TRIGGER,
            payload: {
              eventId: event.id,
              eventTitle: event.title,
              eventSlug: event.slug,
              registrationId: registration.id,
              registrationStatus: registration.status,
              ticketTierId: registration.ticketTierId,
              ticketTierTitle: tierTitle,
              name: registration.name,
              email: registration.email,
              guests: registration.guests,
              attendance: registration.attendance,
              submissionId: ctx.submissionId,
              respondentEmail: registration.email,
            },
          })
        } catch (error) {
          console.error('[events] email emit failed', error)
        }
      } catch (error) {
        console.error('[events] onSubmitted failed', error)
      }
    },
  })
}
