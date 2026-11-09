'use client'

import React, { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  copySectionStylesFromParentAction,
  setSectionStylesInheritModeAction,
  updateLayoutSectionMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  cssColorToColorInputValue,
  type LayoutSectionStyles,
} from '@/core/modules/styles'
import { MediaPicker } from '@/modules/media/api'

import { useAdminToast } from '../admin-toast'
import { InheritCopyRow } from '../layouts/layout-inherit-controls'
import { useDebouncedPersist } from '../use-debounced-persist'
import { useLayoutOutlineId } from '../layouts/layout-outline-context'

export type SectionStylesListItem = {
  id: string
  label: string
  /** Resolved styles for display / local edit values. */
  styles?: LayoutSectionStyles
  /** True when this outline inherits styles from parent for this section card. */
  stylesInherited?: boolean
}

type Props = {
  sections: SectionStylesListItem[]
  /** Outline has inheritFrom — show per-card inherit control. */
  canInherit?: boolean
  parentLayoutId?: string | null
}

type StylePatch = {
  backgroundColor?: string
  textColor?: string
  backgroundMediaId?: string
  backgroundImage?: string
  backgroundOverlay?: 'enabled' | 'disabled'
  overlayColor?: string
  allowGradientBackground?: boolean
  allowGradientOverlay?: boolean
}

