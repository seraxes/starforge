'use client'

import { useEffect } from 'react'

const SW_PATH = '/sw.js'

/**
 * Registers Serwist-built `/sw.js` on the public site (production only).
 * Auto-registration is disabled in next.config so the module toggle owns lifecycle.
 */
export function PwaRegisterClient() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

    void navigator.serviceWorker
      .register(SW_PATH, { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => {
        if (cancelled) return
        console.warn('[product:pwa] service worker registration failed', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
