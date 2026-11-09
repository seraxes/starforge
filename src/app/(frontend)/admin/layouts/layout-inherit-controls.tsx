'use client'

import React, { useState } from 'react'

import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'

/** Floppy / save disk — Copy snapshot action. */
function CopyDiskIcon() {
  return (
    <svg
      className="gantry-inherit-copy-disk-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5V4.207a1.5 1.5 0 0 0-.44-1.06L12.853 1.44A1.5 1.5 0 0 0 11.793 1H2.5zm2 1h5v3.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5V2zm6 0h.793L14 4.207V5.5a.5.5 0 0 1-.5.5H11a.5.5 0 0 1-.5-.5V2zM3 9.5A1.5 1.5 0 0 1 4.5 8h7A1.5 1.5 0 0 1 13 9.5v3a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-3z"
      />
    </svg>
  )
}

type InheritSwitchProps = {
  /** When true, value is inherited from parent. */
  inherited: boolean
  disabled?: boolean
  label?: string
  onChange: (inherited: boolean) => void
}

/**
 * cms-switch inherit slide — label above toggle; On = inherit from parent / global.
 */
export function InheritSwitch({
  inherited,
  disabled,
  label = 'Inherit',
  onChange,
}: InheritSwitchProps) {
  return (
    <div className="cms-switch settings-field settings-flag gantry-inherit-switch">
      <span className="gantry-inherit-switch-label">{label}</span>
      <span className="gantry-inherit-switch-controls">
        <button
          type="button"
          role="switch"
          aria-checked={inherited}
          aria-label={label}
          className={inherited ? 'cms-switch-track is-on' : 'cms-switch-track'}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onChange(!inherited)
          }}
        >
          <span className="cms-switch-thumb" />
        </button>
        <span className={inherited ? 'cms-switch-label is-on' : 'cms-switch-label is-off'}>
          {inherited ? 'On' : 'Off'}
        </span>
      </span>
    </div>
  )
}

type InheritCopyRowProps = {
  inherited: boolean
  disabled?: boolean
  copyDisabled?: boolean
  onInheritChange: (inherited: boolean) => void
  onCopy: () => void
  /** Prefer title / field hint — never inflate the action row. */
  hint?: string
  /** Accessible name for the disk Copy button. */
  copyLabel?: string
  /** Confirm dialog title — default depends on inherit state. */
  copyConfirmTitle?: string
  /** Confirm dialog body. */
  copyConfirmMessage?: string
  /**
   * Compact single-row layout (default). Pass false only when a rare
   * stacked panel needs the hint under the controls.
   */
  inline?: boolean
}

/** Inherit (label above toggle) + disk Copy — compact; Copy asks for confirm. */
export function InheritCopyRow({
  inherited,
  disabled,
  copyDisabled,
  onInheritChange,
  onCopy,
  hint,
  copyLabel = 'Copy',
  copyConfirmTitle,
  copyConfirmMessage,
  inline = true,
}: InheritCopyRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const title =
    hint ||
    (inherited
      ? 'Snapshot the inherited value locally (turns inherit off)'
      : 'Replace local value with a fresh snapshot from the parent / site global')

  const dialogTitle =
    copyConfirmTitle ??
    (inherited ? 'Copy inherited value locally?' : 'Replace local value from parent?')

  const dialogMessage =
    copyConfirmMessage ??
    (inherited
      ? 'This snapshots the parent / site value here and turns Inherit off. Your local edits for this field will start from that snapshot.'
      : 'This overwrites the local value with a fresh snapshot from the parent / site global. Local changes for this field will be lost.')

  return (
    <div
      className={
        inline
          ? 'gantry-inherit-copy-row gantry-inherit-copy-row-inline'
          : 'gantry-inherit-copy-row'
      }
      title={inline ? hint : undefined}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <InheritSwitch inherited={inherited} disabled={disabled} onChange={onInheritChange} />
      <button
        type="button"
        className="gantry-toolbar-btn gantry-inherit-copy-disk"
        disabled={disabled || copyDisabled}
        title={title}
        aria-label={copyLabel}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setConfirmOpen(true)
        }}
      >
        <CopyDiskIcon />
      </button>
      {!inline && hint ? <p className="settings-hint">{hint}</p> : null}
      <AdminConfirmDialog
        open={confirmOpen}
        title={dialogTitle}
        message={dialogMessage}
        confirmLabel="Copy"
        cancelLabel="Cancel"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onCopy()
        }}
      />
    </div>
  )
}
