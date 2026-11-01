'use client'

import React, { useEffect, useId, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onSfTurnstileLoad?: () => void
  }
}

const SCRIPT_ID = 'sf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onSfTurnstileLoad'

type Props = {
  siteKey: string
  /** Hidden input name expected by the server action. */
  responseFieldName?: string
}

/**
 * Explicit Turnstile widget — loads CF script once, renders into a host div,
 * writes the token into a hidden input for the parent form.
 */
export function TurnstileWidget({
  siteKey,
  responseFieldName = 'cf-turnstile-response',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const reactId = useId()

  useEffect(() => {
    let cancelled = false

    const renderWidget = () => {
      if (cancelled || !hostRef.current || !window.turnstile) return
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore
        }
        widgetIdRef.current = null
      }
      hostRef.current.innerHTML = ''
      widgetIdRef.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          if (inputRef.current) inputRef.current.value = token
        },
        'expired-callback': () => {
          if (inputRef.current) inputRef.current.value = ''
        },
        'error-callback': () => {
          if (inputRef.current) inputRef.current.value = ''
        },
        theme: 'auto',
      })
    }

    const prev = window.onSfTurnstileLoad
    window.onSfTurnstileLoad = () => {
      prev?.()
      renderWidget()
    }

    if (window.turnstile) {
      renderWidget()
    } else if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      window.onSfTurnstileLoad = prev
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore
        }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, reactId])

  return (
    <div className="sf-form-captcha" data-sf-captcha="turnstile">
      <input ref={inputRef} type="hidden" name={responseFieldName} defaultValue="" />
      <div ref={hostRef} />
    </div>
  )
}
