'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateLayoutBreakpointsAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutBreakpoints } from '@/core/modules/styles'

import { useAdminToast } from '../admin-toast'
import { useDebouncedPersist } from '../use-debounced-persist'
import { useLayoutOutlineId } from '../layouts/layout-outline-context'

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

/**
 * Outline breakpoints — autosave (~500ms debounce + blur), no Save button.
 */
export function BreakpointsForm({ layoutLabel, breakpoints }: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<LayoutBreakpoints>(breakpoints)

  useEffect(() => {
    setDraft(breakpoints)
  }, [breakpoints])

  const persist = useCallback(
    (next: LayoutBreakpoints) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      for (const field of FIELDS) {
        fd.set(field.key, next[field.key])
      }
      startSave(async () => {
        const result: LayoutActionState = await updateLayoutBreakpointsAction({}, fd)
        if (result.ok) {
          setError(null)
          notifySaved('Saved')
          router.refresh()
        } else {
          setError(result.error ?? 'Could not save breakpoints.')
          notifyError(result.error ?? 'Could not save breakpoints.')
        }
      })
    },
    [layoutId, notifyError, notifySaved, router],
  )

  const { schedule, flush } = useDebouncedPersist(persist)

  const onFieldChange = (key: keyof LayoutBreakpoints, value: string) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    schedule('breakpoints', next)
  }

  const onFieldBlur = (key: keyof LayoutBreakpoints, value: string) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    flush('breakpoints', next)
  }

  return (
    <div className="settings-form breakpoints-form">
      <p className="breakpoints-form-lede">
        Outline <strong>{layoutLabel}</strong> (<code>{layoutId}</code>). Values are CSS lengths —
        prefer <code>rem</code> (Gantry Helium defaults). Saves automatically. Applies to public CSS
        variables for this outline only; Default outline = site global.
      </p>

      <div className="breakpoints-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className="settings-field">
            <span>{field.label}</span>
            <input
              type="text"
              name={field.key}
              value={draft[field.key]}
              placeholder={breakpoints[field.key]}
              spellCheck={false}
              autoComplete="off"
              disabled={pending}
              aria-describedby={`bp-hint-${field.key}`}
              onChange={(event) => onFieldChange(field.key, event.target.value)}
              onBlur={(event) => onFieldBlur(field.key, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  ;(event.target as HTMLInputElement).blur()
                }
              }}
            />
            <small id={`bp-hint-${field.key}`} className="field-hint">
              {field.hint}
            </small>
          </label>
        ))}
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </div>
  )
}
