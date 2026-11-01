'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'

import { submitFormAction, type FormSubmitActionState } from '@/core/forms/actions'
import {
  describeDateTimeConstraints,
  htmlInputTypeForField,
  isDateTimeFieldType,
} from '@/core/forms/date-constraints'
import { computeLiveValues } from '@/core/forms/evaluate'
import type { FormFieldDef, FormFieldOption, FormSectionDef, ResolvedCaptcha } from '@/core/forms/types'
import { normalizeFormSections } from '@/core/forms/definition'

import { TurnstileWidget } from './TurnstileWidget'

export type FormWidgetProps = {
  formKey: string
  slotId: string
  layoutId?: string
  definitionId?: string | null
  heading?: string
  fields: FormFieldDef[]
  sections?: FormSectionDef[]
  successMessage: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  /** Pre-resolved on the server — never import `@/core/forms/captcha` here. */
  captcha: ResolvedCaptcha
}

const initialState: FormSubmitActionState = {}

function OptionMedia({ option }: { option: FormFieldOption }) {
  const media = option.media
  if (!media?.url && !media?.mediaId) return null
  const src = media.url || (media.mediaId ? `/api/media/${media.mediaId}` : '')
  if (!src) return null
  if (media.kind === 'file') {
    return (
      <a className="sf-form-option-file" href={src} target="_blank" rel="noreferrer">
        {media.alt || 'File'}
      </a>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- interim media bind until SF-28
    <img
      className="sf-form-option-media"
      src={src}
      alt={media.alt || option.label}
      width={32}
      height={32}
    />
  )
}

export function FormWidget(props: FormWidgetProps) {
  const [state, formAction, pending] = useActionState(submitFormAction, initialState)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of props.fields) init[f.name] = ''
    return init
  })

  const live = useMemo(
    () => computeLiveValues(props.fields, values),
    [props.fields, values],
  )

  const sections = useMemo(
    () => normalizeFormSections(props.sections, props.fields),
    [props.sections, props.fields],
  )

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      const init: Record<string, string> = {}
      for (const f of props.fields) init[f.name] = ''
      setValues(init)
    }
  }, [state.ok, state.message, props.fields])

  function setFieldValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

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

  function renderField(field: FormFieldDef) {
    if (!live.visible[field.name]) return null
    const key = field.id || field.name
    const required = live.required[field.name]
    const value = live.values[field.name] ?? ''

    if (field.type === 'checkbox') {
      return (
        <label key={key} className="sf-form-field sf-form-field-check">
          <span className="sf-form-check-row">
            <input
              type="checkbox"
              name={field.name}
              value="on"
              checked={value === 'on' || value === 'true' || value === '1'}
              required={required}
              disabled={pending}
              onChange={(e) => setFieldValue(field.name, e.target.checked ? 'on' : '')}
            />
            <span>
              {field.label}
              {required ? <abbr title="required">*</abbr> : null}
            </span>
          </span>
          {field.description ? (
            <span className="sf-form-field-hint">{field.description}</span>
          ) : null}
        </label>
      )
    }

    if (field.type === 'select') {
      return (
        <label key={key} className="sf-form-field">
          <span>
            {field.label}
            {required ? <abbr title="required">*</abbr> : null}
          </span>
          <select
            name={field.name}
            required={required}
            disabled={pending}
            value={value}
            onChange={(e) => setFieldValue(field.name, e.target.value)}
          >
            <option value="" disabled>
              {field.placeholder || 'Select…'}
            </option>
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ul className="sf-form-option-media-list" aria-hidden={!field.options?.some((o) => o.media)}>
            {(field.options ?? [])
              .filter((o) => o.media)
              .map((opt) => (
                <li key={opt.value}>
                  <OptionMedia option={opt} />
                  <span>{opt.label}</span>
                </li>
              ))}
          </ul>
          {field.description ? (
            <span className="sf-form-field-hint">{field.description}</span>
          ) : null}
        </label>
      )
    }

    if (field.type === 'radio' || field.type === 'checkbox-group') {
      const multi = field.type === 'checkbox-group'
      const picked = new Set(value.split(',').map((s) => s.trim()).filter(Boolean))
      return (
        <fieldset key={key} className="sf-form-field sf-form-field-options">
          <legend>
            {field.label}
            {required ? <abbr title="required">*</abbr> : null}
          </legend>
          <ul className="sf-form-options">
            {(field.options ?? []).map((opt) => (
              <li key={opt.value}>
                <label className="sf-form-option">
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={field.name}
                    value={opt.value}
                    checked={multi ? picked.has(opt.value) : value === opt.value}
                    required={required && !multi ? !value : undefined}
                    disabled={pending}
                    onChange={(e) => {
                      if (!multi) {
                        setFieldValue(field.name, e.target.value)
                        return
                      }
                      const next = new Set(picked)
                      if (e.target.checked) next.add(opt.value)
                      else next.delete(opt.value)
                      setFieldValue(field.name, [...next].join(','))
                    }}
                  />
                  <OptionMedia option={opt} />
                  <span>{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {field.description ? (
            <span className="sf-form-field-hint">{field.description}</span>
          ) : null}
        </fieldset>
      )
    }

    if (field.type === 'textarea') {
      return (
        <label key={key} className="sf-form-field">
          <span>
            {field.label}
            {required ? <abbr title="required">*</abbr> : null}
          </span>
          <textarea
            name={field.name}
            rows={5}
            required={required}
            placeholder={field.placeholder || undefined}
            disabled={pending}
            value={value}
            onChange={(e) => setFieldValue(field.name, e.target.value)}
          />
          {field.description ? (
            <span className="sf-form-field-hint">{field.description}</span>
          ) : null}
        </label>
      )
    }

    if (field.type === 'computed') {
      return (
        <label key={key} className="sf-form-field sf-form-field-computed">
          <span>{field.label}</span>
          <input type="text" name={field.name} value={value} readOnly disabled={pending} />
          {field.description || field.computed?.expression ? (
            <span className="sf-form-field-hint">
              {field.description || `= ${field.computed?.expression}`}
            </span>
          ) : null}
        </label>
      )
    }

    if (isDateTimeFieldType(field.type)) {
      const inputType = htmlInputTypeForField(field.type)!
      const constraintHint = describeDateTimeConstraints(field.type, field.constraints)
      const hint = [field.description, constraintHint].filter(Boolean).join(' · ')
      return (
        <label key={key} className="sf-form-field">
          <span>
            {field.label}
            {required ? <abbr title="required">*</abbr> : null}
          </span>
          <input
            type={inputType}
            name={field.name}
            required={required}
            min={field.constraints?.min || undefined}
            max={field.constraints?.max || undefined}
            disabled={pending}
            value={value}
            onChange={(e) => setFieldValue(field.name, e.target.value)}
          />
          {hint ? <span className="sf-form-field-hint">{hint}</span> : null}
        </label>
      )
    }

    const inputType =
      field.type === 'email'
        ? 'email'
        : field.type === 'number'
          ? 'number'
          : field.type === 'tel'
            ? 'tel'
            : field.type === 'url'
              ? 'url'
              : 'text'

    return (
      <label key={key} className="sf-form-field">
        <span>
          {field.label}
          {required ? <abbr title="required">*</abbr> : null}
        </span>
        <input
          type={inputType}
          name={field.name}
          required={required}
          placeholder={field.placeholder || undefined}
          min={field.numberBounds?.min}
          max={field.numberBounds?.max}
          autoComplete={
            field.name === 'email' ? 'email' : field.name === 'name' ? 'name' : 'off'
          }
          disabled={pending}
          value={value}
          onChange={(e) => setFieldValue(field.name, e.target.value)}
        />
        {field.description ? (
          <span className="sf-form-field-hint">{field.description}</span>
        ) : null}
      </label>
    )
  }

  return (
    <div
      className="sf-form"
      data-sf-form={props.formKey}
      data-sf-slot={props.slotId}
      data-sf-definition={props.definitionId ?? undefined}
    >
      {props.heading ? <h3 className="sf-form-heading">{props.heading}</h3> : null}
      <form ref={formRef} action={formAction} className="sf-form-fields" noValidate>
        <input type="hidden" name="formKey" value={props.formKey} />
        <input type="hidden" name="slotId" value={props.slotId} />
        <input type="hidden" name="layoutId" value={props.layoutId ?? ''} />
        <input type="hidden" name="definitionId" value={props.definitionId ?? ''} />
        <input type="hidden" name="fieldsJson" value={JSON.stringify(props.fields)} />
        <input type="hidden" name="successMessage" value={props.successMessage} />
        <input
          type="hidden"
          name="useSiteCaptchaDefault"
          value={props.useSiteCaptchaDefault ? '1' : '0'}
        />

        <div className="sf-form-hp" aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        {sections.map((section) => {
          const sectionFields = section.fieldNames
            .map((n) => props.fields.find((f) => f.name === n))
            .filter((f): f is FormFieldDef => Boolean(f))
          const visibleFields = sectionFields.filter((f) => live.visible[f.name])
          if (!visibleFields.length) return null
          return (
            <div key={section.id} className="sf-form-section">
              {sections.length > 1 || section.label !== 'Fields' ? (
                <h4 className="sf-form-section-title">{section.label}</h4>
              ) : null}
              {sectionFields.map((field) => renderField(field))}
            </div>
          )
        })}

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
