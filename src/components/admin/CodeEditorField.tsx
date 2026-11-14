'use client'

import React, { useId, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'

import {
  SETTINGS_PANEL_MIN_WIDTH,
  SF_SETTINGS_PANEL_SET_SIZE,
} from './useFloatingSettingsPanel'
import { starforgeAdminCmTheme } from './starforge-admin-cm-theme'

export type CodeEditorLanguage = 'html' | 'css' | 'javascript' | 'json'

type Props = {
  /** Form field name (submitted via hidden input). Omit when the parent owns serialization. */
  name?: string
  label: string
  language: CodeEditorLanguage
  initialValue?: string
  placeholder?: string
  /** Starting editor height in CSS px; SE corner grows this field only (vertically). */
  initialHeight?: number
  minHeight?: number
  maxHeight?: number
  hint?: string
  /** Fired on each edit — use for debounced form autosave. */
  onValueChange?: (value: string) => void
  /** Trailing label-row control. Localization uses this for the language menu. */
  labelEnd?: React.ReactNode
}

function languageExtension(language: CodeEditorLanguage) {
  switch (language) {
    case 'css':
      return css()
    case 'javascript':
      return javascript()
    case 'json':
      return json()
    case 'html':
    default:
      return html()
  }
}

/**
 * Syntax-highlighted code field for layout Custom / Page Settings / atoms.
 * SE corner: grows the parent settings popup both ways; vertically only this
 * editor gets taller (siblings stretch horizontally with the window only).
 */
export function CodeEditorField({
  name,
  label,
  language,
  initialValue = '',
  placeholder,
  initialHeight = 160,
  minHeight = 96,
  maxHeight = 640,
  hint,
  onValueChange,
  labelEnd,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [height, setHeight] = useState(initialHeight)
  const labelId = useId()
  const extensions = useMemo(
    () => [languageExtension(language), ...starforgeAdminCmTheme],
    [language],
  )

  return (
    <div className="sf-code-field">
      <div className="sf-code-field-label-row">
        <label id={labelId} className="sf-code-field-label">
          {label}
        </label>
        {labelEnd ? <span className="sf-code-field-label-end">{labelEnd}</span> : null}
      </div>
      {hint ? <p className="sf-code-field-hint">{hint}</p> : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        className="sf-code-field-panel sf-code-field-panel-dark"
        style={{ height, width: '100%', maxWidth: '100%' }}
        data-language={language}
      >
        <CodeMirror
          value={value}
          height="100%"
          theme="none"
          placeholder={placeholder}
          extensions={extensions}
          onChange={(next) => {
            setValue(next)
            onValueChange?.(next)
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
            autocompletion: true,
          }}
          aria-labelledby={labelId}
          className="sf-code-mirror"
        />
        <button
          type="button"
          className="gantry-settings-resize-handle sf-code-field-resize"
          aria-label={`Resize ${label} editor`}
          title="Drag: grow popup · this editor taller"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const startX = event.clientX
            const startY = event.clientY
            const startHeight = height
            const settingsPanel = event.currentTarget.closest(
              '.gantry-settings-panel',
            ) as HTMLElement | null
            const startRect = settingsPanel?.getBoundingClientRect()
            const startPanelWidth = startRect?.width ?? SETTINGS_PANEL_MIN_WIDTH
            const startPanelHeight = startRect?.height ?? startHeight
            const target = event.currentTarget
            target.setPointerCapture(event.pointerId)

            const onMove = (moveEvent: PointerEvent) => {
              const nextH = Math.min(
                maxHeight,
                Math.max(minHeight, startHeight + (moveEvent.clientY - startY)),
              )
              const fieldDeltaY = nextH - startHeight
              setHeight(nextH)
              if (settingsPanel) {
                settingsPanel.dispatchEvent(
                  new CustomEvent(SF_SETTINGS_PANEL_SET_SIZE, {
                    detail: {
                      width: startPanelWidth + (moveEvent.clientX - startX),
                      height: startPanelHeight + fieldDeltaY,
                    },
                  }),
                )
              }
            }
            const onUp = (upEvent: PointerEvent) => {
              target.releasePointerCapture(upEvent.pointerId)
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
          onKeyDown={(event) => {
            const settingsPanel = event.currentTarget.closest(
              '.gantry-settings-panel',
            ) as HTMLElement | null
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              const delta = event.key === 'ArrowDown' ? 16 : -16
              const nextH = Math.min(maxHeight, Math.max(minHeight, height + delta))
              const fieldDeltaY = nextH - height
              setHeight(nextH)
              if (settingsPanel) {
                const rect = settingsPanel.getBoundingClientRect()
                settingsPanel.dispatchEvent(
                  new CustomEvent(SF_SETTINGS_PANEL_SET_SIZE, {
                    detail: {
                      width: rect.width,
                      height: rect.height + fieldDeltaY,
                    },
                  }),
                )
              }
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              if (!settingsPanel) return
              const rect = settingsPanel.getBoundingClientRect()
              const delta = event.key === 'ArrowRight' ? 16 : -16
              settingsPanel.dispatchEvent(
                new CustomEvent(SF_SETTINGS_PANEL_SET_SIZE, {
                  detail: {
                    width: rect.width + delta,
                    height: rect.height,
                  },
                }),
              )
            }
          }}
        />
      </div>
    </div>
  )
}
