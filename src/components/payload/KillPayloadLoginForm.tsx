'use client'

import { useEffect } from 'react'

import { PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'

/**
 * If Payload's LoginForm somehow mounts, immediately leave.
 * Middleware + login view override should prevent this; this is a safety net.
 */
export default function KillPayloadLoginForm() {
  useEffect(() => {
    const path = window.location.pathname
    const exchange = `/api/cms/exchange?next=${PAYLOAD_ADMIN_BASE}`
    if (path.startsWith(`${PAYLOAD_ADMIN_BASE}/login`) || path.includes('/create-first-user')) {
      window.location.replace(exchange)
      return
    }
    // Detect stock login form fields if they appear on any admin route.
    const password = document.querySelector('input[type="password"]')
    const email =
      document.querySelector('input[name="email"]') ||
      document.querySelector('input[type="email"]')
    if (password && email) {
      window.location.replace(exchange)
    }
  }, [])

  return null
}
