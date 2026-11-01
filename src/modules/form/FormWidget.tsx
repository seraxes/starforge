'use client'

import React, { useActionState, useEffect } from 'react'

import { submitFormAction, type FormSubmitActionState } from '@/core/forms/actions'
import type { FormFieldDef } from '@/core/forms/types'

import { TurnstileWidget } from './TurnstileWidget'

export type FormWidgetProps = {
  formKey: string
  slotId: string
  layoutId?: string
  heading?: string
  fields: FormFieldDef[]
  successMessage: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  captcha: {
    required: boolean
    provider: string
    siteKey: string | null
    misconfiguredReason?: string
  }
}

const initialState: FormSubmitActionState = {}

export function FormWidget(props: FormWidgetProps) {
  const [state, formAction, pending] = useActionState(submitFormAction, initialState)
  const formRef = React.useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
    }
  }, [state.ok, state.message])

  if (state.ok) {
    return (
      <div className="sf-form sf-form-success" data-sf-form={props.formKey} role="status">
        {props.heading ? <h3 className="sf-form-heading">{props.heading}</h3> : null}
        <p className="sf-form-success-message">{state.message || props.successMessage}</p>
      </div>
    )
  }

  const showTurnstile =
    props.captcha.required &&
    props.captcha.provider === 'turnstile' &&
    Boolean(props.captcha.siteKey)

  return (
    <div className="sf-form" data-sf-form={props.formKey} data-sf-slot={props.slotId}>
      {props.heading ? <h3 className="sf-form-heading">{props.heading}</h3> : null}
      <form ref={formRef} action={formAction} className="sf-form-fields" noValidate>
        <input type="hidden" name="formKey" value={props.formKey} />
        <input type="hidden" name="slotId" value={props.slotId} />
        <input type="hidden" name="layoutId" value={props.layoutId ?? ''} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(props.fields)} />
        <input type="hidden" name="successMessage" value={props.successMessage} />
        <input
          type="hidden"
          name="useSiteCaptchaDefault"
          value={props.useSiteCaptchaDefault ? '1' : '0'}
        />

        {/* Honeypot — hidden from humans, filled by naive bots */}
        <div className="sf-form-hp" aria-hidden="true">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </label>
        </div>

        {props.fields.map((field) => (
          <label key={field.name} className="sf-form-field">
            <span>
              {field.label}
              {field.required ? <abbr title="required">*</abbr> : null}
            </span>
            {field.type === 'textarea' ? (
              <textarea
                name={field.name}
                rows={5}
                required={field.required}
                placeholder={field.placeholder || undefined}
                disabled={pending}
              />
            ) : (
              <input
                type={field.type === 'email' ? 'email' : 'text'}
                name={field.name}
                required={field.required}
                placeholder={field.placeholder || undefined}
                autoComplete={field.name === 'email' ? 'email' : field.name === 'name' ? 'name' : 'off'}
                disabled={pending}
              />
            )}
          </label>
        ))}

        {showTurnstile && props.captcha.siteKey ? (
          <TurnstileWidget siteKey={props.captcha.siteKey} />
        ) : null}

        {props.captcha.required &&
        props.captcha.provider === 'turnstile' &&
        !props.captcha.siteKey ? (
          <p className="sf-form-error" role="alert">
            Captcha is enabled but not configured. Submissions are blocked.
          </p>
        ) : null}

        {state.error ? (
          <p className="sf-form-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <button type="submit" className="sf-form-submit" disabled={pending}>
          {pending ? 'Sending…' : props.submitLabel}
        </button>
      </form>
    </div>
  )
}
