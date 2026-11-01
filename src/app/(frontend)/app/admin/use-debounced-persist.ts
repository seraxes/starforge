'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Default Core admin field autosave debounce. */
export const ADMIN_AUTOSAVE_DEBOUNCE_MS = 500

/**
 * Schedule keyed persists with debounce; flush cancels the timer and runs now.
 * Used by Styles / Breakpoints and other single-resource field panels.
 */
export function useDebouncedPersist<T>(
  persist: (patch: T) => void,
  delayMs: number = ADMIN_AUTOSAVE_DEBOUNCE_MS,
) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    const active = timers.current
    return () => {
      for (const timer of active.values()) clearTimeout(timer)
      active.clear()
    }
  }, [])

  const schedule = useCallback(
    (key: string, patch: T) => {
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          persistRef.current(patch)
        }, delayMs),
      )
    },
    [delayMs],
  )

  const flush = useCallback((key: string, patch: T) => {
    const existing = timers.current.get(key)
    if (existing) {
      clearTimeout(existing)
      timers.current.delete(key)
    }
    persistRef.current(patch)
  }, [])

  return { schedule, flush }
}
