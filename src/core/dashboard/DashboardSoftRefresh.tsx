'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { clampDashboardRefreshIntervalSec } from '@/core/settings/defaults'

import {
  dashboardRefreshIntervalMs,
  formatDashboardRefreshedAt,
  shouldRefreshOnBecomeVisible,
} from './soft-refresh'

type Props = {
  /** Site Settings → Performance `dashboardRefreshIntervalSec` (15–600). */
  intervalSec: number
  /** ISO timestamp from the initial SSR render. */
  initialRefreshedAt: string
}

/**
 * D4: soft-refresh `/admin` via `router.refresh()` on the Performance interval.
 * Pauses while the tab is hidden; refreshes immediately on become-visible when overdue.
 * Owns the “Last refreshed” line so the label updates with each poll.
 */
export function DashboardSoftRefresh({ intervalSec, initialRefreshedAt }: Props) {
  const router = useRouter()
  const clampedSec = clampDashboardRefreshIntervalSec(intervalSec)
  const [refreshedAt, setRefreshedAt] = useState(() => new Date(initialRefreshedAt))
  // Prefer the SSR ISO; fall back to 0 so become-visible treats the first show as overdue.
  const parsedInitialMs = Date.parse(initialRefreshedAt)
  const lastRefreshAtMs = useRef(Number.isFinite(parsedInitialMs) ? parsedInitialMs : 0)

  useEffect(() => {
    const intervalMs = dashboardRefreshIntervalMs(clampedSec)
    let timer: ReturnType<typeof setInterval> | null = null

    const refresh = () => {
      const now = new Date()
      lastRefreshAtMs.current = now.getTime()
      setRefreshedAt(now)
      router.refresh()
    }

    const start = () => {
      if (timer != null) return
      timer = setInterval(refresh, intervalMs)
    }

    const stop = () => {
      if (timer == null) return
      clearInterval(timer)
      timer = null
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
        return
      }
      const elapsed = Date.now() - lastRefreshAtMs.current
      if (shouldRefreshOnBecomeVisible(elapsed, intervalMs)) {
        refresh()
      }
      start()
    }

    if (typeof document !== 'undefined' && !document.hidden) {
      start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clampedSec, router])

  return (
    <p className="sf-dashboard-refreshed">
      Last refreshed{' '}
      <time dateTime={refreshedAt.toISOString()}>{formatDashboardRefreshedAt(refreshedAt)}</time>
      <span className="sf-dashboard-stat-hint">
        {' '}
        · refresh interval {clampedSec}s (Settings → Performance)
      </span>
    </p>
  )
}
