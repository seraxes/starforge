import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  promoteSessionUserIfBootstrapAdmin,
  roleFromUser,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'

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

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="brand">
            <Link href="/">Starforge</Link>
          </p>
          <h1>Core admin</h1>
          <p className="lede admin-lede">
            App users, roles, CMS access toggles, and site settings. One Better Auth login —
            open <Link href="/admin">/admin</Link> with no second password when CMS access is on
            (see <Link href="/app/admin/cms">CMS access</Link>).
          </p>
        </div>
        <p className="admin-who">
          Signed in as <strong>{session.user.email}</strong> ({role})
        </p>
      </header>
      <nav className="admin-nav" aria-label="Core admin">
        <Link href="/app/admin/users">Users</Link>
        <Link href="/app/admin/settings">Site settings</Link>
        <Link href="/app/admin/cms">CMS access</Link>
        <Link href="/admin">Open Payload CMS</Link>
        <Link href="/">Back to home</Link>
      </nav>
      <div className="admin-main">{props.children}</div>
    </div>
  )
}
