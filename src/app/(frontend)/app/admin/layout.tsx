import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { roleFromUser, userIsAppAdmin } from '@/core/auth/admin'
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
  if (!userIsAppAdmin(session.user)) {
    // Signed-in members must not loop through /login?next=…
    redirect('/')
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
            App users and roles live here. Payload <Link href="/admin">/admin</Link> is still a
            separate CMS editor login — global-admin → CMS bridge is a follow-up.
          </p>
        </div>
        <p className="admin-who">
          Signed in as <strong>{session.user.email}</strong> ({role})
        </p>
      </header>
      <nav className="admin-nav" aria-label="Core admin">
        <Link href="/app/admin/users">Users</Link>
        <Link href="/">Back to home</Link>
        <Link href="/admin">Payload CMS</Link>
      </nav>
      <div className="admin-main">{props.children}</div>
    </div>
  )
}
