'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (href: string) => void
  initialHref?: string
}

/** Link URL popup — same chrome as Callout / Video dialogs. */
export function LinkInsertDialog({ open, onClose, onInsert, initialHref = '' }: Props) {
  const titleId = useId()
  const [href, setHref] = useState(initialHref)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setHref(initialHref)
    setError(null)
  }, [open, initialHref])

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

  const submit = () => {
    const next = href.trim()
    if (!next) {
      setError('Enter a URL (https://… or /path).')
      return
    }
    setError(null)
    onInsert(next)
    onClose()
  }

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
          <h3 id={titleId}>Insert link</h3>
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
            Select text first, then add an absolute or site-relative URL.
          </p>
          <label className="settings-field">
            <span>URL</span>
            <input
              type="text"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://example.com or /about"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </label>
          {error ? (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          ) : null}
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
              onClick={submit}
            >
              Apply link
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