function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="form-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="form-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function ColorField({
  label,
  fieldKey,
  value,
  placeholder,
  allowGradient,
  onAllowGradientChange,
  onColorChange,
  onColorBlur,
  disabled,
}: {
  label: string
  fieldKey: 'backgroundColor' | 'textColor' | 'overlayColor'
  value: string | undefined
  placeholder: string
  allowGradient?: boolean
  onAllowGradientChange?: (next: boolean) => void
  /** Debounced path (typing / color drag). */
  onColorChange: (next: string) => void
  /** Immediate flush (blur / Enter). */
  onColorBlur: (next: string) => void
  disabled?: boolean
}) {
  const isGradient = Boolean(value && /gradient\(/i.test(value))
  const swatchValue = isGradient ? '#ffffff' : cssColorToColorInputValue(value)
  const showGradientToggle = fieldKey === 'backgroundColor' || fieldKey === 'overlayColor'

  return (
    <div className="settings-field section-styles-color-field">
      <span className="section-styles-color-label">{label}</span>
      <span className="gantry-color-field section-styles-color-row">
        {!allowGradient || !isGradient ? (
          <input
            type="color"
            className="gantry-color-swatch"
            key={`swatch-${fieldKey}-${value ?? ''}`}
            defaultValue={swatchValue}
            disabled={disabled}
            aria-label={`${label} picker`}
            onChange={(event) => {
              const hex = event.target.value
              const text = event.currentTarget
                .closest('.section-styles-color-row')
                ?.querySelector<HTMLInputElement>(`input[data-style-field="${fieldKey}"]`)
              if (text) text.value = hex
              onColorChange(hex)
            }}
            onBlur={(event) => {
              const text = event.currentTarget
                .closest('.section-styles-color-row')
                ?.querySelector<HTMLInputElement>(`input[data-style-field="${fieldKey}"]`)
              onColorBlur(text?.value ?? event.target.value)
            }}
          />
        ) : null}
        <input
          type="text"
          data-style-field={fieldKey}
          className="gantry-inline-input"
          key={`text-${fieldKey}-${value ?? ''}`}
          defaultValue={value ?? ''}
          placeholder={
            allowGradient ? `${placeholder} or linear-gradient(…)` : placeholder
          }
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onColorChange(event.target.value)}
          onBlur={(event) => onColorBlur(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
        />
        {showGradientToggle ? (
          <label className="section-styles-gradient-inline" title="Allow CSS gradients">
            <input
              type="checkbox"
              checked={Boolean(allowGradient)}
              disabled={disabled}
              onChange={(event) => onAllowGradientChange?.(event.target.checked)}
              aria-label={`Allow gradient for ${label}`}
            />
            <span>Allow gradient</span>
          </label>
        ) : null}
      </span>
    </div>
  )
}

/**
 * Per-section Styles card — no Save button.
 * Text/color/URL: Site Settings debounce onChange + flush on blur.
 * Select/checkbox: immediate onChange (discrete).
 * Card-level inherit when outline has inheritFrom.
 */
function SectionStylesCard({
  section,
  forceOpen,
  canInherit,
  parentLayoutId,
}: {
  section: SectionStylesListItem
  forceOpen: boolean | null
  canInherit: boolean
  parentLayoutId?: string | null
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const stylesInherited = Boolean(canInherit && section.stylesInherited)
  const styles = section.styles
  const fieldsDisabled = stylesInherited
  const [metaPending, startMetaSave] = useTransition()
  const [metaFlash, setMetaFlash] = useState<LayoutActionState>({})
  const [allowGradientBackground, setAllowGradientBackground] = useState(
    Boolean(styles?.allowGradientBackground),
  )
  const [allowGradientOverlay, setAllowGradientOverlay] = useState(
    Boolean(styles?.allowGradientOverlay),
  )
  const [overlayEnabled, setOverlayEnabled] = useState(
    styles?.backgroundOverlay === 'enabled',
  )

  const persistStyles = useCallback(
    (patch: StylePatch) => {
      if (stylesInherited) return
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('sectionId', section.id)

      let changed = false
      const prev = section.styles

      if (patch.backgroundColor !== undefined) {
        const next = patch.backgroundColor.trim()
        if (next !== (prev?.backgroundColor ?? '').trim()) {
          fd.set('backgroundColor', next)
          changed = true
        }
      }
      if (patch.textColor !== undefined) {
        const next = patch.textColor.trim()
        if (next !== (prev?.textColor ?? '').trim()) {
          fd.set('textColor', next)
          changed = true
        }
      }
      if (patch.backgroundMediaId !== undefined) {
        const next = patch.backgroundMediaId.trim()
        if (next !== (prev?.backgroundMediaId ?? '').trim()) {
          fd.set('backgroundMediaId', next)
          changed = true
        }
      }
      if (patch.backgroundImage !== undefined) {
        const next = patch.backgroundImage.trim()
        if (next !== (prev?.backgroundImage ?? '').trim()) {
          fd.set('backgroundImage', next)
          changed = true
        }
      }
      if (patch.backgroundOverlay !== undefined) {
        const next = patch.backgroundOverlay
        if (next !== (prev?.backgroundOverlay ?? 'disabled')) {
          fd.set('backgroundOverlay', next)
          changed = true
        }
      }
      if (patch.overlayColor !== undefined) {
        const next = patch.overlayColor.trim()
        if (next !== (prev?.overlayColor ?? '').trim()) {
          fd.set('overlayColor', next)
          changed = true
        }
      }
      if (patch.allowGradientBackground !== undefined) {
        const next = patch.allowGradientBackground
        if (next !== Boolean(prev?.allowGradientBackground)) {
          fd.set('allowGradientBackground', next ? '1' : '0')
          changed = true
        }
      }
      if (patch.allowGradientOverlay !== undefined) {
        const next = patch.allowGradientOverlay
        if (next !== Boolean(prev?.allowGradientOverlay)) {
          fd.set('allowGradientOverlay', next ? '1' : '0')
          changed = true
        }
      }

      if (!changed) return

      startMetaSave(async () => {
        const result = await updateLayoutSectionMetaAction({}, fd)
        setMetaFlash(result)
        if (result.ok) {
          notifySaved('Saved')
          router.refresh()
        } else if (result.error) {
          notifyError(result.error)
        }
      })
    },
    [
      layoutId,
      notifyError,
      notifySaved,
      router,
      section.id,
      section.styles,
      stylesInherited,
    ],
  )

  const { schedule, flush } = useDebouncedPersist(persistStyles)

  const openProps =
    forceOpen === null ? { open: true as const } : forceOpen ? { open: true as const } : {}

  return (
    <details
      className={stylesInherited ? 'section-styles-card sf-inherited-muted' : 'section-styles-card'}
      {...openProps}
    >
      <summary className="section-styles-card-summary">
        <span className="section-styles-card-summary-main">
          <span className="section-styles-card-title">{section.label} Styles</span>
          <code className="section-styles-card-id">{section.id}</code>
          {stylesInherited ? (
            <span className="gantry-inherit-badge" title="Styles inherited from parent outline">
              Inherited
            </span>
          ) : null}
        </span>
        {canInherit ? (
          <InheritCopyRow
            inline
            inherited={stylesInherited}
            disabled={metaPending}
            copyLabel="Copy"
            onInheritChange={(next) => {
              const fd = new FormData()
              fd.set('layoutId', layoutId)
              fd.set('sectionId', section.id)
              fd.set('stylesInheritMode', next ? 'inherit' : 'local')
              startMetaSave(async () => {
                const result = await setSectionStylesInheritModeAction({}, fd)
                setMetaFlash(result)
                if (result.ok) notifySaved('Saved')
                else if (result.error) notifyError(result.error)
                router.refresh()
              })
            }}
            onCopy={() => {
              const fd = new FormData()
              fd.set('layoutId', layoutId)
              fd.set('sectionId', section.id)
              startMetaSave(async () => {
                const result = await copySectionStylesFromParentAction({}, fd)
                setMetaFlash(result)
                if (result.ok) notifySaved('Copied')
                else if (result.error) notifyError(result.error)
                router.refresh()
              })
            }}
          />
        ) : null}
      </summary>

      <div className="settings-form section-styles-form">
        <ColorField
          label="Background"
          fieldKey="backgroundColor"
          value={styles?.backgroundColor}
          placeholder="#18191c"
          allowGradient={allowGradientBackground}
          onAllowGradientChange={(next) => {
            setAllowGradientBackground(next)
            persistStyles({ allowGradientBackground: next })
          }}
          onColorChange={(next) => schedule('backgroundColor', { backgroundColor: next })}
          onColorBlur={(next) => flush('backgroundColor', { backgroundColor: next })}
          disabled={metaPending || fieldsDisabled}
        />

        <ColorField
          label="Text"
          fieldKey="textColor"
          value={styles?.textColor}
          placeholder="#ffffff"
          onColorChange={(next) => schedule('textColor', { textColor: next })}
          onColorBlur={(next) => flush('textColor', { textColor: next })}
          disabled={metaPending || fieldsDisabled}
        />

        <div className="settings-field">
          <MediaPicker
            label="Background image"
            value={{
              mediaId: styles?.backgroundMediaId ?? '',
              url: styles?.backgroundImage ?? '',
            }}
            defaultFolder="backgrounds"
            defaultPurpose="photo"
            disabled={metaPending || fieldsDisabled}
            includeHiddenInputs={false}
            hint="Library Media id is primary; URL is advanced fallback."
            onChange={(next) => {
              flush('backgroundMedia', {
                backgroundMediaId: next.mediaId,
                backgroundImage: next.url ?? '',
              })
            }}
          />
        </div>

        <label className="settings-field">
          <span>Background overlay</span>
          <select
            key={`overlay-${section.id}-${styles?.backgroundOverlay ?? 'disabled'}`}
            defaultValue={styles?.backgroundOverlay ?? 'disabled'}
            disabled={metaPending || fieldsDisabled}
            onChange={(event) => {
              const next = event.target.value === 'enabled' ? 'enabled' : 'disabled'
              setOverlayEnabled(next === 'enabled')
              persistStyles({ backgroundOverlay: next })
            }}
          >
            <option value="disabled">Disabled</option>
            <option value="enabled">Enabled</option>
          </select>
        </label>

        <ColorField
          label="Overlay color"
          fieldKey="overlayColor"
          value={styles?.overlayColor}
          placeholder="#000000"
          allowGradient={allowGradientOverlay}
          onAllowGradientChange={(next) => {
            setAllowGradientOverlay(next)
            persistStyles({ allowGradientOverlay: next })
          }}
          onColorChange={(next) => schedule('overlayColor', { overlayColor: next })}
          onColorBlur={(next) => flush('overlayColor', { overlayColor: next })}
          disabled={metaPending || fieldsDisabled || !overlayEnabled}
        />

        <ActionFeedback state={metaFlash} />
        {metaPending ? <p className="field-hint">Saving…</p> : null}
      </div>
    </details>
  )
}

/**
 * Layouts → Styles: one panel per live outline section (resolved list).
 * Deleting a section on the Layout canvas removes its Styles entry with it.
 */
export function SectionStylesPanel({
  sections,
  canInherit = false,
  parentLayoutId = null,
}: Props) {
  const [filter, setFilter] = useState('')
  const [expandToken, setExpandToken] = useState(0)
  const [forceOpen, setForceOpen] = useState<boolean | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return sections
    return sections.filter(
      (s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    )
  }, [filter, sections])

  return (
    <div className="section-styles-panel">
      <div className="section-styles-toolbar">
        <label className="section-styles-filter">
          <span className="sr-only">Filter sections</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter sections…"
            autoComplete="off"
          />
        </label>
        <div className="section-styles-toolbar-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForceOpen(true)
              setExpandToken((n) => n + 1)
            }}
          >
            Expand all
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForceOpen(false)
              setExpandToken((n) => n + 1)
            }}
          >
            Collapse all
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="section-styles-empty">
          {sections.length === 0
            ? 'No sections on this outline yet — add sections on the Layout canvas.'
            : 'No sections match this filter.'}
        </p>
      ) : (
        <div className="section-styles-grid">
          {filtered.map((section) => (
            <SectionStylesCard
              key={`${section.id}-${expandToken}`}
              section={section}
              forceOpen={forceOpen}
              canInherit={canInherit}
              parentLayoutId={parentLayoutId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
