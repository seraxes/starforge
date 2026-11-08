'use client'

import React, { useState } from 'react'

import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

type Props = {
  /** Accessible name, e.g. "Remove Logo" / "Remove Email". */
  label: string
  /** Shown in the in-app confirm dialog. */
  confirmMessage: string
  /** Optional dialog title — defaults to `label`. */
  confirmTitle?: string
  disabled?: boolean
  onConfirm: () => void
}

/**
 * Soft muted-danger remove beside the bar cog (Layout modules / Form fields).
 * Thick X glyph on quiet chrome; confirms in an in-app dialog (not window.confirm).
 */
export function GantryBarRemoveButton({
  label,
  confirmMessage,
  confirmTitle,
  disabled = false,
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="gantry-bar-remove"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen(true)
        }}
      >
        <svg
          className="gantry-bar-remove-icon"
          viewBox="0 0 16 16"
          width="1em"
          height="1em"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3.25 3.25 L12.75 12.75 M12.75 3.25 L3.25 12.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
          />
        </svg>
      </button>
      <AdminConfirmDialog
        open={open}
        title={confirmTitle ?? label}
        message={confirmMessage}
        confirmLabel="OK"
        cancelLabel="Cancel"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}
