import 'server-only'

import { requireAdminArea } from '@/core/acl/access'
import type { AclGrantLevel } from '@/core/acl/levels'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

/** App admin, a group grant for admin.pages, or cms_access (stored as manage). */
export async function requirePagesEditor(
  min: AclGrantLevel = 'edit',
): Promise<{ userId: string } | { error: string }> {
  const session = await requireAdminArea('admin.pages', min)
  const userId = session?.user?.id?.trim()
  if (!userId) {
    return { error: 'Sign in as an app admin or with CMS access to edit pages.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pages)) {
    return { error: 'Pages module is disabled. Enable it under Settings → Modules.' }
  }
  return { userId }
}
