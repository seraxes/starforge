import React from 'react'
import Link from 'next/link'

import {
  promoteSessionUserIfBootstrapAdmin,
  roleFromUser,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'
import { SignOutButton } from './sign-out-button'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  const user = session?.user
  let role = user ? roleFromUser(user) : null
  if (user) {
    // Persist STARFORGE_ADMIN_EMAILS → admin even when the session cookie still says member.
    const promoted = await promoteSessionUserIfBootstrapAdmin(user)
    if (promoted) role = 'admin'
  }
  const isAdmin = userIsAppAdmin(user) || role === 'admin'
  const showAdminsOnly = params.notice === 'admins-only'
  const registrationOn = settings.features.registration

  return (
    <div className="home">
      <div className="content">
        <p className="brand">{settings.siteName}</p>
        <h1>Core + content module scaffold</h1>
        <p className="lede">
          Product APIs and auth live in Starforge core. Payload CMS handles editorial
          content and media only.
        </p>

        {showAdminsOnly ? (
          <div className="notice-banner" role="status">
            <p>
              <strong>Admins only.</strong> <code>/app/admin/*</code> is for core app role{' '}
              <code>admin</code>. Members are redirected here on purpose.
            </p>
            <p>
              Sign in as the seed admin <code>admin@starforge.local</code> /{' '}
              <code>starforge-admin</code> (after <code>npm run seed</code>), or set{' '}
              <code>STARFORGE_ADMIN_EMAILS=you@example.com</code> in <code>.env</code>, restart{' '}
              <code>npm run dev</code>, and reload — that email is promoted to admin on the next
              request.
            </p>
          </div>
        ) : null}

        {params.notice === 'cms-denied' ? (
          <div className="notice-banner" role="status">
            <p>
              <strong>No CMS access.</strong> Payload <code>/admin</code> requires the{' '}
              <code>cms_access</code> flag (admins get it by default). Ask a core admin to turn it
              on under <Link href="/app/admin/users">Users</Link>, or sign in as the seed admin.
            </p>
          </div>
        ) : null}

        <div className="clarity-callout" role="note">
          <p>
            <strong>One login:</strong> <code>/login</code> (Better Auth). With CMS access on,{' '}
            <strong>/admin</strong> opens with no second password. <strong>/app/admin</strong> =
            core users, CMS toggles, and feature settings (<code>admin</code> only). Ordinary
            members stay in core — never bulk-synced into Payload.
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
                  <>
                    <Link className="primary" href="/app/admin/users">
                      Core user admin
                    </Link>
                    <Link className="secondary" href="/app/admin/settings">
                      Site settings
                    </Link>
                    <Link className="secondary" href="/app/admin/cms">
                      CMS access
                    </Link>
                  </>
                ) : null}
                <Link className="secondary" href="/api/me">
                  View /api/me
                </Link>
                <SignOutButton />
              </div>
            </>
          ) : (
            <>
              <p className="session-status">Not signed in (app account).</p>
              <div className="links">
                {registrationOn ? (
                  <Link className="primary" href="/register">
                    Register
                  </Link>
                ) : null}
                <Link className={registrationOn ? 'secondary' : 'primary'} href="/login">
                  Sign in
                </Link>
              </div>
              {!registrationOn ? (
                <p className="session-hint">
                  Registration is off (feature toggle). Sign in with an existing app account, or
                  ask a core admin to enable it under Site settings.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="links muted-links">
          <Link className="secondary" href="/admin">
            Open Payload admin (content)
          </Link>
          <Link className="secondary" href="/about">
            Sample page /about
          </Link>
          <Link className="secondary" href="/api/health">
            Core health API
          </Link>
        </div>
      </div>
      <div className="footer">
        <p>
          One login: <code>/login</code> → <code>/admin</code> (cms_access) · Core admin:{' '}
          <code>/app/admin</code> · seed: <code>admin@starforge.local</code> /{' '}
          <code>starforge-admin</code> · <code>npm run seed</code> · see README
        </p>
      </div>
    </div>
  )
}
