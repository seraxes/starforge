'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingSettingsPanel } from '@/components/admin/useFloatingSettingsPanel'

type Props = {
  title: string
  triggerLabel?: string
  /** Dialog width (Assets CodeMirror editors prefer ~560–640). */
  preferredWidth?: number
  children: React.ReactNode
}

const DEFAULT_PANEL_WIDTH = 440

/**
 * Atom / Assets settings as a floating overlay — same pattern as layout particle editors.
 * Opens centered; title chrome is draggable. Closes on Escape and outside click.
 * Portals with `gantry-settings-theme-dark` so CodeMirror matches Core admin chrome.
 */
export function AtomSettingsPopover({
  title,
  triggerLabel = 'Settings',
  preferredWidth = DEFAULT_PANEL_WIDTH,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const { panelRef, panelStyle, panelClassName, onDragHandlePointerDown } = useFloatingSettingsPanel({
    open,
    preferredWidth,
  })

  useEffect(() => {
    // Portal needs document.body — mark mounted after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client portal gate
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.admin-toast-host')) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, panelRef])

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
        {open ? 'Close' : triggerLabel}
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="gantry-settings-layer gantry-settings-theme-dark"
              data-sf-settings-overlay=""
            >
              <div
                className="gantry-settings-backdrop"
                aria-hidden="true"
                onMouseDown={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                className={panelClassName}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={panelStyle}
              >
                <header
                  className="gantry-settings-panel-head gantry-settings-drag-handle"
                  onPointerDown={onDragHandlePointerDown}
                >
                  <h3 id={titleId}>{title}</h3>
                  <button
                    type="button"
                    className="gantry-settings-cancel"
                    data-sf-settings-close=""
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
