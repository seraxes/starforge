'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const SETTINGS_PANEL_VIEW_PAD = 12
export const SETTINGS_PANEL_MIN_WIDTH = 320
export const SETTINGS_PANEL_MIN_HEIGHT = 220

type Coords = { top: number; left: number }
type Size = { width: number; height: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function panelWidthForViewport(preferredWidth: number) {
  if (typeof window === 'undefined') return preferredWidth
  return Math.min(preferredWidth, window.innerWidth - SETTINGS_PANEL_VIEW_PAD * 2)
}

function maxPanelHeight() {
  if (typeof window === 'undefined') return 680
  return Math.max(
    SETTINGS_PANEL_MIN_HEIGHT,
    window.innerHeight - SETTINGS_PANEL_VIEW_PAD * 2,
  )
}

function defaultPanelHeight(panelEl: HTMLElement | null) {
  const measured = panelEl?.offsetHeight ?? 360
  return clamp(measured, SETTINGS_PANEL_MIN_HEIGHT, maxPanelHeight())
}

function centeredCoords(size: Size): Coords {
  const maxTop = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerHeight - SETTINGS_PANEL_VIEW_PAD - size.height,
  )
  const maxLeft = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerWidth - SETTINGS_PANEL_VIEW_PAD - size.width,
  )
  return {
    top: clamp((window.innerHeight - size.height) / 2, SETTINGS_PANEL_VIEW_PAD, maxTop),
    left: clamp((window.innerWidth - size.width) / 2, SETTINGS_PANEL_VIEW_PAD, maxLeft),
  }
}

function clampCoords(coords: Coords, size: Size): Coords {
  const maxTop = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerHeight - SETTINGS_PANEL_VIEW_PAD - size.height,
  )
  const maxLeft = Math.max(
    SETTINGS_PANEL_VIEW_PAD,
    window.innerWidth - SETTINGS_PANEL_VIEW_PAD - size.width,
  )
  return {
    top: clamp(coords.top, SETTINGS_PANEL_VIEW_PAD, maxTop),
    left: clamp(coords.left, SETTINGS_PANEL_VIEW_PAD, maxLeft),
  }
}

function clampSize(size: Size): Size {
  const maxW = Math.max(
    SETTINGS_PANEL_MIN_WIDTH,
    window.innerWidth - SETTINGS_PANEL_VIEW_PAD * 2,
  )
  const maxH = maxPanelHeight()
  return {
    width: clamp(size.width, SETTINGS_PANEL_MIN_WIDTH, maxW),
    height: clamp(size.height, SETTINGS_PANEL_MIN_HEIGHT, maxH),
  }
}

/** Nested overlays that must not dismiss a settings panel (media / confirm / toast). */
export const SETTINGS_NESTED_OVERLAY_SELECTOR =
  '.sf-media-picker-modal, .sf-admin-confirm-backdrop, .sf-media-lightbox, .admin-toast-host'

type Options = {
  open: boolean
  preferredWidth: number
  /** Preferred starting height; measured from the panel when omitted. */
  preferredHeight?: number
  /** Extra deps that may change panel height (e.g. active tab) — clamp only, do not re-center after drag. */
  layoutKey?: string | number
}

/**
 * Shared Core admin floating settings dialog placement:
 * opens centered in the viewport; title-bar (and chrome strip) can drag it;
 * SE corner resizes width/height. Does not remount or close the panel —
 * safe for cog autosave drafts.
 */
export function useFloatingSettingsPanel({
  open,
  preferredWidth,
  preferredHeight,
  layoutKey,
}: Options) {
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 })
  const [size, setSize] = useState<Size>(() => ({
    width: preferredWidth,
    height: preferredHeight ?? 360,
  }))
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [sizeLocked, setSizeLocked] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const userMovedRef = useRef(false)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const resizeOriginRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    if (!open) {
      userMovedRef.current = false
      dragOffsetRef.current = null
      resizeOriginRef.current = null
      setDragging(false)
      setResizing(false)
      setSizeLocked(false)
      setSize({
        width: preferredWidth,
        height: preferredHeight ?? 360,
      })
    }
  }, [open, preferredWidth, preferredHeight])

  const currentSize = useCallback((): Size => {
    const panel = panelRef.current
    const width = sizeLocked ? size.width : panelWidthForViewport(preferredWidth)
    const height = sizeLocked
      ? size.height
      : preferredHeight ?? defaultPanelHeight(panel)
    return clampSize({ width, height })
  }, [preferredWidth, preferredHeight, size.height, size.width, sizeLocked])

  const placeOrClamp = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    const nextSize = currentSize()
    if (sizeLocked) {
      setSize(nextSize)
    } else {
      setSize((prev) => ({ ...prev, width: nextSize.width }))
    }
    setCoords((prevCoords) =>
      userMovedRef.current ? clampCoords(prevCoords, nextSize) : centeredCoords(nextSize),
    )
  }, [currentSize, sizeLocked])

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
      const rect = panel.getBoundingClientRect()
      setCoords(
        clampCoords(
          { top: event.clientY - offset.y, left: event.clientX - offset.x },
          { width: rect.width, height: rect.height },
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
  }, [dragging])

  useEffect(() => {
    if (!resizing) return

    const onMove = (event: PointerEvent) => {
      const origin = resizeOriginRef.current
      if (!origin) return
      userMovedRef.current = true
      setSizeLocked(true)
      const next = clampSize({
        width: origin.width + (event.clientX - origin.x),
        height: origin.height + (event.clientY - origin.y),
      })
      setSize(next)
      setCoords((prev) => clampCoords(prev, next))
    }
    const onUp = () => {
      resizeOriginRef.current = null
      setResizing(false)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [resizing])

  const onDragHandlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const target = event.target as Element | null
    // Keep Close / tabs / form controls interactive — drag only from chrome chrome.
    if (target?.closest('button, a, input, select, textarea, label, [role="tab"]')) return
    if (target?.closest('.gantry-settings-resize-handle')) return
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

  const onResizeHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const next = clampSize({ width: rect.width, height: rect.height })
      resizeOriginRef.current = {
        x: event.clientX,
        y: event.clientY,
        width: next.width,
        height: next.height,
      }
      setSize(next)
      setSizeLocked(true)
      setResizing(true)
      event.preventDefault()
      event.stopPropagation()
    },
    [],
  )

  const panelStyle: React.CSSProperties = sizeLocked
    ? {
        top: coords.top,
        left: coords.left,
        width: size.width,
        height: size.height,
        maxHeight: 'none',
      }
    : {
        top: coords.top,
        left: coords.left,
        width: size.width,
      }

  const panelClassName = [
    'gantry-settings-panel',
    dragging ? 'is-dragging' : '',
    resizing ? 'is-resizing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    panelRef,
    panelStyle,
    panelClassName,
    onDragHandlePointerDown,
    onResizeHandlePointerDown,
    dragging,
    resizing,
  }
}

/** Prefer `.admin-shell` so overlay CSS tokens + stacking stay with admin chrome. */
export function getAdminOverlayPortalTarget(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('getAdminOverlayPortalTarget requires document')
  }
  return (
    (document.querySelector('.admin-shell') as HTMLElement | null) || document.body
  )
}
