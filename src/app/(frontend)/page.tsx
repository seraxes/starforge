import React from 'react'
import Link from 'next/link'

import { roleFromUser, userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { SignOutButton } from './sign-out-button'
import './styles.css'

export default async function HomePage() {
  const session = await getAppSession()
  const user = session?.user
  const role = user ? roleFromUser(user) : null
  const isAdmin = userIsAppAdmin(user)

  return (
    <div className="home">
      <div className="content">
        <p className="brand">Starforge</p>
        <h1>Core + content module scaffold</h1>
        <p className="lede">
          Product APIs and auth live in Starforge core. Payload CMS handles editorial
          content and media only.
        </p>

        <div className="clarity-callout" role="note">
          <p>
            <strong>/admin</strong> = CMS content (pages, media, editors).{' '}
            <strong>/login</strong> = app accounts. <strong>/app/admin/users</strong> = core
            user admin (roles). Separate systems — one login does not work in the other.
          </p>
        </div>

        <div className="session-bar" aria-live="polite">
          {user ? (
            <>
              <p className="session-status">
                Signed in as <strong>{user.name}</strong> ({user.email}
                {role ? <> · {role}</> : null})
              </p>
              <div className="links">
                {isAdmin ? (
                  <Link className="primary" href="/app/admin/users">
                    Core user admin
                  </Link>
                ) : null}
                <a className="secondary" href="/api/me">
                  View /api/me
                </a>
                <SignOutButton />
              </div>
            </>
          ) : (
            <>
              <p className="session-status">Not signed in (app account).</p>
              <div className="links">
                <Link className="primary" href="/register">
                  Register
                </Link>
                <Link className="secondary" href="/login">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="links muted-links">
          <a className="secondary" href="/admin">
            Open Payload admin (content)
          </a>
          <Link className="secondary" href="/about">
            Sample page /about
          </Link>
          <a className="secondary" href="/api/health">
            Core health API
          </a>
        </div>
      </div>
      <div className="footer">
        <p>
          Content: Payload <code>/admin</code> · App accounts: <code>/login</code> · Core
          admin: <code>/app/admin/users</code> · <code>npm run seed</code> · see README
        </p>
      </div>
    </div>
  )
}
