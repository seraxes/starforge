import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
import { AdminSidebarNav, type AdminSidebarGroup } from './admin-sidebar-nav'
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
  const showLayoutsNav = layoutOn || pageSettingsOn

  const groups: AdminSidebarGroup[] = [
    {
      id: 'site-chrome',
      label: 'Site Chrome',
      links: [{ href: '/app/admin/site-chrome', label: 'Site Chrome' }],
    },
    {
      id: 'site-settings',
      label: 'Site Settings',
      links: [{ href: '/app/admin/settings', label: 'Site Settings' }],
    },
  ]

  if (navOn) {
    groups.push({
      id: 'navigation',
      label: 'Navigation',
      links: [{ href: '/app/admin/nav', label: 'Navigation' }],
    })
  }

  if (formsOn) {
    groups.push({
      id: 'forms',
      label: 'Forms',
      links: [{ href: '/app/admin/forms', label: 'Forms' }],
    })
  }

  groups.push({
    id: 'users',
    label: 'Users',
    href: '/app/admin/users',
    links: [
      { href: '/app/admin/users', label: 'Accounts', exact: true },
      { href: '/app/admin/users/groups', label: 'Groups' },
      { href: '/app/admin/users/acl', label: 'ACL' },
    ],
  })

  if (showLayoutsNav) {
    const layoutLinks: AdminSidebarGroup['links'] = []
    if (layoutOn) {
      layoutLinks.push(
        { href: '/app/admin/layouts', label: 'Layout' },
        { href: '/app/admin/breakpoints', label: 'Styles' },
        { href: '/app/admin/particle-defaults', label: 'Particle Defaults' },
        { href: '/app/admin/outlines', label: 'Outlines' },
      )
    }
    if (pageSettingsOn) {
      layoutLinks.push({ href: '/app/admin/page-settings', label: 'Page settings' })
    }
    groups.push({
      id: 'layouts',
      label: 'Layouts',
      href: layoutOn ? '/app/admin/layouts' : '/app/admin/page-settings',
      links: layoutLinks,
    })
  }

  if (showPayloadCms) {
    groups.push({
      id: 'cms',
      label: 'CMS',
      links: [{ href: '/admin', label: 'CMS', external: true }],
    })
  }

  groups.push({
    id: 'check-site',
    label: 'Check site',
    links: [{ href: '/', label: 'Check site', exact: true }],
  })

  return (
    <AdminToastProvider>
      <AdminAutosaveProvider delayMs={settings.adminAutosaveDebounceMs}>
        <div className="admin-shell" data-sf-admin-theme="dark">
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
                  Top-level areas: Site Chrome, Site Settings (Modules), Navigation, Forms, Users
                  (Accounts · Groups · ACL), Layouts, CMS. Content (pages, media) lives in{' '}
                  {showPayloadCms ? <Link href="/admin">CMS</Link> : 'CMS'} — same login when CMS
                  access is on.
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
