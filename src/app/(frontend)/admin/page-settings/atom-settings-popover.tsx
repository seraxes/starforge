'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getAdminOverlayPortalTarget,
  SETTINGS_NESTED_OVERLAY_SELECTOR,
  useFloatingSettingsPanel,
} from '@/components/admin/useFloatingSettingsPanel'

type Props = {
  title: string
  /** Plain trigger text when `triggerContent` is omitted (e.g. Assets “Edit”). */
  triggerLabel?: string
  /** Custom trigger body (e.g. atom tag label + cog). */
  triggerContent?: React.ReactNode
  /** Extra classes on the trigger button. */
  triggerClassName?: string
  /** Dialog width (Assets CodeMirror editors prefer ~560–640). */
  preferredWidth?: number
  /** Called when the panel closes (Escape / Close) — flush autosave. */
  onClose?: () => void
  children: React.ReactNode
}

const DEFAULT_PANEL_WIDTH = 440

/**
 * Atom / Assets settings as a floating overlay — same pattern as layout particle editors.
 * Opens centered; title chrome is draggable; SE corner resizes. Configuration window:
 * closes on Escape / Close only (not outside click). Portals with
 * `gantry-settings-theme-dark` inside `.admin-shell`.
 */
export function AtomSettingsPopover({
  title,
  triggerLabel = 'Settings',
  triggerContent,
  triggerClassName,
  preferredWidth = DEFAULT_PANEL_WIDTH,
  onClose,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const {
    panelRef,
    panelStyle,
    panelClassName,
    onDragHandlePointerDown,
    onResizeHandlePointerDown,
  } = useFloatingSettingsPanel({
    open,
    preferredWidth,
  })

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const closePanel = () => {
    setOpen(false)
    onCloseRef.current?.()
  }

  useEffect(() => {
    // Portal needs admin-shell / body — mark mounted after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client portal gate
    setMounted(true)
    setPortalTarget(getAdminOverlayPortalTarget())
  }, [])

  useEffect(() => {
    if (!open) return

    // Configuration window — Escape / Close only; outside click must not dismiss.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector(SETTINGS_NESTED_OVERLAY_SELECTOR)) return
      setOpen(false)
      onCloseRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerClasses = [
    'secondary',
    'gantry-settings-trigger',
    triggerContent ? 'page-settings-atom-chip-trigger' : '',
    triggerClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="gantry-settings-trigger-wrap page-settings-atom-trigger-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? `Close ${title}` : `Configure ${title}`}
        title={open ? 'Close' : title}
        onClick={() => {
          if (open) closePanel()
          else setOpen(true)
        }}
      >
        {triggerContent ?? (open ? 'Close' : triggerLabel)}
      </button>
      {mounted && open && portalTarget
        ? createPortal(
            <div
              className="gantry-settings-layer gantry-settings-theme-dark"
              data-sf-settings-overlay=""
            >
              <div className="gantry-settings-backdrop" aria-hidden="true" />
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
                    onClick={closePanel}
                  >
                    Close
                  </button>
                </header>
                <div className="gantry-settings-panel-body">{children}</div>
                <button
                  type="button"
                  className="gantry-settings-resize-handle"
                  aria-label="Resize settings panel"
                  title="Resize"
                  onPointerDown={onResizeHandlePointerDown}
                />
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </div>
  )
}
