import 'server-only'

import { getAdminAccessViewer, listViewerAdminLevels } from '@/core/acl/access'
import { aclLevelSatisfies } from '@/core/acl/levels'
import {
  promoteSessionUserIfBootstrapAdmin,
  userIsAppAdmin,
  userIsDeveloperAdmin,
} from '@/core/auth/admin'
import { getAdminSession } from '@/core/auth/admin-session'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

export type AuditLogReader = {
  userId: string
  /** True when product:audit is on and the company reader is available. */
  company: boolean
}

/**
 * Who may open `/admin/audit`.
 * Pack off: developer-admin only (host security log).
 * Pack on: app admin, or a group with at least view on `admin.audit`.
 */
export async function requireAuditLogReader(): Promise<AuditLogReader | null> {
  const session = await getAdminSession()
  if (!session?.user?.id) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)
  const userId = session.user.id.trim()
  if (!userId) return null

  const settings = await getSiteSettings()
  const company = isCatalogModuleEnabled(settings, MODULE_IDS.audit)
  if (!company) {
    if (!userIsDeveloperAdmin(session.user)) return null
    return { userId, company: false }
  }
  if (userIsAppAdmin(session.user)) return { userId, company: true }

  const viewer = await getAdminAccessViewer()
  const levels = await listViewerAdminLevels(viewer)
  if (!aclLevelSatisfies(levels.get('admin.audit') ?? null, 'view')) return null
  return { userId, company: true }
}
