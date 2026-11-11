import React from 'react'
import { redirect } from 'next/navigation'

/* Active admin theme (port): load here — not on the public root layout — so
 * visitors do not download admin chrome CSS. Nested @import via active-core.css
 * was unreliable in Next/Turbopack; sheets come from ADMIN_THEME_CSS_SHEETS. */
import '@/core/admin-theme/import-active-core-chrome'

import { AdminSidebarAccount } from '@/components/admin/AdminSidebarAccount'
import { AdminSidebarBrand } from '@/components/admin/AdminSidebarBrand'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import {
  buildAdminNavGroups,
  resolveEnabledAdminNavModuleIds,
} from '@/core/admin-nav'
import type { AdminNavGroup } from '@/core/admin-nav'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  adminHrefAllowed,
  ensureManagersDashboardAcl,
  ensureManagersLocalizationAcl,
  getAccessViewer,
  requireAdminAreaForRequest,
  viewerMayEnterAdminShell,
  type AclAdminResourceKey,
} from '@/core/acl'
import {
  promoteSessionUserIfBootstrapAdmin,
  roleFromUser,
  userIsDeveloperAdmin,
} from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { loadCoreUserCmsAccess, userHasCmsAccess } from '@/core/cms-bridge'
import {
  MODULE_IDS,
  ensureSiteSettingsDefaults,
  isCatalogModuleEnabled,
} from '@/core/settings'

import { AdminAutosaveProvider } from './admin-autosave-context'
import { AdminToastProvider } from './admin-toast'

export const metadata = {
  title: 'Starforge admin',
  description:
    'Starforge admin — Dashboard home at /admin; users, site settings, nav, layouts (Payload CMS at /cms/admin).',
}

function filterNavLinkByAcl(
  link: AdminNavGroup['links'][number],
  allowed: ReadonlySet<AclAdminResourceKey>,
): AdminNavGroup['links'][number][] {
  const children = (link.children ?? []).flatMap((child) =>
    filterNavLinkByAcl(child, allowed),
  )
  const selfAllowed = adminHrefAllowed(link.href, false, allowed)
  if (selfAllowed) {
    return [
      children.length > 0 ? { ...link, children } : { ...link, children: undefined },
    ]
  }
  // Parent blocked — promote any allowed nested leaves.
  return children
}

function filterNavByAcl(
  groups: AdminNavGroup[],
  isAppAdmin: boolean,
  allowed: ReadonlySet<AclAdminResourceKey>,
): AdminNavGroup[] {
  if (isAppAdmin) return groups
  return groups
    .map((group) => {
      const links = group.links.flatMap((link) => filterNavLinkByAcl(link, allowed))
      if (links.length === 0) return null
      if (group.href && !adminHrefAllowed(group.href, false, allowed)) {
        const { href: _unused, ...rest } = group
        void _unused
        return { ...rest, links }
      }
      return { ...group, links }
    })
    .filter((g): g is AdminNavGroup => g != null)
}

export default async function CoreAdminLayout(props: { children: React.ReactNode }) {
  const session = await getAppSession()
  if (!session?.user) {
    redirect('/login?next=/admin')
  }

  // STARFORGE_ADMIN_EMAILS: promote matching member → admin on this request.
  await promoteSessionUserIfBootstrapAdmin(session.user)

  // Heal Managers ACL so /admin (Dashboard) works after upgrades from pre-D0 seeds.
  await ensureManagersDashboardAcl().catch(() => undefined)
  // Localization left Chrome — Managers with Chrome also get Localization.
  await ensureManagersLocalizationAcl().catch(() => undefined)

  const viewer = await getAccessViewer()
  if (!(await viewerMayEnterAdminShell(viewer))) {
    redirect('/?notice=admins-only')
  }

  const gated = await requireAdminAreaForRequest()
  if (!gated) {
    redirect('/?notice=admins-only')
  }

  const role = roleFromUser(session.user)
  const access = session.user.id ? await loadCoreUserCmsAccess(session.user.id) : null
  // ensure* backfills newly allowlisted defaultEnabled packs (e.g. Email Manager)
  // into moduleToggles so upgrades do not need a SQL edit.
  const settings = await ensureSiteSettingsDefaults()
  const payloadOn = isCatalogModuleEnabled(settings, MODULE_IDS.payloadCms)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const navOn = isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)
  const showPayloadCms = payloadOn && userHasCmsAccess(access)
  const theme = getActiveAdminTheme()
  // Forms / Email / Redirects / Media — derived from manifest contributions + catalog toggles.
  const enabledModuleIds = resolveEnabledAdminNavModuleIds(settings)

  const groups = filterNavByAcl(
    buildAdminNavGroups({
      surface: 'core',
      flags: {
        nav: navOn,
        layout: layoutOn,
        pageSettings: pageSettingsOn,
        cms: showPayloadCms,
      },
      enabledModuleIds,
      developerAdmin: userIsDeveloperAdmin(session.user),
    }),
    viewer.isAppAdmin,
    gated.allowed,
  )

  return (
    <AdminToastProvider>
      <AdminAutosaveProvider delayMs={settings.adminAutosaveDebounceMs}>
        <div
          className="admin-shell"
          data-sf-admin-theme={theme.dataAttr}
        >
          <AdminSidebarNav
            groups={groups}
            brand={<AdminSidebarBrand surface="core" />}
            who={
              <AdminSidebarAccount
                userId={session.user.id}
                email={session.user.email}
                name={session.user.name}
                image={
                  'image' in session.user && typeof session.user.image === 'string'
                    ? session.user.image
                    : null
                }
                role={role}
              />
            }
          />
          <div className="admin-body">
            <div className="admin-main">{props.children}</div>
          </div>
        </div>
      </AdminAutosaveProvider>
    </AdminToastProvider>
  )
}
