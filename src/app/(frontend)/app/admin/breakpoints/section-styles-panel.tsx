'use client'

import React, { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateLayoutSectionMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  cssColorToColorInputValue,
  type LayoutSectionStyles,
} from '@/core/modules/styles'

import { LayoutIdField } from '../layouts/layout-outline-context'

const initialState: LayoutActionState = {}

export type SectionStylesListItem = {
  id: string
  label: string
  styles?: LayoutSectionStyles
}

type Props = {
  sections: SectionStylesListItem[]
}

function ColorField({
  label,
  name,
  value,
  placeholder,
  allowGradient,
  disabled,
}: {
  label: string
  name: string
  value: string | undefined
  placeholder: string
  allowGradient?: boolean
  disabled?: boolean
}) {
  const isGradient = Boolean(value && /gradient\(/i.test(value))
  const swatchValue = isGradient ? '#ffffff' : cssColorToColorInputValue(value)

  return (
    <label className="settings-field section-styles-color-field">
      <span>{label}</span>
      <span className="gantry-color-field section-styles-color-row">
        {!allowGradient || !isGradient ? (
          <input
            type="color"
            className="gantry-color-swatch"
            defaultValue={swatchValue}
            disabled={disabled}
            aria-label={`${label} picker`}
            onChange={(event) => {
              const text = event.currentTarget
                .closest('.section-styles-color-row')
                ?.querySelector<HTMLInputElement>(`input[name="${name}"]`)
              if (text) text.value = event.target.value
            }}
          />
        ) : null}
        <input
          type="text"
          name={name}
          className="gantry-inline-input"
          defaultValue={value ?? ''}
          placeholder={
            allowGradient ? `${placeholder} or linear-gradient(…)` : placeholder
          }
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-label={label}
        />
      </span>
    </label>
  )
}

function SectionStylesCard({
  section,
  forceOpen,
}: {
  section: SectionStylesListItem
  forceOpen: boolean | null
}) {
  const router = useRouter()
  const styles = section.styles
  const [allowGradientBackground, setAllowGradientBackground] = useState(
    Boolean(styles?.allowGradientBackground),
  )
  const [allowGradientOverlay, setAllowGradientOverlay] = useState(
    Boolean(styles?.allowGradientOverlay),
  )
  const [overlayEnabled, setOverlayEnabled] = useState(
    styles?.backgroundOverlay === 'enabled',
  )

  const [state, action, pending] = useActionState(
    async (prev: LayoutActionState, formData: FormData) => {
      const result = await updateLayoutSectionMetaAction(prev, formData)
      if (result.ok) router.refresh()
      return result
    },
    initialState,
  )

  const openProps =
    forceOpen === null ? { open: true as const } : forceOpen ? { open: true as const } : {}

  return (
    <details className="section-styles-card" {...openProps}>
      <summary className="section-styles-card-summary">
        <span className="section-styles-card-title">{section.label} Styles</span>
        <code className="section-styles-card-id">{section.id}</code>
      </summary>

      <form action={action} className="settings-form section-styles-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={section.id} />

        <ColorField
          label="Background"
          name="backgroundColor"
          value={styles?.backgroundColor}
          placeholder="#18191c"
          allowGradient={allowGradientBackground}
          disabled={pending}
        />

        <ColorField
          label="Text"
          name="textColor"
          value={styles?.textColor}
          placeholder="#ffffff"
          disabled={pending}
        />

        <label className="settings-field">
          <span>Background image</span>
          <input
            type="url"
            name="backgroundImage"
            defaultValue={styles?.backgroundImage ?? ''}
            placeholder="/media/hero.jpg or https://…"
            spellCheck={false}
            autoComplete="off"
            disabled={pending}
          />
          <small className="field-hint">http(s), root-relative, or data:image URL</small>
        </label>

        <label className="settings-field">
          <span>Background overlay</span>
          <select
            name="backgroundOverlay"
            defaultValue={styles?.backgroundOverlay ?? 'disabled'}
            disabled={pending}
            onChange={(event) => setOverlayEnabled(event.target.value === 'enabled')}
          >
            <option value="disabled">Disabled</option>
            <option value="enabled">Enabled</option>
          </select>
        </label>

        <ColorField
          label="Overlay color"
          name="overlayColor"
          value={styles?.overlayColor}
          placeholder="#000000"
          allowGradient={allowGradientOverlay}
          disabled={pending || !overlayEnabled}
        />

        <label className="settings-field section-styles-check">
          <span>Allow gradient backgrounds</span>
          <input type="hidden" name="allowGradientBackground" value="0" />
          <input
            type="checkbox"
            name="allowGradientBackground"
            value="1"
            defaultChecked={allowGradientBackground}
            disabled={pending}
            onChange={(event) => setAllowGradientBackground(event.target.checked)}
          />
        </label>

        <label className="settings-field section-styles-check">
          <span>Allow gradient overlays</span>
          <input type="hidden" name="allowGradientOverlay" value="0" />
          <input
            type="checkbox"
            name="allowGradientOverlay"
            value="1"
            defaultChecked={allowGradientOverlay}
            disabled={pending}
            onChange={(event) => setAllowGradientOverlay(event.target.checked)}
          />
        </label>

        {state.error ? <p className="form-error">{state.error}</p> : null}
        {state.ok && state.message ? <p className="form-ok">{state.message}</p> : null}

        <div className="page-settings-actions">
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save section styles'}
          </button>
        </div>
      </form>
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
