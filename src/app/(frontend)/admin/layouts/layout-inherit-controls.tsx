'use client'

import React from 'react'

type InheritSwitchProps = {
  /** When true, value is inherited from parent. */
  inherited: boolean
  disabled?: boolean
  label?: string
  onChange: (inherited: boolean) => void
}

/**
 * cms-switch inherit slide — On = inherit from parent outline / global.
 */
export function InheritSwitch({
  inherited,
  disabled,
  label = 'Inherit',
  onChange,
}: InheritSwitchProps) {
  return (
    <div className="cms-switch settings-field settings-flag gantry-inherit-switch">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={inherited}
        aria-label={label}
        className={inherited ? 'cms-switch-track is-on' : 'cms-switch-track'}
        disabled={disabled}
        onClick={() => onChange(!inherited)}
      >
        <span className="cms-switch-thumb" />
      </button>
      <span className={inherited ? 'cms-switch-label is-on' : 'cms-switch-label is-off'}>
        {inherited ? 'On' : 'Off'}
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
  hint?: string
}

/** Inherit slide + Copy button (section / particle cog). */
export function InheritCopyRow({
  inherited,
  disabled,
  copyDisabled,
  onInheritChange,
  onCopy,
  hint,
}: InheritCopyRowProps) {
  return (
    <div className="gantry-inherit-copy-row">
      <InheritSwitch inherited={inherited} disabled={disabled} onChange={onInheritChange} />
      <button
        type="button"
        className="gantry-toolbar-btn"
        disabled={disabled || copyDisabled || inherited}
        title={
          inherited
            ? 'Turn inherit off or use Copy to snapshot parent into this outline'
            : 'Replace with a snapshot from the parent outline (no further inherit)'
        }
        onClick={onCopy}
      >
        Copy from parent
      </button>
      {hint ? <p className="settings-hint">{hint}</p> : null}
    </div>
  )
}
