'use client'

import React, { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateLayoutSectionMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  cssColorToColorInputValue,
  type LayoutSectionStyles,
} from '@/core/modules/styles'

import { useLayoutOutlineId } from '../layouts/layout-outline-context'

export type SectionStylesListItem = {
  id: string
  label: string
  styles?: LayoutSectionStyles
}

type Props = {
  sections: SectionStylesListItem[]
}

type StylePatch = {
  backgroundColor?: string
  textColor?: string
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
  onPersistColor,
  disabled,
}: {
  label: string
  fieldKey: 'backgroundColor' | 'textColor' | 'overlayColor'
  value: string | undefined
  placeholder: string
  allowGradient?: boolean
  onAllowGradientChange?: (next: boolean) => void
  onPersistColor: (next: string) => void
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
              onPersistColor(hex)
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
          onBlur={(event) => onPersistColor(event.target.value)}
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
 * Per-section Styles card — same persist UX as Layout canvas section Settings:
 * color/select/checkbox save on change; text fields save on blur (Enter blurs).
 */
function SectionStylesCard({
  section,
  forceOpen,
}: {
  section: SectionStylesListItem
  forceOpen: boolean | null
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const styles = section.styles
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
        if (result.ok) router.refresh()
      })
    },
    [layoutId, router, section.id, section.styles],
  )

  const openProps =
    forceOpen === null ? { open: true as const } : forceOpen ? { open: true as const } : {}

  return (
    <details className="section-styles-card" {...openProps}>
      <summary className="section-styles-card-summary">
        <span className="section-styles-card-title">{section.label} Styles</span>
        <code className="section-styles-card-id">{section.id}</code>
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
          onPersistColor={(next) => persistStyles({ backgroundColor: next })}
          disabled={metaPending}
        />

        <ColorField
          label="Text"
          fieldKey="textColor"
          value={styles?.textColor}
          placeholder="#ffffff"
          onPersistColor={(next) => persistStyles({ textColor: next })}
          disabled={metaPending}
        />

        <label className="settings-field">
          <span>Background image</span>
          <input
            type="url"
            key={`bg-image-${section.id}-${styles?.backgroundImage ?? ''}`}
            className="gantry-inline-input"
            defaultValue={styles?.backgroundImage ?? ''}
            placeholder="/media/hero.jpg or https://…"
            spellCheck={false}
            autoComplete="off"
            disabled={metaPending}
            onBlur={(event) => persistStyles({ backgroundImage: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                ;(event.target as HTMLInputElement).blur()
              }
            }}
          />
          <small className="field-hint">http(s), root-relative, or data:image URL</small>
        </label>

        <label className="settings-field">
          <span>Background overlay</span>
          <select
            key={`overlay-${section.id}-${styles?.backgroundOverlay ?? 'disabled'}`}
            defaultValue={styles?.backgroundOverlay ?? 'disabled'}
            disabled={metaPending}
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
          onPersistColor={(next) => persistStyles({ overlayColor: next })}
          disabled={metaPending || !overlayEnabled}
        />

        <ActionFeedback state={metaFlash} />
        {metaPending ? <p className="field-hint">Saving…</p> : null}
      </div>
    </details>
  )
}

/**
 * Layouts → Styles: one panel per live outline section.
 * Deleting a section on the Layout canvas removes its Styles entry with it.
 */
export function SectionStylesPanel({ sections }: Props) {
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
