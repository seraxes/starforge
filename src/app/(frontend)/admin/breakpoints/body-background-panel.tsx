'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  copyLayoutBodyBackgroundFromParentAction,
  updateLayoutBodyBackgroundAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  bodyBackgroundFit,
  cssColorToColorInputValue,
  type LayoutBodyBackground,
  type LayoutBodyBackgroundFit,
} from '@/core/modules/styles'
import { MediaPicker } from '@/modules/media/api'

import { useAdminToast } from '../admin-toast'
import { InheritCopyRow } from '../layouts/layout-inherit-controls'
import { useLayoutOutlineId } from '../layouts/layout-outline-context'
import { useDebouncedPersist } from '../use-debounced-persist'

type Props = {
  body?: LayoutBodyBackground
  /** Child outline is using the parent page background (no local block). */
  inherited: boolean
  /** Non-base outline with a parent — show Inherit / Copy. */
  canInherit: boolean
}

const FITS: Array<{ value: LayoutBodyBackgroundFit; label: string }> = [
  { value: 'cover-fixed', label: 'Cover — fixed behind the page' },
  { value: 'cover-scroll', label: 'Cover — scrolls with the page' },
  { value: 'contain', label: 'Contain' },
  { value: 'tile', label: 'Tile' },
]

/**
 * Layouts → Styles → Page background.
 * Autosaves onto the outline document (`styles.body`).
 */
export function BodyBackgroundPanel({ body, inherited, canInherit }: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fieldsDisabled = inherited || pending
  const savedFit = bodyBackgroundFit(body)
  const savedColor = body?.disabled ? '' : (body?.backgroundColor ?? '')
  const mediaId = body?.disabled ? '' : (body?.backgroundMediaId ?? '')
  const mediaUrl = body?.disabled ? '' : (body?.backgroundImage ?? '')
  const [fit, setFit] = useState(savedFit)
  const [color, setColor] = useState(savedColor)
  useEffect(() => {
    setFit(savedFit)
    setColor(savedColor)
  }, [savedFit, savedColor])
  const hasPaint = Boolean(!inherited && (color || mediaId || mediaUrl))

  const persist = useCallback(
    (next: {
      mode: 'set' | 'clear' | 'inherit'
      color?: string
      fit?: LayoutBodyBackgroundFit
      mediaId?: string
      url?: string
    }) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('mode', next.mode)
      if (next.mode === 'clear' && canInherit) fd.set('blockInherit', '1')
      if (next.mode === 'set') {
        fd.set('backgroundColor', next.color ?? '')
        fd.set('fit', next.fit ?? 'cover-fixed')
        fd.set('backgroundMediaId', next.mediaId ?? '')
        fd.set('backgroundImage', next.url ?? '')
        if (canInherit && !next.color && !next.mediaId && !next.url) {
          fd.set('blockInherit', '1')
        }
      }
      startSave(async () => {
        const result: LayoutActionState = await updateLayoutBodyBackgroundAction({}, fd)
        if (result.ok) {
          setError(null)
          notifySaved('Saved')
          router.refresh()
        } else if (result.error) {
          setError(result.error)
          notifyError(result.error)
        }
      })
    },
    [canInherit, layoutId, notifyError, notifySaved, router],
  )

  const { schedule, flush } = useDebouncedPersist(
    (next: { color: string }) => {
      if (inherited) return
      persist({
        mode: 'set',
        color: next.color,
        fit,
        mediaId,
        url: mediaUrl,
      })
    },
  )

  return (
    <details className={inherited ? 'section-styles-card sf-inherited-muted' : 'section-styles-card'} open>
      <summary className="section-styles-card-summary">
        <span className="section-styles-card-summary-main">
          <span className="section-styles-card-title">Page background</span>
          <code className="section-styles-card-id">body</code>
          {inherited ? (
            <span className="gantry-inherit-badge" title="Page background inherited from parent outline">
              Inherited
            </span>
          ) : null}
        </span>
        {canInherit ? (
          <InheritCopyRow
            inline
            inherited={inherited}
            disabled={pending}
            copyLabel="Copy"
            onInheritChange={(next) => {
              if (next) {
                persist({ mode: 'inherit' })
                return
              }
              const fd = new FormData()
              fd.set('layoutId', layoutId)
              startSave(async () => {
                const result = await copyLayoutBodyBackgroundFromParentAction({}, fd)
                if (result.ok) {
                  setError(null)
                  notifySaved('Saved')
                  router.refresh()
                } else if (result.error) {
                  setError(result.error)
                  notifyError(result.error)
                }
              })
            }}
            onCopy={() => {
              const fd = new FormData()
              fd.set('layoutId', layoutId)
              startSave(async () => {
                const result = await copyLayoutBodyBackgroundFromParentAction({}, fd)
                if (result.ok) {
                  setError(null)
                  notifySaved('Copied')
                  router.refresh()
                } else if (result.error) {
                  setError(result.error)
                  notifyError(result.error)
                }
              })
            }}
          />
        ) : null}
      </summary>

      <div className="settings-form section-styles-form">
        <div className="settings-field">
          <MediaPicker
            label="Background image"
            value={{ mediaId, url: mediaUrl }}
            defaultFolder="backgrounds"
            defaultPurpose="photo"
            disabled={fieldsDisabled}
            includeHiddenInputs={false}
            hint="Behind the whole page. A section background still covers it on that section."
            onChange={(next) => {
              if (inherited) return
              const url = next.url ?? ''
              const id = next.mediaId ?? ''
              if (!id && !url && !color) {
                persist({ mode: 'clear' })
                return
              }
              persist({ mode: 'set', color, fit, mediaId: id, url })
            }}
          />
        </div>

        <label className="settings-field">
          <span>Fit</span>
          <select
            value={fit}
            disabled={fieldsDisabled || (!mediaId && !mediaUrl)}
            onChange={(event) => {
              const nextFit = event.target.value as LayoutBodyBackgroundFit
              setFit(nextFit)
              persist({ mode: 'set', color, fit: nextFit, mediaId, url: mediaUrl })
            }}
          >
            {FITS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-field section-styles-color-field">
          <span className="section-styles-color-label">Background color</span>
          <span className="gantry-color-field section-styles-color-row">
            <input
              type="color"
              className="gantry-color-swatch"
              aria-label="Page background color picker"
              disabled={fieldsDisabled}
              value={cssColorToColorInputValue(color)}
              onChange={(event) => {
                const hex = event.target.value
                setColor(hex)
                schedule('backgroundColor', { color: hex })
              }}
            />
            <input
              type="text"
              className="gantry-inline-input"
              aria-label="Page background color"
              disabled={fieldsDisabled}
              value={color}
              placeholder="#eef4fa"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                const next = event.target.value
                setColor(next)
                schedule('backgroundColor', { color: next })
              }}
              onBlur={(event) => flush('backgroundColor', { color: event.target.value })}
            />
          </span>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {hasPaint && !inherited ? (
          <div className="page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn"
              disabled={pending}
              onClick={() => persist({ mode: 'clear' })}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
    </details>
  )
}
