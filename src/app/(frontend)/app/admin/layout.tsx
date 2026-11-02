import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import { buildAdminNavGroups } from '@/core/admin-nav'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  promoteSessionUserIfBootstrapAdmin,
  roleFromUser,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { loadCoreUserCmsAccess, userHasCmsAccess } from '@/core/cms-bridge'
import {
  MODULE_IDS,
  getSiteSettings,
  isCatalogModuleEnabled,
} from '@/core/settings'

import { AdminAutosaveProvider } from './admin-autosave-context'
import { AdminToastProvider } from './admin-toast'

export const metadata = {
  title: 'Starforge admin',
  description:
    'Starforge / App admin — users, site settings, nav, layouts, page settings (not Content CMS).',
}

export default async function CoreAdminLayout(props: { children: React.ReactNode }) {
  const session = await getAppSession()
  if (!session?.user) {
    redirect('/login?next=/app/admin/users')
  }

  // STARFORGE_ADMIN_EMAILS: promote matching member → admin on this request.
  await promoteSessionUserIfBootstrapAdmin(session.user)

  if (!userIsAppAdmin(session.user)) {
    // Expected for members — not a bug. Flash on home explains how to get admin.
    redirect('/?notice=admins-only')
  }

  const role = roleFromUser(session.user)
  const access = session.user.id ? await loadCoreUserCmsAccess(session.user.id) : null
  const settings = await getSiteSettings()
  const payloadOn = isCatalogModuleEnabled(settings, MODULE_IDS.payloadCms)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const navOn = isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)
  const formsOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  const showPayloadCms = payloadOn && userHasCmsAccess(access)
  const theme = getActiveAdminTheme()

  const groups = buildAdminNavGroups({
    surface: 'core',
    flags: {
      nav: navOn,
      forms: formsOn,
      layout: layoutOn,
      pageSettings: pageSettingsOn,
      cms: showPayloadCms,
    },
  })

  return (
    <AdminToastProvider>
      <AdminAutosaveProvider delayMs={settings.adminAutosaveDebounceMs}>
        <div
          className="admin-shell"
          data-sf-admin-theme={theme.dataAttr}
        >
          <AdminSidebarNav
            groups={groups}
            brand={
              <>
                <p className="brand">
                  <Link href="/">Starforge</Link>
                </p>
                <p className="admin-sidebar-title">Starforge admin</p>
              </>
            }
            who={
              <p className="admin-who">
                Signed in as <strong>{session.user.email}</strong> ({role})
              </p>
            }
          />
          <div className="admin-body">
            <header className="admin-header">
              <div>
                <h1>Starforge admin</h1>
                <p className="lede admin-lede">
                  Top-level areas: Site Chrome, Site Settings (Modules · Admin UX · Auth ·
                  Integrations · Performance), Navigation, Forms, Users (Accounts · Groups · ACL),
                  Media, Layouts, CMS (Payload). Pages live under CMS → Pages
                  {showPayloadCms ? (
                    <>
                      {' '}
                      (<Link href="/admin/collections/pages">open</Link>)
                    </>
                  ) : null}
                  ; media library is under <Link href="/app/admin/media">Media</Link> (same Payload
                  store) — same login when CMS access is on.
                </p>
              </div>
            </header>
            <div className="admin-main">{props.children}</div>
          </div>
        </div>
      </AdminAutosaveProvider>
    </AdminToastProvider>
  )
}
