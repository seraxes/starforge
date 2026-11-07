import React from 'react'

import { resolveFormCaptcha } from '@/core/security/captcha'
import { formHasCaptchaField } from '@/core/forms/definition'
import { FormWidget } from '@/modules/form/FormWidget'

import { loadEventRegistrationFields } from '../registration-form'
import {
  countRegisteredGuests,
  isEventRegistrationOpen,
} from '../registrations'
import type { EventRecord } from '../types'

type Props = {
  event: Pick<
    EventRecord,
    | 'id'
    | 'title'
    | 'capacity'
    | 'status'
    | 'registrationOpensAt'
    | 'registrationClosesAt'
    | 'signupNote'
    | 'termsUrl'
  >
}

/**
 * Public event signup — shared Forms engine + event-registration preset.
 */
export async function EventRegistrationForm({ event }: Props) {
  if (event.status !== 'published') return null

  const window = isEventRegistrationOpen(event)
  if (!window.open) {
    return (
      <section className="sf-event-registration" aria-label="Event registration">
        <h2 className="sf-event-registration-heading">Register</h2>
        <p className="sf-event-registration-meta settings-hint">
          {window.reason || 'Registration is closed.'}
        </p>
      </section>
    )
  }

  const { definitionId, document } = await loadEventRegistrationFields(event.id, {
    termsUrl: event.termsUrl,
  })
  const occupied = await countRegisteredGuests(event.id)
  const remaining =
    typeof event.capacity === 'number' ? Math.max(0, event.capacity - occupied) : null
  const hasCaptchaField = formHasCaptchaField(document.fields)
  const captcha = await resolveFormCaptcha({
    useSiteCaptchaDefault: document.useSiteCaptchaDefault !== false,
    hasCaptchaField,
  })
  const note = (event.signupNote || '').trim()
  const termsUrl = (event.termsUrl || '').trim()

  return (
    <section
      id="register"
      className="sf-event-registration"
      aria-label="Event registration"
    >
      <h2 className="sf-event-registration-heading">Register</h2>
      {note ? <p className="sf-event-registration-note">{note}</p> : null}
      {termsUrl ? (
        <p className="sf-event-registration-terms settings-hint">
          By registering you agree to the{' '}
          <a href={termsUrl} rel="noopener noreferrer">
            terms &amp; conditions
          </a>
          .
        </p>
      ) : null}
      {remaining != null ? (
        <p className="sf-event-registration-meta settings-hint">
          {remaining === 0
            ? 'Event is full — you can join the waitlist.'
            : `${remaining} seat${remaining === 1 ? '' : 's'} left.`}
        </p>
      ) : null}
      <FormWidget
        formKey={`event-reg-${event.id}`}
        slotId={`event-reg-${event.id}`}
        definitionId={definitionId}
        heading=""
        fields={document.fields}
        sections={document.sections}
        successMessage={document.successMessage || 'You are registered.'}
        submitLabel={document.submitLabel || 'Register'}
        useSiteCaptchaDefault={document.useSiteCaptchaDefault !== false}
        captcha={{
          required: captcha.required,
          provider: captcha.provider,
          siteKey: captcha.siteKey,
          misconfiguredReason: captcha.misconfiguredReason,
        }}
      />
    </section>
  )
}
