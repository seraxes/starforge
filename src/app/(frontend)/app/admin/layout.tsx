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
  const showPayloadCms = payloadOn && userHasCmsAccess(access)
  const showLayoutsNav = layoutOn || pageSettingsOn

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="brand">
            <Link href="/">Starforge</Link>
          </p>
          <h1>Starforge admin</h1>
          <p className="lede admin-lede">
            Top-level areas: Users (accounts + groups), Site settings, Nav, Layouts. Content
            (pages, media) lives in{' '}
            {showPayloadCms ? <Link href="/admin">Payload CMS</Link> : 'Payload CMS'} — same login
            when CMS access is on.
          </p>
        </div>
        <p className="admin-who">
          Signed in as <strong>{session.user.email}</strong> ({role})
        </p>
      </header>
      <nav className="admin-nav" aria-label="Starforge admin">
        <div className="admin-nav-dropdown">
          <Link href="/app/admin/users" className="admin-nav-dropdown-trigger">
            Users
            <span className="admin-nav-dropdown-caret" aria-hidden="true">
              ▾
            </span>
          </Link>
          <ul className="admin-nav-dropdown-menu" aria-label="Users submenu">
            <li>
              <Link href="/app/admin/users">Accounts</Link>
            </li>
            <li>
              <Link href="/app/admin/users/groups">Groups</Link>
            </li>
            <li>
              <Link href="/app/admin/users/acl">ACL</Link>
            </li>
          </ul>
        </div>
        <Link href="/app/admin/settings">Site settings</Link>
        {navOn ? <Link href="/app/admin/nav">Nav</Link> : null}
        {showLayoutsNav ? (
          <div className="admin-nav-dropdown">
            <Link
              href={layoutOn ? '/app/admin/layouts' : '/app/admin/page-settings'}
              className="admin-nav-dropdown-trigger"
            >
              Layouts
              <span className="admin-nav-dropdown-caret" aria-hidden="true">
                ▾
              </span>
            </Link>
            <ul className="admin-nav-dropdown-menu" aria-label="Layouts submenu">
              {layoutOn ? (
                <>
                  <li>
                    <Link href="/app/admin/layouts">Layout</Link>
                  </li>
                  <li>
                    <Link href="/app/admin/outlines">Outlines</Link>
                  </li>
                </>
              ) : null}
              {pageSettingsOn ? (
                <li>
                  <Link href="/app/admin/page-settings">Page settings</Link>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {showPayloadCms ? <Link href="/admin">Payload CMS</Link> : null}
        <Link href="/">Back to site</Link>
      </nav>
      <div className="admin-main">{props.children}</div>
    </div>
  )
}
