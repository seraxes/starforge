'use client'

import React from 'react'

type Props = {
  /** Accessible name, e.g. "Remove Logo" / "Remove Email". */
  label: string
  /** Shown in the confirm dialog. */
  confirmMessage: string
  disabled?: boolean
  onConfirm: () => void
}

/**
 * Soft muted-danger remove beside the bar cog (Layout modules / Form fields).
 * Thick X glyph on quiet chrome (no ketchup-red fill); confirms before onConfirm.
 */
export function GantryBarRemoveButton({
  label,
  confirmMessage,
  disabled = false,
  onConfirm,
}: Props) {
  return (
    <button
      type="button"
      className="gantry-bar-remove"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        if (!window.confirm(confirmMessage)) return
        onConfirm()
      }}
    >
      <svg
        className="gantry-bar-remove-icon"
        viewBox="0 0 16 16"
        width="16"
        height="16"
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
  )
}
