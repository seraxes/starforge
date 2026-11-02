'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const SETTINGS_PANEL_VIEW_PAD = 12

type Coords = { top: number; left: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function panelWidthForViewport(preferredWidth: number) {
  if (typeof window === 'undefined') return preferredWidth
  return Math.min(preferredWidth, window.innerWidth - SETTINGS_PANEL_VIEW_PAD * 2)
}

function centeredCoords(panelEl: HTMLElement | null, preferredWidth: number): Coords {
  const width = panelWidthForViewport(preferredWidth)
  const height = panelEl?.offsetHeight ?? 360
  const maxTop = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerHeight - SETTINGS_PANEL_VIEW_PAD - height,
  )
  const maxLeft = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerWidth - SETTINGS_PANEL_VIEW_PAD - width,
  )
  return {
    top: clamp((window.innerHeight - height) / 2, SETTINGS_PANEL_VIEW_PAD, maxTop),
    left: clamp((window.innerWidth - width) / 2, SETTINGS_PANEL_VIEW_PAD, maxLeft),
  }
}

function clampCoords(
  coords: Coords,
  panelEl: HTMLElement | null,
  preferredWidth: number,
): Coords {
  const width = panelWidthForViewport(preferredWidth)
  const height = panelEl?.offsetHeight ?? 360
  const maxTop = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerHeight - SETTINGS_PANEL_VIEW_PAD - height,
  )
  const maxLeft = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerWidth - SETTINGS_PANEL_VIEW_PAD - width,
  )
  return {
    top: clamp(coords.top, SETTINGS_PANEL_VIEW_PAD, maxTop),
    left: clamp(coords.left, SETTINGS_PANEL_VIEW_PAD, maxLeft),
  }
}

type Options = {
  open: boolean
  preferredWidth: number
  /** Extra deps that may change panel height (e.g. active tab) — clamp only, do not re-center after drag. */
  layoutKey?: string | number
}

/**
 * Shared Core admin floating settings dialog placement:
 * opens centered in the viewport; title-bar (and chrome strip) can drag it.
 * Does not remount or close the panel — safe for cog autosave drafts.
 */
export function useFloatingSettingsPanel({ open, preferredWidth, layoutKey }: Options) {
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 })
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const userMovedRef = useRef(false)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!open) {
      userMovedRef.current = false
      dragOffsetRef.current = null
      setDragging(false)
    }
  }, [open])

  const placeOrClamp = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    if (userMovedRef.current) {
      setCoords((prev) => clampCoords(prev, panel, preferredWidth))
    } else {
      setCoords(centeredCoords(panel, preferredWidth))
    }
  }, [preferredWidth])

  useLayoutEffect(() => {
    if (!open) return
    placeOrClamp()
  }, [open, layoutKey, placeOrClamp])

  useEffect(() => {
    if (!open) return
    const onResize = () => placeOrClamp()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, placeOrClamp])

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent) => {
      const offset = dragOffsetRef.current
      const panel = panelRef.current
      if (!offset || !panel) return
      userMovedRef.current = true
      setCoords(
        clampCoords(
          { top: event.clientY - offset.y, left: event.clientX - offset.x },
          panel,
          preferredWidth,
        ),
      )
    }
    const onUp = () => {
      dragOffsetRef.current = null
      setDragging(false)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, preferredWidth])

  const onDragHandlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const target = event.target as Element | null
    // Keep Close / tabs / form controls interactive — drag only from chrome chrome.
    if (target?.closest('button, a, input, select, textarea, label, [role="tab"]')) return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    setDragging(true)
    event.preventDefault()
  }, [])

  const panelWidth = panelWidthForViewport(preferredWidth)
  const panelStyle: React.CSSProperties = {
    top: coords.top,
    left: coords.left,
    width: panelWidth,
  }

  return {
    panelRef,
    panelStyle,
    panelClassName: dragging ? 'gantry-settings-panel is-dragging' : 'gantry-settings-panel',
    onDragHandlePointerDown,
    dragging,
  }
}
