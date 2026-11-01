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
 * Red ✕ beside the bar cog (Layout modules / Form fields).
 * Confirms before calling onConfirm — replaces in-panel Remove buttons.
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
      ✕
    </button>
  )
}
