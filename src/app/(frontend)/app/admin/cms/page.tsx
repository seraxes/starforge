import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import {
  findPayloadCmsUserByCoreUserId,
  loadCoreUserCmsAccess,
} from '@/core/cms-bridge'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'CMS access — Starforge',
  description: 'One login: Better Auth opens Payload /admin when CMS access is on.',
}

export default async function AdminCmsBridgePage() {
  const session = await requireAppAdmin()
  if (!session?.user?.id || !session.user.email) {
    redirect('/login?next=/app/admin/cms')
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  const linked = await findPayloadCmsUserByCoreUserId(session.user.id)
  const email = session.user.email.trim().toLowerCase()
  const hasCms = Boolean(access?.cmsAccess)

  return (
    <section className="admin-section">
      <h2>Payload CMS access</h2>
      <p className="lede admin-lede">
        <strong>One login only.</strong> Sign in with Better Auth at <Link href="/login">/login</Link>.
        If CMS access is on, open <Link href="/admin">/admin</Link> — no second email/password.
        Toggle CMS access per user under <Link href="/app/admin/users">Users</Link>. Global admins
        get it by default; members stay in core unless you turn CMS access on for them.
      </p>

      <dl className="cms-bridge-meta">
        <div>
          <dt>Your app email</dt>
          <dd>
            <code>{email}</code>
          </dd>
        </div>
        <div>
          <dt>CMS access</dt>
          <dd>
            {hasCms ? (
              <span className="admin-badge">On</span>
            ) : (
              <span className="admin-badge-warn">Off</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Payload stub linked</dt>
          <dd>
            {linked ? (
              <span className="admin-badge">Yes</span>
            ) : (
              <span className="admin-badge-warn">Not yet (opens on first /admin visit)</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="cms-bridge-panel">
        <div className="cms-bridge-actions">
          {hasCms ? (
            <Link className="primary" href="/admin">
              Open Payload CMS
            </Link>
          ) : (
            <Link className="secondary" href="/app/admin/users">
              Turn on CMS access in Users
            </Link>
          )}
        </div>
      </div>

      <p className="admin-lede cms-bridge-footnote">
        Unauthenticated visits to <code>/admin</code> redirect to core login, then return already
        authenticated. Without CMS access you see a clear deny — no Payload account is required for
        ordinary members.
      </p>

      <h3 className="admin-subhead">Draft preview</h3>
      <p className="admin-lede">
        Turn on <strong>Draft preview</strong> under{' '}
        <Link href="/app/admin/settings">Site settings</Link>, then open{' '}
        <code>/preview/&#123;slug&#125;</code> while signed in with CMS access. Unpublished pages
        render there; anonymous visitors still only see published <code>/&#123;slug&#125;</code>.
      </p>
    </section>
  )
}
