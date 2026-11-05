'use client'

import React, { useId, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'

import { starforgeAdminCmTheme } from './starforge-admin-cm-theme'

export type CodeEditorLanguage = 'html' | 'css' | 'javascript'

type Props = {
  /** Form field name (submitted via hidden input). Omit when the parent owns serialization. */
  name?: string
  label: string
  language: CodeEditorLanguage
  initialValue?: string
  placeholder?: string
  /** Starting editor height in CSS px; panel is vertically resizable. */
  initialHeight?: number
  minHeight?: number
  hint?: string
  /** Fired on each edit — use for debounced form autosave. */
  onValueChange?: (value: string) => void
}

function languageExtension(language: CodeEditorLanguage) {
  switch (language) {
    case 'css':
      return css()
    case 'javascript':
      return javascript()
    case 'html':
    default:
      return html()
  }
}

/**
 * Syntax-highlighted code field for layout Custom / Page Settings / atoms.
 * CodeMirror 6 via `@uiw/react-codemirror` — Starforge admin Gantry navy theme
 * (works in `.admin-shell` and portaled `.gantry-settings-theme-dark` popups).
 */
export function CodeEditorField({
  name,
  label,
  language,
  initialValue = '',
  placeholder,
  initialHeight = 160,
  minHeight = 96,
  hint,
  onValueChange,
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
        <span className="sf-code-field-lang">{language}</span>
      </div>
      {hint ? <p className="sf-code-field-hint">{hint}</p> : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        className="sf-code-field-panel sf-code-field-panel-dark"
        style={{ height }}
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
        <div
          className="sf-code-field-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label={`Resize ${label} editor`}
          aria-valuemin={minHeight}
          aria-valuemax={640}
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault()
            const startY = event.clientY
            const startHeight = height
            const target = event.currentTarget
            target.setPointerCapture(event.pointerId)

            const onMove = (moveEvent: PointerEvent) => {
              const next = Math.min(
                640,
                Math.max(minHeight, startHeight + (moveEvent.clientY - startY)),
              )
              setHeight(next)
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
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHeight((h) => Math.max(minHeight, h - 16))
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHeight((h) => Math.min(640, h + 16))
            }
          }}
        />
      </div>
    </div>
  )
}
