/**
 * Ensure a shared Forms definition for public event signup (idempotent).
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { sfForms } from '@/core/db/schema'
import {
  DEFAULT_EVENT_REGISTRATION_FORM_ID,
  emptyFormDefinitionDocument,
  loadFormDefinition,
  serializeFormDefinitionDocument,
  type FormFieldDef,
} from '@/modules/forms/api'

import { listPublicTicketTiersForEvent } from './public-tiers'
import { DEFAULT_MAX_TICKETS_PER_BOOKING } from './types'

export { DEFAULT_EVENT_REGISTRATION_FORM_ID }

export async function ensureEventRegistrationFormSeeded(): Promise<string> {
  try {
    const [row] = await db
      .select({ id: sfForms.id })
      .from(sfForms)
      .where(eq(sfForms.id, DEFAULT_EVENT_REGISTRATION_FORM_ID))
      .limit(1)
    if (row) return row.id

    const document = emptyFormDefinitionDocument('event-registration')
    await db.insert(sfForms).values({
      id: DEFAULT_EVENT_REGISTRATION_FORM_ID,
      label: document.title,
      preset: 'event-registration',
      document: serializeFormDefinitionDocument(document),
    })
    return DEFAULT_EVENT_REGISTRATION_FORM_ID
  } catch {
    return DEFAULT_EVENT_REGISTRATION_FORM_ID
  }
}

export type EventRegistrationPrefill = {
  name?: string
  email?: string
  phone?: string
}

/** Load definition fields with event_id + optional ticket tier + terms checkbox. */
export async function loadEventRegistrationFields(
  eventId: string,
  options?: {
    termsUrl?: string
    preferredTierId?: string
    prefill?: EventRegistrationPrefill
  },
) {
  await ensureEventRegistrationFormSeeded()
  const loaded = await loadFormDefinition(DEFAULT_EVENT_REGISTRATION_FORM_ID)
  const tiers = await listPublicTicketTiersForEvent(eventId)
  const prefill = options?.prefill

  let fields: FormFieldDef[] = loaded.document.fields.map((field) => {
    if (field.name === 'event_id') return { ...field, defaultValue: eventId }
    if (field.name === 'name' && prefill?.name) {
      return { ...field, defaultValue: prefill.name }
    }
    if (field.name === 'email' && prefill?.email) {
      return { ...field, defaultValue: prefill.email }
    }
    if (field.name === 'phone' && prefill?.phone) {
      return { ...field, defaultValue: prefill.phone }
    }
    return field
  })

  // Drop stale injected fields — we re-add fresh options each request.
  fields = fields.filter(
    (f) =>
      f.name !== 'ticket_tier_id' &&
      f.name !== 'accept_terms' &&
      f.name !== 'coupon_code',
  )

  if (tiers.length > 0) {
    const tierOptions = tiers.map((tier) => {
      const price = tier.priceLabel.trim() ? ` — ${tier.priceLabel.trim()}` : ''
      const leftLabel =
        tier.soldOut
          ? ' (sold out)'
          : tier.remaining != null
            ? ` (${tier.remaining} left)`
            : ''
      return {
        value: tier.id,
        label: `${tier.title}${price}${leftLabel}`,
        disabled: tier.soldOut,
      }
    })
    const preferred = (options?.preferredTierId || '').trim()
    const preferredOpen =
      preferred && tierOptions.some((o) => o.value === preferred && !o.disabled)
        ? preferred
        : ''
    const firstOpen = preferredOpen || tierOptions.find((o) => !o.disabled)?.value || ''
    const tierField: FormFieldDef = {
      id: 'event_ticket_tier',
      name: 'ticket_tier_id',
      label: 'Ticket type',
      type: 'select',
      required: true,
      defaultValue: firstOpen,
      options: tierOptions,
      description: 'Choose a ticket / faction slot for this event.',
    }
    // Insert after email (or at start of visible fields).
    const emailIdx = fields.findIndex((f) => f.name === 'email')
    if (emailIdx >= 0) {
      fields = [
        ...fields.slice(0, emailIdx + 1),
        tierField,
        ...fields.slice(emailIdx + 1),
      ]
    } else {
      fields = [tierField, ...fields]
    }

    const preferredTier = firstOpen
      ? tiers.find((t) => t.id === firstOpen)
      : undefined
    const openMaxes = tiers.filter((t) => !t.soldOut).map((t) => t.maxPerBooking)
    const guestsMax = preferredTier
      ? preferredTier.maxPerBooking
      : openMaxes.length > 0
        ? Math.max(...openMaxes)
        : DEFAULT_MAX_TICKETS_PER_BOOKING
    fields = fields.map((field) => {
      if (field.name !== 'guests' || field.type !== 'number') return field
      return {
        ...field,
        numberBounds: {
          min: 1,
          max: guestsMax,
        },
        description:
          guestsMax === 1
            ? 'One ticket per booking for this ticket type.'
            : `Up to ${guestsMax} tickets per booking for this ticket type.`,
      }
    })
  }

  const termsUrl = (options?.termsUrl || '').trim()
  if (termsUrl) {
    const termsField: FormFieldDef = {
      id: 'event_accept_terms',
      name: 'accept_terms',
      label: 'I agree to the terms & conditions',
      type: 'checkbox',
      required: true,
      description: `Open terms: ${termsUrl}`,
      defaultValue: '',
    }
    fields = [...fields, termsField]
  }

  // Payments owns coupons — inject optional code field when Payments is enabled.
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const site = await getSiteSettings()
    if (isCatalogModuleEnabled(site, MODULE_IDS.payments)) {
      const couponField: FormFieldDef = {
        id: 'event_coupon_code',
        name: 'coupon_code',
        label: 'Coupon code',
        type: 'text',
        required: false,
        defaultValue: '',
        description: 'Optional. Discount is applied at checkout by Payments.',
      }
      fields = [...fields, couponField]
    }
  } catch {
    /* payments pack may be off */
  }

  return {
    definitionId: loaded.id || DEFAULT_EVENT_REGISTRATION_FORM_ID,
    document: { ...loaded.document, fields },
    tiers,
  }
}
