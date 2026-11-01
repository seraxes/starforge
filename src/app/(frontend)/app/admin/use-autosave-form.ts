'use client'

import { useCallback, useEffect, useRef } from 'react'

import { ADMIN_AUTOSAVE_DEBOUNCE_MS } from './use-debounced-persist'

/**
 * Bind an existing <form action={…}> to autosave: discrete controls save now,
 * text fields debounce (~500ms) and flush on blur.
 */
export function useAutosaveForm(delayMs: number = ADMIN_AUTOSAVE_DEBOUNCE_MS) {
  const formRef = useRef<HTMLFormElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    formRef.current?.requestSubmit()
  }, [])

  const saveDebounced = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      formRef.current?.requestSubmit()
    }, delayMs)
  }, [delayMs])

  /** Spread onto text/textarea/url/number inputs. */
  const textAutosaveProps = {
    onChange: saveDebounced,
    onBlur: saveNow,
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

  return { formRef, saveNow, saveDebounced, textAutosaveProps, discreteAutosaveProps }
}
