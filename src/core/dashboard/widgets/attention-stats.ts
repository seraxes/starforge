import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'
import { userIsDeveloperAdmin } from '@/core/auth/developer-admin'
import { getAppSession } from '@/core/auth/session'
import { validateStarforgeEnv } from '@/core/env/validate'

import {
  buildCoreAttentionItems,
  visibleEnvWarnings,
  type AttentionItem,
} from './attention'
import { loadSystemHealthStats } from './system-health-stats'

export type AttentionRailStats = {
  items: AttentionItem[]
}

export async function loadAttentionRailStats(): Promise<DashboardStatsResult<AttentionRailStats>> {
  const health = await loadSystemHealthStats()

  let siteOffline: boolean | null = null
  let mailerEnabled: boolean | null = null
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()
    siteOffline = chrome.offlineEnabled
    mailerEnabled = chrome.emailEnabled
  } catch (error) {
    console.error('[dashboard] attention.rail chrome read failed', error)
  }

  let envWarnings: ReturnType<typeof visibleEnvWarnings> = null
  try {
    const session = await getAppSession()
    const isDev = userIsDeveloperAdmin(session?.user)
    envWarnings = visibleEnvWarnings(isDev, validateStarforgeEnv().warnings)
  } catch (error) {
    console.error('[dashboard] attention.rail env warnings skipped', error)
    envWarnings = null
  }

  return {
    ok: true,
    data: {
      items: buildCoreAttentionItems({
        siteOffline,
        mailerEnabled,
        healthLevel: health.ok ? health.data.level : 'fail',
        envWarnings,
      }),
    },
  }
}
