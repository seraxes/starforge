import { adminDashboardContributions } from '@/generated/module-registry'
import type { AclAdminResourceKey } from '@/core/acl/types'

import type { DashboardWidgetSize, ResolvedDashboardWidget } from './types'

export type ResolveDashboardWidgetsOptions = {
  /**
   * Module ids with Site Settings toggle on (or required).
   * When provided, widgets from other modules still resolve but with
   * `moduleEnabled: false` (soft “Module disabled” shell). Omit / null → all on.
   */
  enabledModuleIds?: ReadonlySet<string> | readonly string[] | null
  /**
   * When set, drop widgets whose `area` maps to an ACL resource the viewer
   * lacks. App admins pass `null` (no filter). Omit area → `admin.dashboard`.
   */
  allowedAreas?: ReadonlySet<AclAdminResourceKey> | null
}

function asEnabledSet(
  enabledModuleIds: ResolveDashboardWidgetsOptions['enabledModuleIds'],
): ReadonlySet<string> | null {
  if (!enabledModuleIds) return null
  return enabledModuleIds instanceof Set ? enabledModuleIds : new Set(enabledModuleIds)
}

/** Map manifest `area` (short or full) → ACL resource key. */
export function dashboardAreaToAclKey(area: string | undefined): AclAdminResourceKey {
  const raw = (area ?? 'dashboard').trim()
  if (!raw) return 'admin.dashboard'
  if (raw.startsWith('admin.')) return raw as AclAdminResourceKey
  return `admin.${raw}` as AclAdminResourceKey
}

function normalizeSize(size: string | undefined): DashboardWidgetSize {
  if (size === 'sm' || size === 'md' || size === 'lg') return size
  return 'md'
}

/**
 * Merge generated `admin.dashboard[]` contributions — ACL filter + soft
 * module-off shells. No product `if (flags.media)` in Core UI.
 *
 * Module toggle off → card still resolves with `moduleEnabled: false` so the
 * host can show “Module disabled” instead of hiding into empty padded gaps.
 * Pass `enabledModuleIds: null` / omit to treat every contribution as enabled.
 */
export function resolveDashboardWidgets(
  options: ResolveDashboardWidgetsOptions = {},
): ResolvedDashboardWidget[] {
  const enabled = asEnabledSet(options.enabledModuleIds)
  const allowed = options.allowedAreas

  return adminDashboardContributions
    .filter((entry) => {
      if (allowed == null) return true
      const key = dashboardAreaToAclKey(entry.area)
      return allowed.has(key)
    })
    .slice()
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.id.localeCompare(b.id) ||
        a.moduleId.localeCompare(b.moduleId),
    )
    .map((entry) => ({
      moduleId: entry.moduleId,
      id: entry.id,
      title: entry.title,
      order: entry.order,
      size: normalizeSize(entry.size),
      moduleEnabled: enabled ? enabled.has(entry.moduleId) : true,
      ...(entry.area ? { area: entry.area } : {}),
    }))
}

/** Module ids that contribute dashboard widgets and are catalog-enabled. */
export function resolveEnabledDashboardModuleIds(
  isModuleEnabled: (moduleId: string) => boolean,
): Set<string> {
  const enabled = new Set<string>()
  for (const entry of adminDashboardContributions) {
    if (isModuleEnabled(entry.moduleId)) enabled.add(entry.moduleId)
  }
  return enabled
}
