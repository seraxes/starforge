import 'server-only'

import { getAdminSession } from '@/core/auth/admin-session'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import type { AdminAuditInput, AdminAuditTarget } from './entries'
import { recordAdminAudit } from './record'

/**
 * Company activity row. No-ops while product:audit is off.
 * Failures are logged and do not fail the change that already succeeded.
 * Never pass secrets, passwords, or free-text notes.
 */
export async function recordOptionalAudit(input: AdminAuditInput): Promise<void> {
  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.audit)) return
    await recordAdminAudit(input)
  } catch (error) {
    console.error(
      '[audit] optional row skipped',
      error instanceof Error ? error.name : 'error',
    )
  }
}

/** Same as `recordOptionalAudit`, using the current admin session as the actor. */
export async function recordCurrentAdminActivity(
  action: string,
  target: AdminAuditTarget,
): Promise<void> {
  const session = await getAdminSession()
  const actorId = session?.user?.id?.trim()
  if (!actorId) return
  await recordOptionalAudit({ actorId, action, target })
}
