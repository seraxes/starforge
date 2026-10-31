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

export const metadata = {
  title: 'Core admin — Starforge',
  description: 'Starforge app-user admin (not Payload CMS).',
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
  const showPayloadCms = userHasCmsAccess(access)

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="brand">
            <Link href="/">Starforge</Link>
          </p>
          <h1>Core admin</h1>
          <p className="lede admin-lede">
            App users, roles, and site settings. One Better Auth login — with CMS access on
            (toggle under Users), <Link href="/admin">Payload CMS</Link> opens with no second
            password.
          </p>
        </div>
        <p className="admin-who">
          Signed in as <strong>{session.user.email}</strong> ({role})
        </p>
      </header>
      <nav className="admin-nav" aria-label="Core admin">
        <Link href="/app/admin/users">Users</Link>
        <Link href="/app/admin/settings">Site settings</Link>
        {showPayloadCms ? <Link href="/admin">Payload CMS</Link> : null}
        <Link href="/">Back to home</Link>
      </nav>
      <div className="admin-main">{props.children}</div>
    </div>
  )
}
