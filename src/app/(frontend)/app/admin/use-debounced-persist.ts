'use client'

import { useCallback, useEffect, useRef } from 'react'

import { DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS } from '@/core/settings/defaults'

import { useAdminAutosaveDebounceMs } from './admin-autosave-context'

/** @deprecated Prefer Site Settings / useAdminAutosaveDebounceMs(); kept as fallback default. */
export const ADMIN_AUTOSAVE_DEBOUNCE_MS = DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS

/**
 * Schedule keyed persists with debounce; flush cancels the timer and runs now.
 * Used by Styles / Breakpoints and other single-resource field panels.
 * Delay comes from Site Settings unless `delayMs` is passed explicitly.
 */
export function useDebouncedPersist<T>(
  persist: (patch: T) => void,
  delayMs?: number,
) {
  const fromSettings = useAdminAutosaveDebounceMs()
  const ms = delayMs ?? fromSettings
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
        }, ms),
      )
    },
    [ms],
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
