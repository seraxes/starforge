'use client'

import React, { useEffect, useRef, useState } from 'react'

import {
  asBoxSpacingUnit,
  formatLayoutBoxSpacing,
  parseLayoutBoxSpacing,
  type LayoutBoxSpacingDraft,
  type LayoutBoxSpacingUnit,
} from '@/core/modules/styles'

type Props = {
  /** Stored CSS shorthand (`1rem 2rem 1rem 2rem`) or empty. */
  value?: string
  label: string
  /** Form / aria field name prefix (`padding` | `margin`). */
  fieldKey: 'padding' | 'margin'
  allowNegative?: boolean
  disabled?: boolean
  onCommit: (css: string) => void
}

const SIDE_LABELS = [
  { key: 'top' as const, short: 'T', title: 'Top' },
  { key: 'right' as const, short: 'R', title: 'Right' },
  { key: 'bottom' as const, short: 'B', title: 'Bottom' },
  { key: 'left' as const, short: 'L', title: 'Left' },
]

function draftFromValue(value: string | undefined): LayoutBoxSpacingDraft {
  return parseLayoutBoxSpacing(value)
}

/**
 * Section cog — four number inputs + px|rem unit → CSS padding/margin shorthand.
 */
export function SectionBoxSpacingFields({
  value,
  label,
  fieldKey,
  allowNegative = false,
  disabled,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(() => draftFromValue(value))
  const draftRef = useRef(draft)
  const savedCssRef = useRef((value ?? '').trim())

  useEffect(() => {
    const next = draftFromValue(value)
    draftRef.current = next
    setDraft(next)
    savedCssRef.current = (value ?? '').trim()
  }, [value])

  const commit = (next: LayoutBoxSpacingDraft) => {
    const css = formatLayoutBoxSpacing(next, { allowNegative }) ?? ''
    if (css === savedCssRef.current) return
    // Invalid partial input — wait until blur / unit change produces a valid box.
    if (
      [next.top, next.right, next.bottom, next.left].some((s) => s.trim()) &&
      !css
    ) {
      return
    }
    savedCssRef.current = css
    onCommit(css)
  }

  const setSide = (side: keyof Omit<LayoutBoxSpacingDraft, 'unit'>, raw: string) => {
    const next = { ...draftRef.current, [side]: raw }
    draftRef.current = next
    setDraft(next)
  }

  const setUnit = (unit: LayoutBoxSpacingUnit) => {
    const next = { ...draftRef.current, unit: asBoxSpacingUnit(unit) }
    draftRef.current = next
    setDraft(next)
    commit(next)
  }

  return (
    <div className="gantry-section-box-spacing" role="group" aria-label={label}>
      <span className="gantry-field-hint">{label}</span>
      <span className="gantry-section-box-spacing-row">
        {SIDE_LABELS.map((side) => (
          <label key={side.key} className="gantry-section-box-side" title={side.title}>
            <span className="sr-only">
              {label} {side.title}
            </span>
            <span className="gantry-section-box-side-mark" aria-hidden="true">
              {side.short}
            </span>
            <input
              type="number"
              className="gantry-inline-input gantry-section-box-side-input"
              inputMode="decimal"
              step="any"
              min={allowNegative ? undefined : 0}
              value={draft[side.key]}
              disabled={disabled}
              placeholder="0"
              data-box-field={`${fieldKey}-${side.key}`}
              aria-label={`${label} ${side.title}`}
              onChange={(event) => setSide(side.key, event.target.value)}
              onBlur={() => commit(draftRef.current)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  ;(event.target as HTMLInputElement).blur()
                }
              }}
            />
          </label>
        ))}
        <label className="gantry-section-box-unit" title={`${label} unit`}>
          <span className="sr-only">{label} unit</span>
          <select
            className="gantry-inline-input gantry-section-box-unit-select"
            value={draft.unit}
            disabled={disabled}
            aria-label={`${label} unit`}
            onChange={(event) => setUnit(asBoxSpacingUnit(event.target.value))}
          >
            <option value="rem">rem</option>
            <option value="px">px</option>
          </select>
        </label>
      </span>
    </div>
  )
}
