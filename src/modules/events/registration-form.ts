/**
 * Ensure a shared Forms definition for public event signup (idempotent).
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { sfForms } from '@/core/db/schema'
import {
  emptyFormDefinitionDocument,
  serializeFormDefinitionDocument,
} from '@/core/forms/definition'
import { DEFAULT_EVENT_REGISTRATION_FORM_ID } from '@/core/forms/presets'
import { loadFormDefinition } from '@/core/forms/definitions-store'
import type { FormFieldDef } from '@/core/forms/types'

import {
  countRegisteredGuestsForTier,
  listTicketTiersForEvent,
} from './tiers'

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

/** Load definition fields with event_id + optional ticket tier + terms checkbox. */
export async function loadEventRegistrationFields(
  eventId: string,
  options?: { termsUrl?: string },
) {
  await ensureEventRegistrationFormSeeded()
  const loaded = await loadFormDefinition(DEFAULT_EVENT_REGISTRATION_FORM_ID)
  const tiers = await listTicketTiersForEvent(eventId)

  let fields: FormFieldDef[] = loaded.document.fields.map((field) =>
    field.name === 'event_id'
      ? { ...field, defaultValue: eventId }
      : field,
  )

  // Drop stale injected fields — we re-add fresh options each request.
  fields = fields.filter(
    (f) => f.name !== 'ticket_tier_id' && f.name !== 'accept_terms',
  )

  if (tiers.length > 0) {
    const options = await Promise.all(
      tiers.map(async (tier) => {
        let leftLabel = ''
        if (typeof tier.capacity === 'number') {
          const used = await countRegisteredGuestsForTier(eventId, tier.id)
          const left = Math.max(0, tier.capacity - used)
          leftLabel = ` (${left} left)`
        }
        const price = tier.priceLabel.trim() ? ` — ${tier.priceLabel.trim()}` : ''
        return {
          value: tier.id,
          label: `${tier.title}${price}${leftLabel}`,
        }
      }),
    )
    const tierField: FormFieldDef = {
      id: 'event_ticket_tier',
      name: 'ticket_tier_id',
      label: 'Ticket type',
      type: 'select',
      required: true,
      defaultValue: options[0]?.value || '',
      options,
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

  return {
    definitionId: loaded.id || DEFAULT_EVENT_REGISTRATION_FORM_ID,
    document: { ...loaded.document, fields },
    tiers,
  }
}
