'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingSettingsPanel } from '@/components/admin/useFloatingSettingsPanel'

export type ParticleSettingsTab = {
  id: string
  label: string
  content: React.ReactNode
}

type Props = {
  title: string
  triggerLabel?: string
  /** Single-pane body when `tabs` is omitted. */
  children?: React.ReactNode
  /** Tabbed body — Helium-style Particle / Block / Inheritance chrome. */
  tabs?: ParticleSettingsTab[]
  /** When true, render only the body (no gear trigger / portal). */
  embedded?: boolean
}

const PANEL_WIDTH = 460

/**
 * Particle settings as a floating overlay — does not expand the slot or push the row.
 * Opens centered; title chrome is draggable. Portal is dark Gantry Helium–styled.
 */
export function ParticleSettingsPopover({
  title,
  triggerLabel = '⚙',
  children,
  tabs,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState(() => tabs?.[0]?.id ?? 'main')
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const tablistId = useId()
  const { panelRef, panelStyle, panelClassName, onDragHandlePointerDown } = useFloatingSettingsPanel({
    open,
    preferredWidth: PANEL_WIDTH,
    layoutKey: activeTab,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!tabs?.length) return
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]!.id)
    }
  }, [tabs, activeTab])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      // Global Saved toast mounts outside the panel — ignore so autosave toasts do not close the cog.
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

  useEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-sf-settings-close]), [contenteditable="true"]',
    )
    first?.focus()
  }, [open, activeTab, panelRef])

  const tablist = tabs?.length ? (
    <div className="gantry-settings-tablist" role="tablist" aria-label={title} id={tablistId}>
      {tabs.map((tab) => {
        const selected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${tablistId}-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${tablistId}-panel-${tab.id}`}
            className={selected ? 'gantry-settings-tab is-active' : 'gantry-settings-tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  ) : null

  // Keep tab bodies mounted (hidden) so autosave drafts / focus survive tab switches and parent re-renders.
  const panels = tabs?.length ? (
    <div className="gantry-settings-tabs">
      {tabs.map((tab) => {
        const selected = tab.id === activeTab
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${tablistId}-panel-${tab.id}`}
            aria-labelledby={`${tablistId}-${tab.id}`}
            hidden={!selected}
            className="gantry-settings-tabpanel"
          >
            {tab.content}
          </div>
        )
      })}
    </div>
  ) : (
    children
  )

  if (embedded) {
    return (
      <div className="gantry-settings-embedded">
        {tablist}
        {panels}
      </div>
    )
  }

  return (
    <div className="gantry-settings-trigger-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="secondary gantry-settings-trigger gantry-settings-gear"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close settings' : title}
        title={open ? 'Close settings' : title}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '✕' : triggerLabel}
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
                {/* Helium: tabs sit on the dark chrome strip at the top */}
                {tablist ? (
                  <div
                    className="gantry-settings-panel-tabs gantry-settings-drag-handle"
                    onPointerDown={onDragHandlePointerDown}
                  >
                    {tablist}
                  </div>
                ) : null}
                <header
                  className="gantry-settings-panel-head gantry-settings-drag-handle"
                  onPointerDown={onDragHandlePointerDown}
                >
                  <h3 id={titleId}>{title}</h3>
                  <button
                    type="button"
                    className="gantry-settings-cancel"
                    data-sf-settings-close=""
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </header>
                <div className="gantry-settings-panel-body">{panels}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
