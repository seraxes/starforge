'use client'

import { useState } from 'react'

export type HeroProfileFieldInput = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  options: ReadonlyArray<{ value: string; label: string }>
}

type Props = {
  heroId: string
  legend: string
  fields: readonly HeroProfileFieldInput[]
  values: Record<string, string>
  disabled: boolean
}

/**
 * Hero profile fields. An empty list renders nothing.
 * Values post as `heroExtensionsJson` and are stored in `extensions[heroId]`.
 */
export function HeroProfileFields({
  heroId,
  legend,
  fields,
  values: initial,
  disabled,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {}
    for (const field of fields) next[field.key] = initial[field.key] ?? ''
    return next
  })
  if (fields.length === 0) return null

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <fieldset className="settings-fieldset" data-sf-width={50} data-hero={heroId}>
      <legend>{legend}</legend>
      <input type="hidden" name="heroExtensionsJson" value={JSON.stringify(values)} />
      {fields.map((field) => {
        const id = `pf-hero-${field.key}`
        const value = values[field.key] ?? ''
        return (
          <div key={field.key} className="settings-field">
            <span className="sf-profile-field-head">
              <label htmlFor={id}>{field.label}</label>
            </span>
            {field.type === 'textarea' ? (
              <textarea
                id={id}
                rows={4}
                value={value}
                disabled={disabled}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            ) : field.type === 'select' ? (
              <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                <option value="">Not set</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type="text"
                value={value}
                disabled={disabled}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
