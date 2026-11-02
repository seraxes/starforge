'use client'

import { useCallback, useEffect, useRef } from 'react'

import { useAdminAutosaveDebounceMs } from './admin-autosave-context'

/**
 * Bind an existing <form action={…}> to autosave: discrete controls save now,
 * text fields debounce (Site Settings ms) and flush on blur **only when dirty**.
 *
 * Focus / click-into alone must not submit — match Layout cog dirty checks.
 */
export function useAutosaveForm(delayMs?: number) {
  const fromSettings = useAdminAutosaveDebounceMs()
  const ms = delayMs ?? fromSettings
  const formRef = useRef<HTMLFormElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** True after a real value edit until the next successful schedule flush / saveNow. */
  const dirtyRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Immediate submit (checkboxes/selects after a real change). Always submits. */
  const saveNow = useCallback(() => {
    clearTimer()
    dirtyRef.current = false
    formRef.current?.requestSubmit()
  }, [clearTimer])

  /** Debounced submit after a real text/value edit. */
  const saveDebounced = useCallback(() => {
    dirtyRef.current = true
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      dirtyRef.current = false
      formRef.current?.requestSubmit()
    }, ms)
  }, [clearTimer, ms])

  /**
   * Blur flush: only submit when something actually changed (pending debounce or dirty).
   * Mere focus → blur must be a no-op.
   */
  const flushOnBlur = useCallback(() => {
    if (!dirtyRef.current && !timerRef.current) return
    saveNow()
  }, [saveNow])

  /** Spread onto text/textarea/url/number inputs. */
  const textAutosaveProps = {
    onChange: saveDebounced,
    onBlur: flushOnBlur,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && event.currentTarget.tagName !== 'TEXTAREA') {
        event.preventDefault()
        event.currentTarget.blur()
      }
    },
  } as const

  /** Spread onto select/checkbox/radio. */
  const discreteAutosaveProps = {
    onChange: saveNow,
  } as const

  return {
    formRef,
    saveNow,
    saveDebounced,
    flushOnBlur,
    textAutosaveProps,
    discreteAutosaveProps,
  }
}
