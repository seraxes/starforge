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
 * White X remove beside the bar cog (Layout modules / Form fields).
 * No button fill. Confirms in an in-app dialog (not window.confirm).
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
            d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
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
