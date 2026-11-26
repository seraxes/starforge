'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  copyLayoutTypographyFromParentAction,
  updateLayoutTypographyAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  LAYOUT_FONT_CHOICES,
  cssColorToColorInputValue,
  layoutFontStack,
  type LayoutTypography,
} from '@/core/modules/styles'

import { useAdminToast } from '../admin-toast'
import { InheritCopyRow } from '../layouts/layout-inherit-controls'
import { useLayoutOutlineId } from '../layouts/layout-outline-context'
import { useDebouncedPersist } from '../use-debounced-persist'

type Props = {
  typography?: LayoutTypography
  /** Child outline is using the parent type block (no local block). */
  inherited: boolean
  /** Non-base outline with a parent — show Inherit / Copy. */
  canInherit: boolean
}

type Draft = {
  titleFont: string
  textFont: string
  titleColor: string
  textColor: string
  linkColor: string
  linkHoverColor: string
}

const EMPTY_DRAFT: Draft = {
  titleFont: '',
  textFont: '',
  titleColor: '',
  textColor: '',
  linkColor: '',
  linkHoverColor: '',
}

function draftFromTypography(typography: LayoutTypography | undefined): Draft {
  if (!typography || typography.disabled) return EMPTY_DRAFT
  return {
    titleFont: typography.titleFont ?? '',
    textFont: typography.textFont ?? '',
    titleColor: typography.titleColor ?? '',
    textColor: typography.textColor ?? '',
    linkColor: typography.linkColor ?? '',
    linkHoverColor: typography.linkHoverColor ?? '',
  }
}

function draftIsEmpty(draft: Draft): boolean {
  return (
    !draft.titleFont &&
    !draft.textFont &&
    !draft.titleColor &&
    !draft.textColor &&
    !draft.linkColor &&
    !draft.linkHoverColor
  )
}

/**
 * Layouts → Styles → Type & accent.
 * Autosaves onto the outline document (`styles.typography`).
 */
export function TypographyPanel({ typography, inherited, canInherit }: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fieldsDisabled = inherited || pending
  const saved = draftFromTypography(typography)
  const savedKey = [
    saved.titleFont,
    saved.textFont,
    saved.titleColor,
    saved.textColor,
    saved.linkColor,
    saved.linkHoverColor,
  ].join('\u0000')
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
        fd.set('titleFont', next.draft.titleFont)
        fd.set('textFont', next.draft.textFont)
        fd.set('titleColor', next.draft.titleColor)
        fd.set('textColor', next.draft.textColor)
        fd.set('linkColor', next.draft.linkColor)
        fd.set('linkHoverColor', next.draft.linkHoverColor)
        if (canInherit && draftIsEmpty(next.draft)) fd.set('blockInherit', '1')
      }
      startSave(async () => {
        const result: LayoutActionState = await updateLayoutTypographyAction({}, fd)
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
    if (immediate) flush('typography', next)
    else schedule('typography', next)
  }

  const titleStack = layoutFontStack(draft.titleFont)
  const textStack = layoutFontStack(draft.textFont)
  const hasPaint = Boolean(!inherited && !draftIsEmpty(draft))

  return (
    <details className={inherited ? 'section-styles-card sf-inherited-muted' : 'section-styles-card'} open>
      <summary className="section-styles-card-summary">
        <span className="section-styles-card-summary-main">
          <span className="section-styles-card-title">Type &amp; accent</span>
          <code className="section-styles-card-id">type</code>
          {inherited ? (
            <span className="gantry-inherit-badge" title="Type inherited from parent outline">
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
                const result = await copyLayoutTypographyFromParentAction({}, fd)
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
                const result = await copyLayoutTypographyFromParentAction({}, fd)
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
        <div className="section-styles-type-sample" aria-hidden="true">
          <span
            className="section-styles-type-sample-title"
            style={{
              fontFamily: titleStack || "'Segoe UI', 'Helvetica Neue', sans-serif",
              color: draft.titleColor || '#1c2834',
            }}
          >
            Title
          </span>
          <span
            className="section-styles-type-sample-text"
            style={{
              fontFamily: textStack || "'Segoe UI', 'Helvetica Neue', sans-serif",
              color: draft.textColor || '#1c2834',
            }}
          >
            Body text{' '}
            <span style={{ color: draft.linkColor || '#a85220' }}>link</span>
            <span style={{ color: draft.linkHoverColor || '#f2a66a' }}> hover</span>
          </span>
        </div>

        <FontField
          label="Title font"
          value={draft.titleFont}
          disabled={fieldsDisabled}
          onChange={(titleFont) => commit({ titleFont }, true)}
        />
        <ColorField
          label="Title color"
          value={draft.titleColor}
          placeholder="#1c2834"
          disabled={fieldsDisabled}
          onChange={(titleColor, immediate) => commit({ titleColor }, immediate)}
        />
        <FontField
          label="Text font"
          value={draft.textFont}
          disabled={fieldsDisabled}
          onChange={(textFont) => commit({ textFont }, true)}
        />
        <ColorField
          label="Text color"
          value={draft.textColor}
          placeholder="#1c2834"
          disabled={fieldsDisabled}
          onChange={(textColor, immediate) => commit({ textColor }, immediate)}
        />
        <ColorField
          label="Accent / links"
          value={draft.linkColor}
          placeholder="#a85220"
          disabled={fieldsDisabled}
          onChange={(linkColor, immediate) => commit({ linkColor }, immediate)}
        />
        <ColorField
          label="Accent hover"
          value={draft.linkHoverColor}
          placeholder="#f2a66a"
          disabled={fieldsDisabled}
          onChange={(linkHoverColor, immediate) => commit({ linkHoverColor }, immediate)}
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

function FontField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (next: string) => void
}) {
  const stack = layoutFontStack(value)
  return (
    <label className="settings-field">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        style={stack ? { fontFamily: stack } : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Site default</option>
        {LAYOUT_FONT_CHOICES.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
            {font.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColorField({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  disabled: boolean
  onChange: (next: string, immediate: boolean) => void
}) {
  return (
    <div className="settings-field section-styles-color-field">
      <span className="section-styles-color-label">{label}</span>
      <span className="gantry-color-field section-styles-color-row">
        <input
          type="color"
          className="gantry-color-swatch"
          aria-label={`${label} picker`}
          disabled={disabled}
          value={cssColorToColorInputValue(value)}
          onChange={(event) => onChange(event.target.value, true)}
        />
        <input
          type="text"
          className="gantry-inline-input"
          aria-label={label}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value, false)}
          onBlur={(event) => onChange(event.target.value, true)}
        />
      </span>
    </div>
  )
}
