'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateLayoutRowContainerMetaAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import { sharedContainerMode } from '@/core/modules/row-container'
import { cssColorToColorInputValue } from '@/core/modules/styles'
import type { LayoutContainerMode } from '@/core/modules/styles'
import type { LayoutRowContainer } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { useLayoutOutlineId } from './layout-outline-context'
import { SectionBoxSpacingFields } from './section-box-spacing-fields'

type Member = { containerMode?: LayoutContainerMode }

function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  return null
}

/**
 * Header for an automatic row container. Basic section settings live here.
 * Member sections keep width % and hide their own Container field.
 */
export function RowContainerFrame({
  sectionIds,
  container,
  sections,
}: {
  sectionIds: string[]
  container?: LayoutRowContainer
  sections: Member[]
}) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const [pending, startSave] = useTransition()
  const [flash, setFlash] = useState<LayoutActionState>({})
  const { notifySaved, notifyError } = useAdminToast()
  const label = container?.label?.trim() || 'Container'
  const containerMode = container
    ? (container.containerMode ?? '')
    : (sharedContainerMode(sections) ?? '')
  const keyBase = `${container?.id ?? sectionIds.join('-')}-${containerMode}`

  const persist = useCallback(
    (fields: {
      label?: string
      htmlId?: string
      cssClass?: string
      containerMode?: 'full' | 'boxed'
      backgroundColor?: string
      textColor?: string
      padding?: string
      margin?: string
    }) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('sectionIdsJson', JSON.stringify(sectionIds))
      if (container?.id) fd.set('containerId', container.id)
      let changed = false
      if (fields.label !== undefined) {
        const next = fields.label.trim()
        if (!next || next === label) return
        fd.set('label', next)
        changed = true
      }
      if (fields.htmlId !== undefined && fields.htmlId.trim() !== (container?.htmlId ?? '').trim()) {
        fd.set('htmlId', fields.htmlId.trim())
        changed = true
      }
      if (fields.cssClass !== undefined && fields.cssClass.trim() !== (container?.cssClass ?? '').trim()) {
        fd.set('cssClass', fields.cssClass.trim())
        changed = true
      }
      if (fields.containerMode !== undefined && fields.containerMode !== (container?.containerMode ?? containerMode)) {
        fd.set('containerMode', fields.containerMode)
        changed = true
      }
      if (
        fields.backgroundColor !== undefined &&
        fields.backgroundColor.trim() !== (container?.styles?.backgroundColor ?? '').trim()
      ) {
        fd.set('backgroundColor', fields.backgroundColor.trim())
        changed = true
      }
      if (
        fields.textColor !== undefined &&
        fields.textColor.trim() !== (container?.styles?.textColor ?? '').trim()
      ) {
        fd.set('textColor', fields.textColor.trim())
        changed = true
      }
      if (fields.padding !== undefined && fields.padding.trim() !== (container?.styles?.padding ?? '').trim()) {
        fd.set('padding', fields.padding.trim())
        changed = true
      }
      if (fields.margin !== undefined && fields.margin.trim() !== (container?.styles?.margin ?? '').trim()) {
        fd.set('margin', fields.margin.trim())
        changed = true
      }
      if (!changed) return
      startSave(async () => {
        const result = await updateLayoutRowContainerMetaAction({}, fd)
        setFlash(result)
        if (result.ok) notifySaved('Saved')
        else if (result.error) notifyError(result.error)
        router.refresh()
      })
    },
    [container, containerMode, label, layoutId, notifyError, notifySaved, router, sectionIds],
  )

  return (
    <div className="gantry-row-container-chrome">
      <header className="gantry-section-head">
        <div className="gantry-section-title">
          <div className="gantry-section-identity">
            <label className="gantry-inline-label gantry-section-name-label">
              <span className="sr-only">Row container name</span>
              <input
                key={`row-container-label-${keyBase}-${label}`}
                type="text"
                className="gantry-inline-input gantry-section-name-input"
                defaultValue={label}
                disabled={pending}
                required
                title={label}
                aria-label="Row container name"
                onBlur={(event) => persist({ label: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    ;(event.target as HTMLInputElement).blur()
                  }
                }}
              />
            </label>
          </div>
        </div>
        <div className="gantry-section-head-actions">
          <details className="gantry-section-settings">
            <summary
              className="gantry-section-icon-btn"
              title="Row container settings"
              aria-label="Row container settings"
            >
              ⚙
            </summary>
            <div className="gantry-section-toolbar">
              <label className="gantry-inline-label gantry-section-container-label">
                <span className="gantry-field-hint">Container</span>
                <select
                  key={`row-container-mode-${keyBase}`}
                  className="gantry-inline-input gantry-section-container-select"
                  defaultValue={containerMode}
                  disabled={pending}
                  title="Container width for this whole row. Sections inside use their width % only."
                  aria-label="Row container width"
                  onChange={(event) => {
                    const raw = event.target.value
                    const next = raw === 'boxed' ? 'boxed' : raw === 'full' ? 'full' : undefined
                    if (!next) return
                    persist({ containerMode: next })
                  }}
                >
                  <option value="" disabled>
                    {containerMode ? '—' : 'Page default'}
                  </option>
                  <option value="full">Full width</option>
                  <option value="boxed">Boxed width</option>
                </select>
              </label>
              <div className="gantry-section-styles" role="group" aria-label="Row container styles">
                <label className="gantry-inline-label gantry-section-color-label">
                  <span className="gantry-field-hint">Background</span>
                  <span className="gantry-color-field">
                    <input
                      key={`row-bg-swatch-${keyBase}-${container?.styles?.backgroundColor ?? ''}`}
                      type="color"
                      className="gantry-color-swatch"
                      value={cssColorToColorInputValue(container?.styles?.backgroundColor)}
                      disabled={pending}
                      title="Row container background color"
                      aria-label="Row container background color picker"
                      onChange={(event) => persist({ backgroundColor: event.target.value })}
                    />
                    <input
                      key={`row-bg-hex-${keyBase}-${container?.styles?.backgroundColor ?? ''}`}
                      type="text"
                      className="gantry-inline-input gantry-section-color-input"
                      defaultValue={container?.styles?.backgroundColor ?? ''}
                      disabled={pending}
                      placeholder="#18191c"
                      spellCheck={false}
                      autoComplete="off"
                      title="Hex background (empty = inherit)"
                      aria-label="Row container background hex"
                      onBlur={(event) => persist({ backgroundColor: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          ;(event.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  </span>
                </label>
                <label className="gantry-inline-label gantry-section-color-label">
                  <span className="gantry-field-hint">Text</span>
                  <span className="gantry-color-field">
                    <input
                      key={`row-text-swatch-${keyBase}-${container?.styles?.textColor ?? ''}`}
                      type="color"
                      className="gantry-color-swatch"
                      value={cssColorToColorInputValue(container?.styles?.textColor)}
                      disabled={pending}
                      title="Row container text color"
                      aria-label="Row container text color picker"
                      onChange={(event) => persist({ textColor: event.target.value })}
                    />
                    <input
                      key={`row-text-hex-${keyBase}-${container?.styles?.textColor ?? ''}`}
                      type="text"
                      className="gantry-inline-input gantry-section-color-input"
                      defaultValue={container?.styles?.textColor ?? ''}
                      disabled={pending}
                      placeholder="#ffffff"
                      spellCheck={false}
                      autoComplete="off"
                      title="Hex text color (empty = inherit)"
                      aria-label="Row container text hex"
                      onBlur={(event) => persist({ textColor: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          ;(event.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  </span>
                </label>
              </div>
              <div className="gantry-section-box-spacing-group" role="group" aria-label="Row container spacing">
                <SectionBoxSpacingFields
                  key={`row-padding-${keyBase}-${container?.styles?.padding ?? ''}`}
                  fieldKey="padding"
                  label="Padding"
                  value={container?.styles?.padding}
                  disabled={pending}
                  onCommit={(css) => persist({ padding: css })}
                />
                <SectionBoxSpacingFields
                  key={`row-margin-${keyBase}-${container?.styles?.margin ?? ''}`}
                  fieldKey="margin"
                  label="Margin"
                  value={container?.styles?.margin}
                  allowNegative
                  disabled={pending}
                  onCommit={(css) => persist({ margin: css })}
                />
              </div>
              <label className="gantry-inline-label gantry-section-id-label">
                <span className="gantry-field-hint">HTML id</span>
                <input
                  key={`row-htmlid-${keyBase}-${container?.htmlId ?? ''}`}
                  type="text"
                  className="gantry-inline-input gantry-section-id-input"
                  defaultValue={container?.htmlId ?? ''}
                  disabled={pending}
                  placeholder="e.g. g-columns"
                  spellCheck={false}
                  autoComplete="off"
                  title="Public HTML id on the row container"
                  aria-label="Row container HTML id"
                  onBlur={(event) => persist({ htmlId: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      ;(event.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </label>
              <label className="gantry-inline-label gantry-section-class-label">
                <span className="gantry-field-hint">CSS classes</span>
                <input
                  key={`row-class-${keyBase}-${container?.cssClass ?? ''}`}
                  type="text"
                  className="gantry-inline-input gantry-section-class-input"
                  defaultValue={container?.cssClass ?? ''}
                  disabled={pending}
                  placeholder="e.g. dark-band"
                  title="Space-separated CSS classes on the row container"
                  aria-label="Row container CSS classes"
                  onBlur={(event) => persist({ cssClass: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      ;(event.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </label>
            </div>
          </details>
        </div>
      </header>
      <ActionFeedback state={flash} />
    </div>
  )
}
