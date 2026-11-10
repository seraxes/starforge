import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import { assembleChromePosture, type ChromePostureRow } from './chrome-posture'

export type ChromePostureStats = {
  rows: ChromePostureRow[]
}

export async function loadChromePostureStats(): Promise<
  DashboardStatsResult<ChromePostureStats>
> {
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()
    return {
      ok: true,
      data: {
        rows: assembleChromePosture({
          offlineEnabled: chrome.offlineEnabled,
          robotsMeta: chrome.robotsMeta,
          robotsTxt: chrome.robotsTxt,
          captchaEnabled: chrome.captchaEnabled,
          captchaProvider: chrome.captchaProvider,
        }),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chrome posture glance failed'
    console.error('[dashboard] chrome.posture stats failed', error)
    return { ok: false, error: message, status: 'error' }
  }
}
