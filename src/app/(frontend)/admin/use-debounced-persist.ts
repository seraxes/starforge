'use client'

import { useCallback, useEffect, useRef } from 'react'

import { DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS } from '@/core/settings/defaults'

import { useAdminAutosaveDebounceMs } from './admin-autosave-context'

/** @deprecated Prefer Site Settings / useAdminAutosaveDebounceMs(); kept as fallback default. */
export const ADMIN_AUTOSAVE_DEBOUNCE_MS = DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS

/**
 * Schedule keyed persists with debounce; flush cancels the timer and runs now.
 * Used by Styles / Breakpoints / particle attrs and other single-resource field panels.
 * Delay comes from Site Settings unless `delayMs` is passed explicitly.
 *
 * On unmount, any still-pending keyed patches are flushed (not dropped). Closing a
 * settings popover unmounts fields before blur — discarding the timer left CSS
 * classes / styles unsaved on the public site.
 */
export function useDebouncedPersist<T>(
  persist: (patch: T) => void,
  delayMs?: number,
) {
  const fromSettings = useAdminAutosaveDebounceMs()
  const ms = delayMs ?? fromSettings
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pending = useRef<Map<string, T>>(new Map())
  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    const activeTimers = timers.current
    const activePending = pending.current
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer)
      activeTimers.clear()
      // Flush drafts that never got blur / debounce fire (popover close, nav away).
      for (const patch of activePending.values()) {
        persistRef.current(patch)
      }
      activePending.clear()
    }
  }, [])

  const schedule = useCallback(
    (key: string, patch: T) => {
      pending.current.set(key, patch)
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          pending.current.delete(key)
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
    pending.current.delete(key)
    persistRef.current(patch)
  }, [])

  return { schedule, flush }
}
