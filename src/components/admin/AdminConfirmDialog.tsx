'use client'

import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export type AdminConfirmDialogProps = {
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
 * In-app confirm (not window.confirm) — Starforge admin chrome.
 * Actions sit bottom-right; Escape / backdrop = cancel.
 */
export function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(
      (document.querySelector('.admin-shell') as HTMLElement | null) || document.body,
    )
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
      className="sf-admin-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="sf-admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <header className="sf-admin-confirm-head">
          <h3 id={titleId}>{title}</h3>
        </header>
        <p id={messageId} className="sf-admin-confirm-message">
          {message}
        </p>
        <div className="sf-admin-confirm-actions admin-action-row">
          <button
            ref={cancelRef}
            type="button"
            className="gantry-toolbar-btn secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger ? 'gantry-toolbar-btn danger' : 'gantry-toolbar-btn gantry-toolbar-btn-save'
            }
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
