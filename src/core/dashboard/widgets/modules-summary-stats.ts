import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import { summarizeModuleCatalog, type ModuleSummaryCounts } from './modules-summary'

export type { ModuleSummaryCounts } from './modules-summary'

export async function loadModulesSummaryStats(): Promise<
  DashboardStatsResult<ModuleSummaryCounts>
> {
  try {
    const { getSiteSettings, isCatalogModuleEnabled, listInstalledModuleCatalog } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    const catalog = listInstalledModuleCatalog()
    return {
      ok: true,
      data: summarizeModuleCatalog(
        catalog.map((item) => ({
          enabled: isCatalogModuleEnabled(settings, item.id),
        })),
      ),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Modules summary failed'
    console.error('[dashboard] modules.summary stats failed', error)
    return { ok: false, error: message, status: 'error' }
  }
}
