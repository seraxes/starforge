/**
 * Which Forms definition an event registration uses.
 * Event override, then the category form, then the shared event-registration form.
 */

import { DEFAULT_EVENT_REGISTRATION_FORM_ID } from '@/modules/forms/presets'

export function resolveEventRegistrationFormId(input: {
  eventFormId?: string | null
  categoryFormId?: string | null
}): string {
  const eventForm = (input.eventFormId || '').trim()
  if (eventForm) return eventForm
  const categoryForm = (input.categoryFormId || '').trim()
  if (categoryForm) return categoryForm
  return DEFAULT_EVENT_REGISTRATION_FORM_ID
}
