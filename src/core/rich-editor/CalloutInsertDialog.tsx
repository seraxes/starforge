'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'

import type { CalloutVariant } from './nodes/callout'

const VARIANTS: { value: CalloutVariant; label: string; hint: string }[] = [
  { value: 'info', label: 'Info', hint: 'Neutral tip or note' },
  { value: 'warning', label: 'Warning', hint: 'Caution / important' },
  { value: 'success', label: 'Success', hint: 'Positive highlight' },
]

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (variant: CalloutVariant) => void
}

/** Callout style picker — same modal chrome as Video insert. */
export function CalloutInsertDialog({ open, onClose, onInsert }: Props) {
  const titleId = useId()
  const [variant, setVariant] = useState<CalloutVariant>('info')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setVariant('info')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="sf-rich-video-modal gantry-settings-theme-dark"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="sf-rich-video-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-rich-video-dialog-head">
          <h3 id={titleId}>Insert callout</h3>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="sf-rich-video-panel">
          <p className="sf-rich-video-hint layout-muted">
            Highlight a block of text with a bordered note style.
          </p>
          <div className="sf-rich-callout-choices" role="radiogroup" aria-label="Callout style">
            {VARIANTS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={variant === item.value}
                className={`sf-rich-callout-choice sf-rich-callout-choice-${item.value}${
                  variant === item.value ? ' is-selected' : ''
                }`}
                onClick={() => setVariant(item.value)}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>
          <div className="sf-rich-video-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              onClick={() => {
                onInsert(variant)
                onClose()
              }}
            >
              Insert callout
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
