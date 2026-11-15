/**
 * Ensure a shared Forms definition for subscription signup (idempotent).
 */

import 'server-only'

import {
  DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID,
  emptyFormDefinitionDocument,
  ensureFormDefinitionSeed,
  loadFormDefinition,
  type FormFieldDef,
} from '@/modules/forms/api'

export { DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID }

export async function ensureSubscriptionRegistrationFormSeeded(): Promise<string> {
  const document = emptyFormDefinitionDocument('subscription-registration')
  const seeded = await ensureFormDefinitionSeed({
    id: DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID,
    document,
    label: document.title || 'Subscription registration',
  })
  return seeded.id
}

export type SubscriptionRegistrationPrefill = {
  name?: string
  email?: string
}

/** Load plan intake fields; inject plan_id / user_id at render time. */
export async function loadSubscriptionRegistrationFields(
  formDefinitionId: string,
  options?: {
    planId?: string
    userId?: string
    prefill?: SubscriptionRegistrationPrefill
  },
) {
  await ensureSubscriptionRegistrationFormSeeded()
  const preferredId = (formDefinitionId || '').trim() || DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID
  let loaded = await loadFormDefinition(preferredId)
  if (loaded.source !== 'database') {
    loaded = await loadFormDefinition(DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID)
  }

  const planId = (options?.planId || '').trim()
  const userId = (options?.userId || '').trim()
  const prefill = options?.prefill

  let fields: FormFieldDef[] = loaded.document.fields.map((field) => {
    if (field.name === 'plan_id' && planId) return { ...field, defaultValue: planId }
    if (field.name === 'user_id' && userId) return { ...field, defaultValue: userId }
    if (field.name === 'name' && prefill?.name) {
      return { ...field, defaultValue: prefill.name }
    }
    if (field.name === 'email' && prefill?.email) {
      return { ...field, defaultValue: prefill.email }
    }
    return field
  })

  fields = fields.filter((f) => f.name !== 'plan_id' && f.name !== 'user_id')

  if (planId) {
    fields = [
      {
        id: 'sub_plan_id',
        name: 'plan_id',
        label: 'Plan',
        type: 'hidden',
        required: false,
        defaultValue: planId,
      },
      ...fields,
    ]
  }
  if (userId) {
    fields = [
      {
        id: 'sub_user_id',
        name: 'user_id',
        label: 'User',
        type: 'hidden',
        required: false,
        defaultValue: userId,
      },
      ...fields,
    ]
  }

  return {
    definitionId: loaded.id || preferredId,
    document: { ...loaded.document, fields },
  }
}
