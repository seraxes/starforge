'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
import { MediaPicker } from '@/generated/module-media-host'

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

type Draft = {
  color: string
  fit: LayoutBodyBackgroundFit
  allowGradient: boolean
  mediaId: string
  mediaUrl: string
  overlay: 'enabled' | 'disabled'
  overlayColor: string
  allowGradientOverlay: boolean
}

const GRADIENT_HINT =
  'linear-gradient(180deg, #1c2834 0%, #8ebad4 100%). radial-gradient(circle, #f2a66a, transparent) and conic-gradient(from 90deg, #a85220, #8ebad4) use the same parentheses. No url().'

function isGradientValue(value: string): boolean {
  return /gradient\(/i.test(value)
}

function draftFromBody(body: LayoutBodyBackground | undefined): Draft {
  if (!body || body.disabled) {
    return {
      color: '',
      fit: 'cover-fixed',
      allowGradient: false,
      mediaId: '',
      mediaUrl: '',
      overlay: 'disabled',
      overlayColor: '',
      allowGradientOverlay: false,
    }
  }
  return {
    color: body.backgroundColor ?? '',
    fit: bodyBackgroundFit(body),
    allowGradient: Boolean(body.allowGradientBackground),
    mediaId: body.backgroundMediaId ?? '',
    mediaUrl: body.backgroundImage ?? '',
    overlay: body.backgroundOverlay === 'enabled' ? 'enabled' : 'disabled',
    overlayColor: body.overlayColor ?? '',
    allowGradientOverlay: Boolean(body.allowGradientOverlay),
  }
}

function draftKey(draft: Draft): string {
  return [
    draft.color,
    draft.fit,
    draft.allowGradient ? '1' : '0',
    draft.mediaId,
    draft.mediaUrl,
    draft.overlay,
    draft.overlayColor,
    draft.allowGradientOverlay ? '1' : '0',
  ].join('\u0000')
}

function draftHasPaint(draft: Draft): boolean {
  return Boolean(
    draft.color ||
      draft.mediaId ||
      draft.mediaUrl ||
      draft.overlay === 'enabled' ||
      draft.overlayColor ||
      draft.allowGradient ||
      draft.allowGradientOverlay,
  )
}

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
  const saved = draftFromBody(body)
  const savedKey = draftKey(saved)
  const [draft, setDraft] = useState<Draft>(saved)
  const [syncedKey, setSyncedKey] = useState(savedKey)
  const draftRef = useRef(draft)
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey)
    setDraft(saved)
  }
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const persist = useCallback(
    (next: { mode: 'set' | 'clear' | 'inherit'; draft?: Draft }) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('mode', next.mode)
      if (next.mode === 'clear' && canInherit) fd.set('blockInherit', '1')
      if (next.mode === 'set' && next.draft) {
        const current = next.draft
        fd.set('backgroundColor', current.color)
        fd.set('allowGradientBackground', current.allowGradient ? '1' : '0')
        fd.set('fit', current.fit)
        fd.set('backgroundMediaId', current.mediaId)
        fd.set('backgroundImage', current.mediaUrl)
        fd.set('backgroundOverlay', current.overlay)
        fd.set('overlayColor', current.overlayColor)
        fd.set('allowGradientOverlay', current.allowGradientOverlay ? '1' : '0')
        if (canInherit && !draftHasPaint(current)) fd.set('blockInherit', '1')
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

  const { schedule, flush } = useDebouncedPersist((next: Draft) => {
    if (inherited) return
    persist({ mode: 'set', draft: next })
  })

  const commit = (patch: Partial<Draft>, immediate: boolean) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    if (inherited) return
    if (immediate) flush('body', next)
    else schedule('body', next)
  }

  const hasPaint = Boolean(!inherited && draftHasPaint(draft))

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
            value={{ mediaId: draft.mediaId, url: draft.mediaUrl }}
            defaultFolder="backgrounds"
            defaultPurpose="photo"
            disabled={fieldsDisabled}
            includeHiddenInputs={false}
            hint="Behind the whole page. A section background still covers it on that section."
            onChange={(next) => {
              if (inherited) return
              const url = next.url ?? ''
              const id = next.mediaId ?? ''
              commit({ mediaId: id, mediaUrl: url }, true)
            }}
          />
        </div>

        <label className="settings-field">
          <span>Fit</span>
          <select
            value={draft.fit}
            disabled={fieldsDisabled || (!draft.mediaId && !draft.mediaUrl)}
            onChange={(event) => {
              commit({ fit: event.target.value as LayoutBodyBackgroundFit }, true)
            }}
          >
            {FITS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <PaintField
          label="Background color"
          value={draft.color}
          placeholder="#eef4fa"
          allowGradient={draft.allowGradient}
          disabled={fieldsDisabled}
          onChange={(color, immediate) => commit({ color }, immediate)}
          onAllowGradientChange={(allowGradient) => {
            const color =
              !allowGradient && isGradientValue(draftRef.current.color) ? '' : draftRef.current.color
            commit({ allowGradient, color }, true)
          }}
        />

        <label className="settings-field">
          <span>Background overlay</span>
          <select
            value={draft.overlay}
            disabled={fieldsDisabled}
            onChange={(event) => {
              commit(
                { overlay: event.target.value === 'enabled' ? 'enabled' : 'disabled' },
                true,
              )
            }}
          >
            <option value="disabled">Disabled</option>
            <option value="enabled">Enabled</option>
          </select>
        </label>

        <PaintField
          label="Overlay color"
          value={draft.overlayColor}
          placeholder="#000000"
          allowGradient={draft.allowGradientOverlay}
          disabled={fieldsDisabled || draft.overlay !== 'enabled'}
          onChange={(overlayColor, immediate) => commit({ overlayColor }, immediate)}
          onAllowGradientChange={(allowGradientOverlay) => {
            const overlayColor =
              !allowGradientOverlay && isGradientValue(draftRef.current.overlayColor)
                ? ''
                : draftRef.current.overlayColor
            commit({ allowGradientOverlay, overlayColor }, true)
          }}
        />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {hasPaint ? (
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

function PaintField({
  label,
  value,
  placeholder,
  allowGradient,
  disabled,
  onChange,
  onAllowGradientChange,
}: {
  label: string
  value: string
  placeholder: string
  allowGradient: boolean
  disabled: boolean
  onChange: (next: string, immediate: boolean) => void
  onAllowGradientChange: (next: boolean) => void
}) {
  const gradient = allowGradient && isGradientValue(value)
  return (
    <div className="settings-field section-styles-color-field">
      <span className="section-styles-color-label">{label}</span>
      <span className="gantry-color-field section-styles-color-row">
        {gradient ? null : (
          <input
            type="color"
            className="gantry-color-swatch"
            aria-label={`${label} picker`}
            disabled={disabled}
            value={cssColorToColorInputValue(value)}
            onChange={(event) => onChange(event.target.value, true)}
          />
        )}
        <input
          type="text"
          className="gantry-inline-input"
          aria-label={label}
          disabled={disabled}
          value={value}
          placeholder={allowGradient ? 'linear-gradient(180deg, #1c2834, #8ebad4)' : placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value, false)}
          onBlur={(event) => onChange(event.target.value, true)}
        />
        <label className="section-styles-gradient-inline" title="Allow CSS gradients">
          <input
            type="checkbox"
            checked={allowGradient}
            disabled={disabled}
            onChange={(event) => onAllowGradientChange(event.target.checked)}
            aria-label={`Allow gradient for ${label}`}
          />
          <span>Allow gradient</span>
        </label>
      </span>
      {allowGradient ? (
        <p className="settings-hint section-styles-gradient-hint">{GRADIENT_HINT}</p>
      ) : null}
    </div>
  )
}
