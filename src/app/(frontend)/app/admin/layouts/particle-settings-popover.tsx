'use client'

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  triggerLabel?: string
  children: React.ReactNode
}

const PANEL_WIDTH = 420
const VIEW_PAD = 12

/**
 * Particle settings as a floating overlay — does not expand the slot or push the row.
 * Closes on Escape and outside click.
 */
export function ParticleSettingsPopover({
  title,
  triggerLabel = 'Settings',
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const placePanel = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEW_PAD * 2)
    let left = rect.left
    if (left + width > window.innerWidth - VIEW_PAD) {
      left = Math.max(VIEW_PAD, window.innerWidth - VIEW_PAD - width)
    }
    let top = rect.bottom + 8
    const panelHeight = panelRef.current?.offsetHeight ?? 360
    if (top + panelHeight > window.innerHeight - VIEW_PAD) {
      top = Math.max(VIEW_PAD, rect.top - panelHeight - 8)
    }
    setCoords({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    placePanel()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onReposition = () => placePanel()

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [contenteditable="true"]',
    )
    first?.focus()
  }, [open])

  return (
    <div className="gantry-settings-trigger-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="secondary gantry-settings-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close settings' : triggerLabel}
      </button>
      {mounted && open
        ? createPortal(
            <div className="gantry-settings-layer" data-sf-settings-overlay="">
              <div
                className="gantry-settings-backdrop"
                aria-hidden="true"
                onMouseDown={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                className="gantry-settings-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={{
                  top: coords.top,
                  left: coords.left,
                  width: Math.min(PANEL_WIDTH, typeof window !== 'undefined' ? window.innerWidth - VIEW_PAD * 2 : PANEL_WIDTH),
                }}
              >
                <header className="gantry-settings-panel-head">
                  <h3 id={titleId}>{title}</h3>
                  <button
                    type="button"
                    className="secondary"
                    aria-label="Close settings"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </header>
                <div className="gantry-settings-panel-body">{children}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
