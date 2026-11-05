import { adminNavContributions } from '@/generated/module-registry'
import type { SiteSettingsData } from '@/core/settings/defaults'
import { isCatalogModuleEnabled } from '@/core/settings/module-catalog'

/**
 * Module ids whose manifest `admin.nav` / `admin.navGroup` should appear in the
 * shared admin sidebar. Derived from generated contributions + Site Settings
 * catalog toggles — do not hand-maintain Forms/Email/Media lists in layouts.
 */
export function resolveEnabledAdminNavModuleIds(
  settings: SiteSettingsData,
): Set<string> {
  const enabled = new Set<string>()
  for (const entry of adminNavContributions) {
    if (isCatalogModuleEnabled(settings, entry.moduleId)) {
      enabled.add(entry.moduleId)
    }
  }
  return enabled
}
