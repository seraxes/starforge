'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SocialConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  /** Primary confirm label — default “OK”. */
  confirmLabel?: string
  /** Dismiss label — default “Cancel”. */
  cancelLabel?: string
  /** Danger styling on the confirm button (destructive actions). */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * In-app confirm for Social member chrome (not window.confirm).
 * Same contract as AdminConfirmDialog; portals to document.body.
 * Escape / backdrop = cancel.
 */
export function SocialConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: SocialConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onCancel])

  if (!portalTarget || !open) return null

  return createPortal(
    <div
      className="sf-social-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="sf-social-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <header className="sf-social-confirm-head">
          <h3 id={titleId}>{title}</h3>
        </header>
        <p id={messageId} className="sf-social-confirm-message">
          {message}
        </p>
        <div className="sf-social-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
