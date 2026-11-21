'use client'

import { useEffect, useRef, type RefObject } from 'react'

export type DismissibleOptions = {
  /** Close when clicking / tapping outside. Default true. */
  outsideClick?: boolean
  /** Close on Escape. Default true. */
  escape?: boolean
}

/**
 * Close an open popup when the user clicks outside or presses Escape.
 * Opt out per call with `{ outsideClick: false }` / `{ escape: false }`.
 */
export function useDismissible<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
  options?: DismissibleOptions,
): RefObject<T | null> {
  const rootRef = useRef<T | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const outsideClick = options?.outsideClick !== false
  const escape = options?.escape !== false

  useEffect(() => {
    if (!open) return
    if (!outsideClick && !escape) return

    function onPointerDown(event: PointerEvent) {
      if (!outsideClick) return
      const root = rootRef.current
      const target = event.target
      if (!root || !(target instanceof Node)) return
      if (root.contains(target)) return
      onDismissRef.current()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!escape) return
      if (event.key !== 'Escape') return
      onDismissRef.current()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, outsideClick, escape])

  return rootRef
}
