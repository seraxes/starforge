'use client'

import React, { useActionState } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateLayoutBreakpointsAction,
  type LayoutActionState,
  type LayoutBreakpoints,
} from '@/core/modules'

import { LayoutIdField } from '../layout-outline-context'

const initialState: LayoutActionState = {}

const FIELDS: Array<{
  key: keyof LayoutBreakpoints
  label: string
  hint: string
}> = [
  {
    key: 'largeDesktop',
    label: 'Large desktop',
    hint: 'min-width for large desktop (also boxed container max)',
  },
  {
    key: 'desktop',
    label: 'Desktop',
    hint: 'desktop floor (below large desktop)',
  },
  {
    key: 'tablet',
    label: 'Tablet',
    hint: 'tablet floor',
  },
  {
    key: 'mobile',
    label: 'Mobile',
    hint: 'small / large-mobile ceiling',
  },
  {
    key: 'mobileMenu',
    label: 'Mobile menu',
    hint: 'at/below this width, nav stacks (mobile menu threshold)',
  },
]

type Props = {
  layoutLabel: string
  breakpoints: LayoutBreakpoints
}

export function BreakpointsForm({ layoutLabel, breakpoints }: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [state, action, pending] = useActionState(
    async (prev: LayoutActionState, formData: FormData) => {
      const result = await updateLayoutBreakpointsAction(prev, formData)
      if (result.ok) router.refresh()
      return result
    },
    initialState,
  )

  return (
    <form action={action} className="settings-form breakpoints-form">
      <LayoutIdField />

      <p className="breakpoints-form-lede">
        Outline <strong>{layoutLabel}</strong> (<code>{layoutId}</code>). Values are CSS lengths —
        prefer <code>rem</code> (Gantry Helium defaults). Applies to public CSS variables for this
        outline only; Default outline = site global.
      </p>

      <div className="breakpoints-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className="settings-field">
            <span>{field.label}</span>
            <input
              type="text"
              name={field.key}
              defaultValue={breakpoints[field.key]}
              placeholder={breakpoints[field.key]}
              spellCheck={false}
              autoComplete="off"
              disabled={pending}
              aria-describedby={`bp-hint-${field.key}`}
            />
            <small id={`bp-hint-${field.key}`} className="field-hint">
              {field.hint}
            </small>
          </label>
        ))}
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.ok && state.message ? <p className="form-ok">{state.message}</p> : null}

      <div className="page-settings-actions">
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save breakpoints'}
        </button>
      </div>
    </form>
  )
}
